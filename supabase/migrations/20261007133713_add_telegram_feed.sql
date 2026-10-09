-- Public, read-only mirror of the project's Telegram channel.
create table public.telegram_sources (
  username text primary key check (username = 'nisphysicshub'),
  title text not null,
  chat_id bigint unique,
  updated_at timestamptz not null default now()
);
insert into public.telegram_sources (username, title) values ('nisphysicshub', 'Physics Hub | TerenSci');

create table public.telegram_posts (
  channel_username text not null references public.telegram_sources(username),
  message_id bigint not null check (message_id > 0),
  text text not null default '' check (length(text) <= 100000),
  entities jsonb not null default '[]' check (jsonb_typeof(entities) = 'array' and jsonb_array_length(entities) <= 500),
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 20),
  published_at timestamptz not null,
  source_revision_at timestamptz not null,
  source_kind text not null check (source_kind in ('public', 'export', 'bot')),
  media_group_id text check (length(media_group_id) <= 100),
  imported_at timestamptz not null default now(),
  primary key (channel_username, message_id)
);
create index telegram_posts_feed_idx on public.telegram_posts (channel_username, published_at desc, message_id desc);

alter table public.telegram_sources enable row level security;
alter table public.telegram_posts enable row level security;
revoke all on public.telegram_sources, public.telegram_posts from anon, authenticated;
grant select on public.telegram_sources, public.telegram_posts to anon, authenticated;
grant all on public.telegram_sources, public.telegram_posts to service_role;
create policy telegram_sources_read on public.telegram_sources for select to anon, authenticated using (true);
create policy telegram_posts_read on public.telegram_posts for select to anon, authenticated using (true);

-- Server-only, idempotent upsert. Older imports/updates cannot replace a newer bot edit.
create function public.telegram_store_post(p_post jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  insert into public.telegram_posts as current (
    channel_username, message_id, text, entities, attachments, published_at,
    source_revision_at, source_kind, media_group_id
  ) values (
    p_post->>'channel_username', (p_post->>'message_id')::bigint, coalesce(p_post->>'text',''),
    coalesce(p_post->'entities','[]'::jsonb), coalesce(p_post->'attachments','[]'::jsonb),
    (p_post->>'published_at')::timestamptz, (p_post->>'source_revision_at')::timestamptz,
    p_post->>'source_kind', p_post->>'media_group_id'
  )
  on conflict (channel_username, message_id) do update set
    text = excluded.text, entities = excluded.entities, attachments = excluded.attachments,
    published_at = excluded.published_at, source_revision_at = excluded.source_revision_at,
    source_kind = excluded.source_kind, media_group_id = excluded.media_group_id, imported_at = now()
  where excluded.source_revision_at > current.source_revision_at
     or (excluded.source_revision_at = current.source_revision_at
         and array_position(array['public','export','bot'], excluded.source_kind)
             >= array_position(array['public','export','bot'], current.source_kind));
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
revoke all on function public.telegram_store_post(jsonb) from public, anon, authenticated;
grant execute on function public.telegram_store_post(jsonb) to service_role;

-- Public channel media can be read by anyone; there are deliberately no client write policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('telegram-media', 'telegram-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm',
        'audio/mpeg','audio/mp4','audio/ogg','audio/wav','application/pdf',
        'application/zip','application/octet-stream',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'telegram_posts') then
    alter publication supabase_realtime add table public.telegram_posts;
  end if;
end $$;
