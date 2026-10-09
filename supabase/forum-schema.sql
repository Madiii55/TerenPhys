-- Forum schema snapshot; applied with the Supabase migration API.
create table public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default '',
  author_avatar_path text,
  title text not null check (char_length(btrim(title)) between 6 and 160),
  body text not null check (char_length(btrim(body)) between 20 and 12000),
  grade smallint check (grade in (7,8,9,10,11,12)),
  category text not null check (category in ('mechanics','thermal','electricity','magnetism','optics','atomic','astronomy','general')),
  created_at timestamptz not null default now(),
  view_count bigint not null default 0 check (view_count >= 0),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  search_document tsvector generated always as (
    setweight(to_tsvector('russian'::regconfig, title), 'A') ||
    setweight(to_tsvector('russian'::regconfig, body), 'B')
  ) stored
);
create table public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default '',
  author_avatar_path text,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  parent_id uuid,
  created_at timestamptz not null default now(),
  unique (id, topic_id),
  foreign key (parent_id, topic_id) references public.forum_comments(id, topic_id)
);
create table public.forum_likes (
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);
create table private.forum_views (
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  visitor_key text not null,
  viewed_at timestamptz not null default now(),
  primary key (topic_id, visitor_key)
);
create index forum_topics_latest_idx on public.forum_topics (created_at desc, id);
create index forum_topics_popular_idx on public.forum_topics (view_count desc, created_at desc, id);
create index forum_topics_best_idx on public.forum_topics (like_count desc, created_at desc, id);
create index forum_topics_grade_category_idx on public.forum_topics (grade, category, created_at desc);
create index forum_topics_category_idx on public.forum_topics (category, created_at desc);
create index forum_topics_author_idx on public.forum_topics (author_id);
create index forum_topics_search_idx on public.forum_topics using gin (search_document);
create index forum_comments_topic_idx on public.forum_comments (topic_id, created_at, id);
create index forum_comments_author_idx on public.forum_comments (author_id);
create index forum_comments_parent_idx on public.forum_comments (parent_id, topic_id);
create index forum_likes_user_idx on public.forum_likes (user_id);

alter table public.forum_topics enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_likes enable row level security;
alter table private.forum_views enable row level security;
create policy forum_views_no_client_access on private.forum_views for all to anon, authenticated using (false) with check (false);
revoke all on public.forum_topics, public.forum_comments, public.forum_likes from public, anon, authenticated;
revoke all on private.forum_views from public, anon, authenticated;
grant select on public.forum_topics, public.forum_comments to anon, authenticated;
grant insert (author_id,title,body,grade,category) on public.forum_topics to authenticated;
grant insert (topic_id,author_id,body,parent_id) on public.forum_comments to authenticated;
grant select, delete on public.forum_likes to authenticated;
grant insert (topic_id,user_id) on public.forum_likes to authenticated;
grant all on public.forum_topics, public.forum_comments, public.forum_likes to service_role;
create policy forum_topics_read on public.forum_topics for select to anon, authenticated using (true);
create policy forum_topics_create on public.forum_topics for insert to authenticated
  with check ((select private.verified_account()) and author_id = (select auth.uid()));
create policy forum_comments_read on public.forum_comments for select to anon, authenticated using (true);
create policy forum_comments_create on public.forum_comments for insert to authenticated
  with check ((select private.verified_account()) and author_id = (select auth.uid()));
create policy forum_likes_read_own on public.forum_likes for select to authenticated
  using (user_id = (select auth.uid()));
create policy forum_likes_create_own on public.forum_likes for insert to authenticated
  with check ((select private.verified_account()) and user_id = (select auth.uid()));
create policy forum_likes_remove_own on public.forum_likes for delete to authenticated
  using ((select private.verified_account()) and user_id = (select auth.uid()));

create trigger forum_topic_snapshot before insert on public.forum_topics
  for each row execute function private.post_snapshot();
create trigger forum_comment_snapshot before insert on public.forum_comments
  for each row execute function private.post_snapshot();

-- Only a trigger can adjust aggregates. End users have no UPDATE grant on topics.
create function private.forum_update_totals()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare topic uuid; actor uuid; delta integer;
begin
  if tg_op = 'INSERT' then
    topic := new.topic_id; delta := 1;
    if tg_table_name = 'forum_likes' then actor := new.user_id; else actor := new.author_id; end if;
  else
    topic := old.topic_id; delta := -1;
    if tg_table_name = 'forum_likes' then actor := old.user_id; else actor := old.author_id; end if;
  end if;
  if auth.uid() is not null and actor is distinct from auth.uid() then
    raise exception 'Forbidden counter operation' using errcode = '42501';
  end if;
  if tg_table_name = 'forum_likes' then
    update public.forum_topics set like_count = greatest(0, like_count + delta) where id = topic;
  else
    update public.forum_topics set comment_count = greatest(0, comment_count + delta) where id = topic;
  end if;
  return null;
end;
$$;
revoke all on function private.forum_update_totals() from public, anon, authenticated;
create trigger forum_like_total after insert or delete on public.forum_likes
  for each row execute function private.forum_update_totals();
create trigger forum_comment_total after insert or delete on public.forum_comments
  for each row execute function private.forum_update_totals();

-- One counted read per account/browser and topic in 24 hours.
-- Anonymous browser IDs are deduplication, not bot-proof identity.
create function private.forum_record_view(p_topic uuid, p_visitor uuid)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid(); visitor text; result bigint;
begin
  if actor is null then
    if p_visitor is null then raise exception 'Visitor required' using errcode = '22023'; end if;
    visitor := 'browser:' || p_visitor::text;
  else
    visitor := 'user:' || actor::text;
  end if;
  -- Serialize with topic deletion; missing topics must not create view entries.
  perform 1 from public.forum_topics where id = p_topic for update;
  if not found then return null; end if;
  insert into private.forum_views (topic_id, visitor_key) values (p_topic, visitor)
    on conflict (topic_id, visitor_key) do update set viewed_at = now()
      where private.forum_views.viewed_at < now() - interval '24 hours';
  if found then
    update public.forum_topics set view_count = view_count + 1 where id = p_topic;
  end if;
  select view_count into result from public.forum_topics where id = p_topic;
  return result;
end;
$$;
revoke all on function private.forum_record_view(uuid,uuid) from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.forum_record_view(uuid,uuid) to anon, authenticated;
-- The exposed wrapper is invoker; the narrowly scoped write lives in private.
create function public.forum_record_view(p_topic uuid, p_visitor uuid)
returns bigint language sql security invoker set search_path = ''
as $$ select private.forum_record_view(p_topic, p_visitor); $$;
revoke all on function public.forum_record_view(uuid,uuid) from public, anon, authenticated;
grant execute on function public.forum_record_view(uuid,uuid) to anon, authenticated;

alter publication supabase_realtime add table public.forum_topics, public.forum_comments;
