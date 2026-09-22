import { billingAdmin, billingFailure, billingResponse, billingUser, supabaseFailure } from "@/lib/billing/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { user, client } = await billingUser(request);
    const [{ data: entitlement, error }, { data: billing, error: billingError }] = await Promise.all([
      client.rpc("get_entitlement"),
      billingAdmin().from("billing_accounts").select("subscription_id,subscription_status,checkout_id,checkout_status,checkout_url,checkout_expires_at,payment_method,cancel_requested_at,operation_started_at,trial_ends_at").eq("user_id", user.id).maybeSingle(),
    ]);
    if (error) throw supabaseFailure(error, "entitlement");
    if (billingError) throw supabaseFailure(billingError, "account_status");
    return billingResponse({ entitlement, billing, environment: "sandbox", priceMonthly: 14.9 });
  } catch (error) { return billingFailure(error, { operation: "billing.status", request }); }
}
