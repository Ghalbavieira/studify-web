begin;

-- Structured study content reuses the existing post, reaction, bookmark,
-- comment, moderation and group infrastructure.
alter table public.social_posts
  add column if not exists kind text not null default 'discussion',
  add column if not exists title text;

alter table public.social_posts drop constraint if exists social_posts_kind_check;
alter table public.social_posts add constraint social_posts_kind_check
  check (kind in ('discussion', 'summary', 'note'));

alter table public.social_posts drop constraint if exists social_posts_title_check;
alter table public.social_posts add constraint social_posts_title_check
  check (title is null or char_length(title) <= 160);

alter table public.social_posts drop constraint if exists social_posts_structured_title_check;
alter table public.social_posts add constraint social_posts_structured_title_check
  check (kind = 'discussion' or length(btrim(coalesce(title, ''))) > 0);

alter table public.social_posts drop constraint if exists social_posts_text_check;
alter table public.social_posts add constraint social_posts_text_check
  check (char_length(text) <= 5000);

create index if not exists social_posts_group_kind_created_idx
  on public.social_posts(group_id, kind, created_at desc);

notify pgrst, 'reload schema';
commit;
