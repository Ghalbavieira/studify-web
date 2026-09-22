begin;

-- Private provider state. Public clients continue using get_entitlement().
create table public.billing_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  customer_id text unique,
  subscription_id text unique,
  subscription_status text not null default 'pending',
  subscription_event_at timestamptz,
  checkout_id text unique,
  checkout_url text,
  checkout_expires_at timestamptz,
  checkout_status text,
  checkout_event_at timestamptz,
  payment_method text check (payment_method in ('PIX', 'CREDIT_CARD')),
  operation_started_at timestamptz,
  operation_kind text,
  cancel_requested_at timestamptz,
  trial_ends_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.billing_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references public.billing_accounts(user_id) on delete cascade
);
create table public.billing_payments (
  payment_id text primary key,
  user_id uuid not null references public.billing_accounts(user_id) on delete cascade,
  subscription_id text not null,
  status text not null,
  due_date date not null,
  event_at timestamptz not null,
  revoked boolean not null default false
);
create table public.billing_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
alter table public.billing_accounts enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_accounts, public.billing_subscriptions, public.billing_payments, public.billing_webhook_events from public, anon, authenticated;
grant all on public.billing_accounts, public.billing_subscriptions, public.billing_payments, public.billing_webhook_events to service_role;

-- A durable operation reservation blocks double clicks and ambiguous provider timeouts.
-- It is intentionally NOT automatically expired: reconcile before retrying a creation.
create function public.reserve_billing_operation(p_user_id uuid, p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.billing_accounts(user_id, trial_ends_at)
    select id, case when plan_status = 'trialing' then plan_expires_at end from public.profiles where id = p_user_id
    on conflict (user_id) do nothing;
  update public.billing_accounts set operation_started_at = now(), operation_kind = p_kind
    where user_id = p_user_id and operation_started_at is null;
  return found;
end;
$$;

create function public.apply_asaas_event(p_event jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  a public.billing_accounts%rowtype;
  e text := p_event->>'event';
  t timestamptz := (p_event->>'at')::timestamptz;
  paid_until timestamptz;
  access_until timestamptz;
  canceled boolean;
begin
  -- Event receipt and entitlement mutation commit together, or both roll back.
  insert into public.billing_webhook_events(event_id, event_type) values (p_event->>'id', e)
    on conflict do nothing;
  if not found then return false; end if;
  select * into a from public.billing_accounts where user_id = (p_event->>'userId')::uuid for update;
  if not found then raise exception 'Billing account missing'; end if;
  if e like 'CHECKOUT_%' then
    if a.checkout_id is not null and a.checkout_id <> p_event->>'resourceId' then return true; end if;
    if a.checkout_event_at is null or t > a.checkout_event_at then
      update public.billing_accounts set checkout_id = p_event->>'resourceId', checkout_status = e,
        checkout_event_at = t, updated_at = now() where user_id = a.user_id;
    end if;
    return true;
  end if;
  -- Keep historical ownership so refunds after a later subscription still revoke the old payment.
  if a.subscription_id is null and not exists (
    select 1 from public.billing_subscriptions where subscription_id = p_event->>'subscriptionId'
  ) then
    update public.billing_accounts set subscription_id = p_event->>'subscriptionId', updated_at = now() where user_id = a.user_id;
    a.subscription_id := p_event->>'subscriptionId';
  end if;
  if a.subscription_id = p_event->>'subscriptionId' then
    insert into public.billing_subscriptions(subscription_id,user_id) values (a.subscription_id,a.user_id) on conflict do nothing;
  elsif not exists (select 1 from public.billing_subscriptions where subscription_id = p_event->>'subscriptionId' and user_id = a.user_id) then
    return true;
  end if;
  if e like 'SUBSCRIPTION_%' and a.subscription_id is distinct from p_event->>'subscriptionId' then return true; end if;
  if e like 'SUBSCRIPTION_%' and (a.subscription_event_at is null or t > a.subscription_event_at
      or (t = a.subscription_event_at and e in ('SUBSCRIPTION_DELETED','SUBSCRIPTION_INACTIVATED'))) then
    update public.billing_accounts set subscription_status = p_event->>'status', subscription_event_at = t,
      operation_started_at = case when e = 'SUBSCRIPTION_CREATED' then null else operation_started_at end,
      operation_kind = case when e = 'SUBSCRIPTION_CREATED' then null else operation_kind end where user_id = a.user_id;
  elsif e like 'PAYMENT_%' then
    insert into public.billing_payments(payment_id, user_id, subscription_id, status, due_date, event_at, revoked)
    values (p_event->>'resourceId', a.user_id, p_event->>'subscriptionId', p_event->>'status', (p_event->>'dueDate')::date, t,
      (p_event->>'status') in ('REFUNDED','REFUND_REQUESTED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL','DELETED'))
    on conflict (payment_id) do update set status = excluded.status, due_date = excluded.due_date,
      event_at = excluded.event_at, revoked = excluded.revoked
    where excluded.event_at > public.billing_payments.event_at
      or (excluded.event_at = public.billing_payments.event_at and (
        excluded.revoked or (not public.billing_payments.revoked and
          case excluded.status when 'RECEIVED' then 4 when 'CONFIRMED' then 3 when 'OVERDUE' then 2 else 1 end >
          case public.billing_payments.status when 'RECEIVED' then 4 when 'CONFIRMED' then 3 when 'OVERDUE' then 2 else 1 end)
      ));
  end if;
  select * into a from public.billing_accounts where user_id = a.user_id;
  select max(((due_date + interval '1 month')::date::timestamp at time zone 'America/Sao_Paulo')) into paid_until
    from public.billing_payments where user_id = a.user_id and status in ('CONFIRMED','RECEIVED') and not revoked;
  access_until := greatest(paid_until, a.trial_ends_at);
  canceled := a.subscription_status in ('INACTIVE','DELETED');
  update public.profiles set
    billing_customer_id = a.customer_id, billing_subscription_id = a.subscription_id,
    plan = case when access_until > now() then 'pro' else 'free' end,
    plan_status = case when canceled then 'canceled'
      when paid_until > now() then 'active'
      when a.trial_ends_at > now() then 'trialing' else 'past_due' end,
    plan_started_at = case when paid_until > now() then least(coalesce(plan_started_at, now()), now()) else plan_started_at end,
    plan_expires_at = coalesce(access_until, now())
    where id = a.user_id;
  return true;
end;
$$;
revoke all on function public.reserve_billing_operation(uuid,text), public.apply_asaas_event(jsonb) from public, anon, authenticated;
grant execute on function public.reserve_billing_operation(uuid,text), public.apply_asaas_event(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
