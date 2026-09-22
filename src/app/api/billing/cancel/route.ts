import { asaas, BillingError, type AsaasSubscription } from "@/lib/billing/asaas";
import { billingAdmin, billingFailure, billingResponse, billingUser, supabaseFailure } from "@/lib/billing/server";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  let release: (() => Promise<void>) | undefined;
  try {
    const { user } = await billingUser(request);
    const admin = billingAdmin();
    const { data: reserved, error: reserveError } = await admin.rpc("reserve_billing_operation", { p_user_id: user.id, p_kind: "cancel" });
    if (reserveError) throw supabaseFailure(reserveError, "reserve_cancel");
    if (!reserved) throw new BillingError("Outra operação está em processamento. Atualize o status antes de cancelar.", 409);
    release = async () => { await admin.from("billing_accounts").update({ operation_started_at: null, operation_kind: null }).eq("user_id", user.id).eq("operation_kind", "cancel"); };
    const { data: account, error } = await admin.from("billing_accounts").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw supabaseFailure(error, "load_account");
    if (!account) return billingResponse({ status: "no_subscription" });
    if (account.cancel_requested_at || ["DELETED", "INACTIVE"].includes(account.subscription_status)) return billingResponse({ status: "cancellation_requested" });
    if (account.subscription_id) {
      const subscription = await asaas<AsaasSubscription>(`/subscriptions/${encodeURIComponent(account.subscription_id)}`);
      if (subscription.customer !== account.customer_id) throw new BillingError("Assinatura não corresponde à conta.", 409);
      if (!subscription.deleted) await asaas(`/subscriptions/${encodeURIComponent(account.subscription_id)}`, "DELETE");
    } else if (account.checkout_id) {
      await asaas(`/checkouts/${encodeURIComponent(account.checkout_id)}/cancel`, "POST");
    } else if (account.operation_kind === "checkout") throw new BillingError("Contratação em processamento. Atualize o status antes de cancelar.", 409);
    else return billingResponse({ status: "no_subscription" });
    // This is only an operational marker. Entitlement is changed by the webhook.
    const { error: updateError } = await admin.from("billing_accounts").update({ cancel_requested_at: new Date().toISOString() }).eq("user_id", user.id);
    if (updateError) throw supabaseFailure(updateError, "save_cancellation");
    return billingResponse({ status: "cancellation_requested" });
  } catch (error) { return billingFailure(error, { operation: "billing.cancel", request }); }
  finally { if (release) await release(); }
}
