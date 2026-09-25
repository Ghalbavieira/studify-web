import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../../supabase/migrations/015_enable_community.sql', import.meta.url), 'utf8');
const userId = '00000000-0000-4000-8000-000000000001';

async function database(users = 1) {
  const db = new PGlite();
  await db.exec(`
    create schema auth; create schema storage; create schema community_private;
    create table auth.users(id uuid primary key, email text);
    create table storage.buckets(id text primary key, public boolean not null);
    create table public.community_policy(singleton boolean primary key, version text not null, support_email text not null default '', enabled boolean not null default false);
    create table community_private.moderators(user_id uuid primary key references auth.users(id));
    create table community_private.audit(moderator_id uuid, kind text, content_id uuid, action text, reason text);
    create function public.community_accept_terms(text) returns void language sql as $$select$$;
    create function public.community_moderation_queue() returns jsonb language sql as $$select '{}'::jsonb$$;
    insert into storage.buckets values('social-media', true);
    insert into public.community_policy values(true, '2026-09-13', '', false);
    insert into auth.users values('${userId}', 'owner@example.com');
    ${users > 1 ? "insert into auth.users values('00000000-0000-4000-8000-000000000002', 'other@example.com');" : ''}
  `);
  return db;
}

test('community activation configures support, moderator and audit atomically', async () => {
  const db = await database();
  try {
    await db.exec(migration);
    const policy = (await db.query('select support_email, enabled from community_policy')).rows[0];
    assert.deepEqual(policy, { support_email: 'suporte@sensorydigital.com.br', enabled: true });
    assert.equal((await db.query('select count(*)::int as count from community_private.moderators')).rows[0].count, 1);
    assert.equal((await db.query("select action from community_private.audit")).rows[0].action, 'community_enabled');
  } finally { await db.close(); }
});

test('community activation refuses an ambiguous moderator assignment', async () => {
  const db = await database(2);
  try {
    await assert.rejects(db.exec(migration), /Expected exactly one moderator account/);
    await db.exec('rollback');
    assert.equal((await db.query('select enabled from community_policy')).rows[0].enabled, false);
  } finally { await db.close(); }
});
