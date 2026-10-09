-- TerenPhys schema snapshot. Applied remotely through the Supabase migration tool.
-- No Firebase data is imported. Profile email stays private in Supabase Auth.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.verified_account()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid()) and email_confirmed_at is not null
      and coalesce(is_anonymous, false) = false
  );
$$;
revoke all on function private.verified_account() from public, anon;
grant execute on function private.verified_account() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_path text check (avatar_path is null or avatar_path = id::text || '/profile.jpg'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.post_authors (
  user_id uuid not null references public.profiles(id) on delete cascade,
  grade smallint not null check (grade in (7,8,9,10,11,12)),
  is_active boolean not null default true,
  primary key (user_id, grade)
);
create table public.posts (
  id bigint generated always as identity primary key,
  grade smallint not null check (grade in (7,8,9,10,11,12)),
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default '',
  author_avatar_path text,
  created_at timestamptz not null default now()
);
create index posts_grade_created_idx on public.posts (grade, created_at desc, id desc);
create index posts_author_id_idx on public.posts (author_id);
alter table public.profiles enable row level security;
alter table public.post_authors enable row level security;
alter table public.posts enable row level security;

revoke all on public.profiles, public.post_authors, public.posts from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, name, bio, avatar_path) on public.profiles to authenticated;
grant update (name, bio, avatar_path) on public.profiles to authenticated;
grant select on public.post_authors to authenticated;
grant select on public.posts to anon, authenticated;
grant insert (grade, text, author_id) on public.posts to authenticated;
grant usage on sequence public.posts_id_seq to authenticated;
grant all on public.profiles, public.post_authors, public.posts to service_role;
grant usage, select on sequence public.posts_id_seq to service_role;

create policy profiles_read_own on public.profiles for select to authenticated
  using ((select private.verified_account()) and id = (select auth.uid()));
create policy profiles_create_own on public.profiles for insert to authenticated
  with check ((select private.verified_account()) and id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select private.verified_account()) and id = (select auth.uid()))
  with check ((select private.verified_account()) and id = (select auth.uid()));
create policy authors_read_own on public.post_authors for select to authenticated
  using ((select private.verified_account()) and user_id = (select auth.uid()));
create policy posts_public_read on public.posts for select to anon, authenticated using (true);
create policy posts_author_create on public.posts for insert to authenticated
  with check ((select private.verified_account()) and author_id = (select auth.uid())
    and exists (select 1 from public.post_authors a
      where a.user_id = (select auth.uid()) and a.grade = posts.grade and a.is_active));

create function private.profile_timestamp()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;
revoke all on function private.profile_timestamp() from public, anon, authenticated;
create trigger profile_timestamp before update on public.profiles
  for each row execute function private.profile_timestamp();

-- Invoker rights respect the owner's profile RLS; clients cannot forge author snapshots.
create function private.post_snapshot()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  select p.name, p.avatar_path into new.author_name, new.author_avatar_path
    from public.profiles p where p.id = new.author_id;
  if new.author_name is null then raise exception 'Author profile unavailable'; end if;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function private.post_snapshot() from public, anon, authenticated;
create trigger post_snapshot before insert on public.posts
  for each row execute function private.post_snapshot();

-- Public images are used in public posts. Only the owner can upload/replace their photo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg']);
create policy avatars_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (select private.verified_account())
    and name = (select auth.uid())::text || '/profile.jpg');
create policy avatars_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (select private.verified_account())
    and name = (select auth.uid())::text || '/profile.jpg');
create policy avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (select private.verified_account())
    and name = (select auth.uid())::text || '/profile.jpg')
  with check (bucket_id = 'avatars' and (select private.verified_account())
    and name = (select auth.uid())::text || '/profile.jpg');

alter publication supabase_realtime add table public.posts;
