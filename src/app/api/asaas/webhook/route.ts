import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { asaas, BillingError, type AsaasSubscription } from "@/lib/billing/asaas";
import { billingAdmin, billingFailure, billingResponse } from "@/lib/billing/server";
export const runtime = "nodejs";
export const maxDuration = 120;
const resource = z.object({ id: z.string().min(1), customer: z.string().optional(), externalReference: z.string().nullable().optional(), subscription: z.unknown().optional(), status: z.string().optional(), dueDate: z.string().optional(), value: z.number().optional() }).passthrough();
const schema = z.object({ id: z.string().min(1).max(200), event: z.string(), dateCreated: z.string(), payment: resource.optional(), subscription: resource.optional(), checkout: resource.optional() });
const events = new Set(["CHECKOUT_CREATED", "CHECKOUT_PAID", "CHECKOUT_CANCELED", "CHECKOUT_EXPIRED", "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED", "PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_RESTORED", "PAYMENT_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL", "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"]);
export async function POST(request: Request) {
  try {
    const secret = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!secret || secret.length < 32) throw new BillingError("Webhook indisponível.");
    const supplied = request.headers.get("asaas-access-token") || "";
    if (Buffer.byteLength(secret) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) return billingResponse({ error: "Não autorizado." }, 401);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 256_000) return billingResponse({ error: "Payload muito grande." }, 413);
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) return billingResponse({ error: "Evento inválido." }, 400);
    const event = parsed.data;
    if (!events.has(event.event)) return billingResponse({ ignored: true });
    const admin = billingAdmin();
    const { data: previous, error: previousError } = await admin.from("billing_webhook_events").select("event_id").eq("event_id", event.id).maybeSingle();
    if (previousError) throw previousError;
    if (previous) return billingResponse({ duplicate: true });
    const isCheckout = event.event.startsWith("CHECKOUT_");
    const isPayment = event.event.startsWith("PAYMENT_");
    const object = isCheckout ? event.checkout : isPayment ? event.payment : event.subscription;
    if (!object) return billingResponse({ error: "Recurso ausente." }, 400);
    const subscriptionId = isPayment ? (typeof object.subscription === "string" ? object.subscription : undefined) : isCheckout ? undefined : object.id;
    if (isPayment && !subscriptionId) return billingResponse({ ignored: true });
    let customer = object.customer;
    let subscription: AsaasSubscription | undefined;
    if (subscriptionId) {
      // Validate ownership/product against Asaas, never trust a user_id alone.
      subscription = await asaas<AsaasSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
      customer = subscription.customer;
      if (subscription.value !== 14.9 || subscription.cycle !== "MONTHLY") return billingResponse({ ignored: true });
    }
    if (!customer) throw new BillingError("Aguardando identificação do cliente.", 503);
    const { data: account, error } = await admin.from("billing_accounts").select("*").eq("customer_id", customer).maybeSingle();
    if (error) throw error;
    if (!account) throw new BillingError("Aguardando cadastro local do cliente.", 503);
    if (object.externalReference && object.externalReference !== account.user_id) return billingResponse({ ignored: true });
    if (subscription?.externalReference && subscription.externalReference !== account.user_id) return billingResponse({ ignored: true });
    if (!isCheckout && !account.subscription_id && !account.checkout_id && account.operation_kind !== "checkout") throw new BillingError("Aguardando associação da assinatura.");
    if (subscription && !subscription.deleted && !subscription.externalReference) {
      // Hosted checkout does not guarantee propagation of its externalReference.
      await asaas(`/subscriptions/${encodeURIComponent(subscription.id)}`, "PUT", { externalReference: account.user_id });
    }
    const at = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(event.dateCreated) ? event.dateCreated : `${event.dateCreated.replace(" ", "T")}-03:00`);
    if (!Number.isFinite(at.getTime())) return billingResponse({ error: "Data inválida." }, 400);
    let status = object.status;
    if (event.event === "SUBSCRIPTION_DELETED") status = "DELETED";
    if (event.event === "SUBSCRIPTION_INACTIVATED") status = "INACTIVE";
    if (event.event === "PAYMENT_DELETED") status = "DELETED";
    if (["PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_PARTIALLY_REFUNDED"].includes(event.event)) status = "REFUND_REQUESTED";
    if (isPayment && (object.value !== 14.9 || !/^\d{4}-\d{2}-\d{2}$/.test(object.dueDate || "") || !status)) return billingResponse({ ignored: true });
    const { error: applyError } = await admin.rpc("apply_asaas_event", { p_event: { id: event.id, event: event.event, at: at.toISOString(), userId: account.user_id, resourceId: object.id, subscriptionId, status, dueDate: object.dueDate } });
    if (applyError) throw applyError;
    return billingResponse({ received: true });
  } catch (error) { return billingFailure(error); }
}
