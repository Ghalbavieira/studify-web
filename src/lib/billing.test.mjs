import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const uid = '00000000-0000-4000-8000-000000000001';
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
    create table public.profiles(id uuid primary key, display_name text, timezone text, data_version integer,
    plan text, plan_status text, plan_started_at timestamptz, plan_expires_at timestamptz,
    billing_customer_id text, billing_subscription_id text);
    create table public.goals(id uuid primary key, user_id uuid);
    insert into profiles(id,plan,plan_status,plan_started_at,plan_expires_at) values('${uid}','pro','trialing',now(),now()+interval '15 days');`);
  await db.exec(await readFile(new URL('../../supabase/migrations/009_shared_entitlement.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/012_asaas_billing.sql', import.meta.url), 'utf8'));
  await db.query(`select reserve_billing_operation($1,'checkout')`, [uid]);
  await db.exec(`update billing_accounts set customer_id='cus_test';`);
  return db;
}
const event = (overrides = {}) => ({ id: 'evt_1', event: 'PAYMENT_CONFIRMED', at: '2026-09-21T12:00:00Z', userId: uid, resourceId: 'pay_1', subscriptionId: 'sub_1', status: 'CONFIRMED', dueDate: '2099-01-31', ...overrides });
async function apply(db, e) { return (await db.query('select apply_asaas_event($1::jsonb) as result', [JSON.stringify(e)])).rows[0].result; }
async function entitlement(db) { return (await db.query('select get_entitlement() as value')).rows[0].value; }

test('webhook transaction, duplicate delivery, ordering, cancellation and refunds', async () => {
  const db = await setup();
  try {
    assert.equal(await apply(db, event()), true);
    const paid = await entitlement(db);
    assert.equal(paid.plan, 'pro'); assert.equal(paid.status, 'active');
    assert.match(paid.expiresAt, /^2099-02-28/); // calendar month, not 30 days
    assert.equal(await apply(db, event()), false);
    await apply(db, event({ id: 'late', status: 'OVERDUE', at: '2026-09-20T12:00:00Z' }));
    assert.equal((await entitlement(db)).expiresAt, paid.expiresAt);
    await apply(db, event({ id: 'cancel', event: 'SUBSCRIPTION_DELETED', status: 'DELETED', resourceId: 'sub_1' }));
    assert.equal((await entitlement(db)).billingStatus, 'canceled');
    assert.equal((await entitlement(db)).plan, 'pro');
    await apply(db, event({ id: 'old-sub', event: 'SUBSCRIPTION_CREATED', status: 'ACTIVE', at: '2026-09-20T12:00:00Z' }));
    assert.equal((await entitlement(db)).billingStatus, 'canceled');
    await db.exec(`update billing_accounts set trial_ends_at=now()-interval '1 day';`);
    await apply(db, event({ id: 'refund', event: 'PAYMENT_REFUNDED', status: 'REFUNDED', at: '2026-09-22T12:00:00Z' }));
    assert.equal((await entitlement(db)).plan, 'free');
    await apply(db, event({ id: 'same-time-confirm', at: '2026-09-22T12:00:00Z' }));
    assert.equal((await entitlement(db)).plan, 'free');
  } finally { await db.close(); }
});
test('trial cannot be renewed; checkout success never grants paid Pro; expiry needs no cron', async () => {
  const db = await setup();
  try {
    const original = await entitlement(db);
    assert.equal(original.status, 'trialing'); assert.equal(original.trialDaysRemaining, 15);
    assert.equal((await db.query(`select reserve_billing_operation($1,'checkout') as ok`, [uid])).rows[0].ok, false);
    await apply(db, event({ event: 'CHECKOUT_PAID', resourceId: 'checkout_1' }));
    assert.equal((await entitlement(db)).status, 'trialing');
    await db.exec(`update profiles set plan_expires_at=now()-interval '1 second';`);
    assert.equal((await entitlement(db)).plan, 'free');
    assert.equal((await entitlement(db)).capabilities.canUseAdvancedAI, false);
  } finally { await db.close(); }
});
test('failure rolls back event receipt so Asaas can retry; clients cannot mutate billing', async () => {
  const db = await setup();
  try {
    await assert.rejects(apply(db, event({ dueDate: 'bad-date' })));
    assert.equal((await db.query('select count(*)::int as n from billing_webhook_events')).rows[0].n, 0);
    await apply(db, event());
    await db.exec('set role authenticated;');
    await assert.rejects(db.query(`select apply_asaas_event('{}')`));
    await assert.rejects(db.query('select * from billing_accounts'));
    await assert.rejects(db.query(`update profiles set plan='pro'`));
  } finally { await db.close(); }
});

test('same-second confirmation wins over pending; old subscription refunds survive resubscription', async () => {
  const db = await setup();
  try {
    await apply(db, event({ id: 'pending', event: 'PAYMENT_CREATED', status: 'PENDING' }));
    await apply(db, event());
    assert.equal((await entitlement(db)).status, 'active');
    await db.exec(`update billing_accounts set subscription_id=null,subscription_event_at=null,trial_ends_at=now()-interval '1 day';`);
    await apply(db, event({ id: 'new-sub', event: 'SUBSCRIPTION_CREATED', subscriptionId: 'sub_2', resourceId: 'sub_2', status: 'ACTIVE' }));
    await apply(db, event({ id: 'old-refund', event: 'PAYMENT_REFUNDED', status: 'REFUNDED', at: '2026-09-23T12:00:00Z' }));
    assert.equal((await entitlement(db)).plan, 'free');
    assert.equal((await db.query('select subscription_id from billing_accounts')).rows[0].subscription_id, 'sub_2');
  } finally { await db.close(); }
});
