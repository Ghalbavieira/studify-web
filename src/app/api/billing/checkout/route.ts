import { z } from "zod";
import { asaas, asaasConfig, BillingError, hostedUrl, type AsaasList, type AsaasPayment, type AsaasSubscription } from "@/lib/billing/asaas";
import { billingAdmin, billingFailure, billingResponse, billingUser, siteUrl } from "@/lib/billing/server";
export const runtime = "nodejs";
export const maxDuration = 120;
const input = z.object({ name: z.string().trim().min(3).max(100), cpfCnpj: z.string().transform(v => v.replace(/\D/g, "")).refine(v => [11, 14].includes(v.length)), method: z.enum(["PIX", "CREDIT_CARD"]) });

export async function POST(request: Request) {
  let releaseKnownFailure: (() => Promise<void>) | undefined;
  try {
    const { user } = await billingUser(request);
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) throw new BillingError("Informe nome, CPF/CNPJ e forma de pagamento válidos.", 400);
    asaasConfig();
    if ((process.env.ASAAS_WEBHOOK_TOKEN?.length ?? 0) < 32) throw new BillingError("Webhook ainda não configurado no servidor.");
    const admin = billingAdmin();
    const { data: reserved, error: reserveError } = await admin.rpc("reserve_billing_operation", { p_user_id: user.id, p_kind: "checkout" });
    if (reserveError) throw reserveError;
    const { data: account, error } = await admin.from("billing_accounts").select("*").eq("user_id", user.id).single();
    if (error) throw error;
    const save = async (values: Record<string, unknown>) => {
      const { error } = await admin.from("billing_accounts").update(values).eq("user_id", user.id);
      if (error) throw error;
    };
    const release = () => save({ operation_started_at: null, operation_kind: null });
    if (reserved) releaseKnownFailure = release;
    if (!reserved) throw new BillingError("Já existe uma operação em processamento. Atualize o status; não repita a contratação.", 409);
    if (account.cancel_requested_at && !["DELETED", "INACTIVE"].includes(account.subscription_status) && !["CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"].includes(account.checkout_status)) {
      await release(); throw new BillingError("Aguarde a confirmação do cancelamento.", 409);
    }
    if (!account.subscription_id && account.checkout_status === "CHECKOUT_PAID") {
      await release(); throw new BillingError("Pagamento recebido. Aguarde a confirmação da assinatura.", 409);
    }
    if (account.checkout_url && account.checkout_expires_at > new Date().toISOString() && !["CHECKOUT_PAID", "CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"].includes(account.checkout_status)) {
      await release(); return billingResponse({ url: hostedUrl(account.checkout_url) });
    }
    if (!account.subscription_id && account.checkout_id && !["CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"].includes(account.checkout_status)) {
      await release(); throw new BillingError("Aguarde a confirmação do checkout anterior ou cancele-o antes de continuar.", 409);
    }
    if (account.subscription_id && !["DELETED", "INACTIVE"].includes(account.subscription_status)) {
      if (account.payment_method === "PIX") {
        const payments = await asaas<AsaasList<AsaasPayment>>(`/subscriptions/${encodeURIComponent(account.subscription_id)}/payments?status=PENDING&limit=100`);
        const payment = payments.data.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        await release();
        if (payment?.invoiceUrl) return billingResponse({ url: hostedUrl(payment.invoiceUrl) });
      } else await release();
      throw new BillingError("Você já possui uma assinatura. Consulte o status.", 409);
    }
    // Reference is always derived from the verified Supabase session, never the request body.
    let customerId = account.customer_id as string | null;
    if (!customerId) {
      const customers = await asaas<AsaasList<{ id: string; externalReference: string }>>(`/customers?externalReference=${encodeURIComponent(user.id)}&limit=100`);
      const matches = customers.data.filter(c => c.externalReference === user.id);
      if (matches.length > 1) throw new BillingError("Cadastro duplicado no provedor. Solicite conciliação antes de continuar.", 409);
      customerId = matches[0]?.id ?? (await asaas<{ id: string }>("/customers", "POST", { name: parsed.data.name, cpfCnpj: parsed.data.cpfCnpj, email: user.email, externalReference: user.id })).id;
      await save({ customer_id: customerId });
    }
    const now = new Date();
    const due = account.trial_ends_at && new Date(account.trial_ends_at) > now ? new Date(account.trial_ends_at) : now;
    // Round trial expiry up to the next local date: never charge before the full trial ends.
    const dueDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(due.getTime() + (due > now ? 86_400_000 : 0)));
    await save({ payment_method: parsed.data.method, subscription_id: null, subscription_status: "pending", subscription_event_at: null, cancel_requested_at: null, checkout_id: null, checkout_status: null, checkout_event_at: null, checkout_url: null, checkout_expires_at: null });
    if (parsed.data.method === "PIX") {
      const subscription = await asaas<AsaasSubscription>("/subscriptions", "POST", { customer: customerId, billingType: "PIX", value: 14.9, nextDueDate: dueDate, cycle: "MONTHLY", description: "Studify Pro", externalReference: user.id });
      await save({ subscription_id: subscription.id });
      const payments = await asaas<AsaasList<AsaasPayment>>(`/subscriptions/${encodeURIComponent(subscription.id)}/payments?limit=100`);
      const payment = payments.data.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      await release();
      if (!payment?.invoiceUrl) throw new BillingError("Assinatura criada. A fatura está sendo preparada; atualize o status.", 409);
      return billingResponse({ url: hostedUrl(payment.invoiceUrl) });
    }
    const origin = siteUrl();
    const checkout = await asaas<{ id: string }>("/checkouts", "POST", {
      customer: customerId, externalReference: user.id, billingTypes: ["CREDIT_CARD"], chargeTypes: ["RECURRENT"], minutesToExpire: 60,
      callback: { successUrl: `${origin}/assinatura?retorno=sucesso`, cancelUrl: `${origin}/assinatura?retorno=cancelado`, expiredUrl: `${origin}/assinatura?retorno=expirado` },
      items: [{ name: "Studify Pro", description: "Assinatura mensal Studify Pro", quantity: 1, value: 14.9 }],
      subscription: { cycle: "MONTHLY", nextDueDate: `${dueDate} 00:00:00` },
    });
    const url = hostedUrl(`https://sandbox.asaas.com/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`);
    await save({ checkout_id: checkout.id, checkout_url: url, checkout_expires_at: new Date(Date.now() + 60 * 60_000).toISOString(), operation_started_at: null, operation_kind: null });
    return billingResponse({ url });
  } catch (error) {
    // A provider 400 is a definitive rejection, unlike a network timeout.
    if (error instanceof BillingError && error.status === 422 && releaseKnownFailure) {
      try { await releaseKnownFailure(); } catch { /* Preserve the reservation if the DB is unavailable. */ }
    }
    return billingFailure(error);
  }
}
