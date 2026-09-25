begin;

-- Open the community only after its operational safety requirements exist.
-- The moderator remains a private database role and cannot be self-assigned by clients.
do $$
declare
  moderator_id uuid;
  moderator_count integer;
begin
  if to_regclass('public.community_policy') is null
    or to_regclass('community_private.moderators') is null
    or to_regprocedure('public.community_accept_terms(text)') is null
    or to_regprocedure('public.community_moderation_queue()') is null then
    raise exception 'Community safety migration 008 is not fully applied';
  end if;

  if not exists (select 1 from storage.buckets where id = 'social-media' and public) then
    raise exception 'Public social-media bucket is not configured';
  end if;

  select count(*), (array_agg(id))[1] into moderator_count, moderator_id
  from auth.users
  where lower(email) = lower('suporte@sensorydigital.com.br');

  -- The requested support address does not currently identify the login account.
  -- With a single existing account, assign that account as the initial moderator
  -- while keeping the public support contact independent from its login email.
  if moderator_count = 0 then
    select count(*), (array_agg(id))[1] into moderator_count, moderator_id from auth.users;
  end if;
  if moderator_count <> 1 or moderator_id is null then
    raise exception 'Expected exactly one moderator account; found % candidates', moderator_count;
  end if;

  insert into community_private.moderators(user_id) values (moderator_id)
  on conflict (user_id) do nothing;

  update public.community_policy
  set support_email = 'suporte@sensorydigital.com.br', enabled = true
  where singleton and version = '2026-09-13';
  if not found then
    raise exception 'Community policy version does not match the application';
  end if;

  insert into community_private.audit(moderator_id, kind, content_id, action, reason)
  values (moderator_id, 'profile', moderator_id, 'community_enabled', 'Initial production community activation');
end;
$$;

commit;
