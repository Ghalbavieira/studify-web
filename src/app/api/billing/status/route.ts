import { billingAdmin, billingFailure, billingResponse, billingUser, supabaseFailure } from "@/lib/billing/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { user, client } = await billingUser(request);
    const [{ data: entitlement, error }, { data: billing, error: billingError }, { data: payment, error: paymentError }] = await Promise.all([
      client.rpc("get_entitlement"),
      billingAdmin().from("billing_accounts").select("subscription_id,subscription_status,checkout_id,checkout_status,checkout_url,checkout_expires_at,payment_method,cancel_requested_at,operation_started_at,trial_ends_at").eq("user_id", user.id).maybeSingle(),
      billingAdmin().from("billing_payments").select("due_date,status").eq("user_id", user.id).eq("revoked", false).in("status", ["CONFIRMED", "RECEIVED"]).order("due_date", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (error) throw supabaseFailure(error, "entitlement");
    if (billingError) throw supabaseFailure(billingError, "account_status");
    if (paymentError) throw supabaseFailure(paymentError, "payment_status");
    const paidUntil = payment?.due_date ? new Date(`${payment.due_date}T12:00:00Z`) : null;
    if (paidUntil) paidUntil.setUTCMonth(paidUntil.getUTCMonth() + 1);
    const trialDaysRemaining = billing?.trial_ends_at ? Math.max(0, Math.ceil((new Date(billing.trial_ends_at).getTime() - Date.now()) / 86_400_000)) : 0;
    return billingResponse({ entitlement, billing: billing ? { ...billing, paid_until: paidUntil?.toISOString() ?? null, trial_days_remaining: trialDaysRemaining } : null, environment: "sandbox", priceMonthly: 14.9 });
  } catch (error) { return billingFailure(error, { operation: "billing.status", request }); }
}
