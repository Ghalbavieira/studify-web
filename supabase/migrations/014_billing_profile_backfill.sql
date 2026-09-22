begin;

-- Some accounts predate the profile trigger. Without a profile, get_entitlement()
-- raises 42501 and reserve_billing_operation() cannot create billing_accounts.
-- Preserve the original 15-day trial window based on auth.users.created_at.
insert into public.profiles (
  id, display_name, plan, plan_status, plan_started_at, plan_expires_at, created_at
)
select
  users.id,
  left(coalesce(users.raw_user_meta_data ->> 'display_name', ''), 100),
  case when users.created_at + interval '15 days' > now() then 'pro' else 'free' end,
  case when users.created_at + interval '15 days' > now() then 'trialing' else 'active' end,
  users.created_at,
  case when users.created_at + interval '15 days' > now() then users.created_at + interval '15 days' else null end,
  users.created_at
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null;

-- Restore the intended RPC/schema privileges in case an older deploy revoked them.
grant usage on schema public to authenticated, service_role;
revoke all on function public.get_entitlement() from public, anon;
grant execute on function public.get_entitlement() to authenticated;
grant all on public.billing_accounts, public.billing_subscriptions,
  public.billing_payments, public.billing_webhook_events to service_role;
grant execute on function public.reserve_billing_operation(uuid,text),
  public.apply_asaas_event(jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
