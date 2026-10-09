-- Diagnostic fixtures are rolled back and cannot leak into Realtime/the archive.
begin;
set local role service_role;
do $$
declare
  test_post jsonb := jsonb_build_object('channel_username','nisphysicshub','message_id',999999999,
    'text','test','entities','[]'::jsonb,'attachments','[]'::jsonb,'published_at','2026-01-01T00:00:00Z',
    'source_revision_at','2026-01-01T00:00:00Z','source_kind','bot','media_group_id',null);
begin
  perform public.telegram_store_post(test_post);
  perform public.telegram_store_post(test_post || '{"text":"edited","source_revision_at":"2026-01-01T00:01:00Z"}'::jsonb);
  perform public.telegram_store_post(test_post || '{"text":"stale","source_kind":"public"}'::jsonb);
  if (select count(*) from public.telegram_posts where message_id=999999999) <> 1
     or (select text from public.telegram_posts where message_id=999999999) <> 'edited' then
    raise exception 'Idempotency / stale edit check failed';
  end if;
end $$;
set local role anon;
do $$
begin
  if (select count(*) from public.telegram_posts) < 1 then raise exception 'Anonymous read failed'; end if;
  begin
    perform public.telegram_store_post('{}'::jsonb);
    raise exception 'Anonymous RPC should be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.telegram_sources set title='unauthorized';
    raise exception 'Anonymous source update should be denied';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role authenticated;
do $$
begin
  begin
    delete from public.telegram_posts where message_id=999999999;
    raise exception 'Member write should be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.telegram_store_post('{}'::jsonb);
    raise exception 'Member RPC should be denied';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
