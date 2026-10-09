begin;
insert into auth.users (id,email,email_confirmed_at,is_anonymous) values
('00000000-0000-4000-8000-000000000001','verified-one@example.invalid',now(),false),
('00000000-0000-4000-8000-000000000002','verified-two@example.invalid',now(),false),
('00000000-0000-4000-8000-000000000003','unconfirmed@example.invalid',null,false);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into public.profiles (id,name,bio) values ('00000000-0000-4000-8000-000000000001','Test One','');
do $$ begin
  if not private.verified_account() then raise exception 'Verified account blocked'; end if;
  begin
    insert into public.posts (grade,text,author_id) values (7,'Denied test','00000000-0000-4000-8000-000000000001');
    raise exception 'Missing author permission was bypassed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.post_authors (user_id,grade) values ('00000000-0000-4000-8000-000000000001',7);
    raise exception 'Self role escalation succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into public.profiles (id,name,bio) values ('00000000-0000-4000-8000-000000000002','Test Two','');
do $$ declare n integer; begin
  select count(*) into n from public.profiles;
  if n != 1 then raise exception 'Other profiles leaked'; end if;
  update public.profiles set bio = 'attack' where id = '00000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n != 0 then raise exception 'Cross-user update succeeded'; end if;
end $$;
reset role;
insert into public.post_authors (user_id,grade) values ('00000000-0000-4000-8000-000000000001',7);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into public.posts (grade,text,author_id) values (7,'Allowed test','00000000-0000-4000-8000-000000000001');
do $$ declare n integer; begin
  select count(*) into n from public.posts where text = 'Allowed test' and author_name = 'Test One';
  if n != 1 then raise exception 'Trusted author snapshot failed'; end if;
  begin
    insert into public.posts (grade,text,author_id) values (8,'Wrong grade','00000000-0000-4000-8000-000000000001');
    raise exception 'Wrong grade was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.posts (grade,text,author_id,author_name) values (7,'Spoof','00000000-0000-4000-8000-000000000001','Other author');
    raise exception 'Author spoof succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.posts (grade,text,author_id) values (7,'Wrong owner','00000000-0000-4000-8000-000000000002');
    raise exception 'Other owner was allowed';
  exception when insufficient_privilege then null;
    when raise_exception then if sqlerrm <> 'Author profile unavailable' then raise; end if;
  end;
  update public.profiles set bio = 'Saved' where id = '00000000-0000-4000-8000-000000000001';
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","email_verified":true,"user_metadata":{"role":"admin","email_verified":true}}',true);
set local role authenticated;
do $$ begin
  if private.verified_account() then raise exception 'Editable claims bypassed email confirmation'; end if;
  begin
    insert into public.profiles (id,name,bio) values ('00000000-0000-4000-8000-000000000003','Unverified','');
    raise exception 'Unverified profile insert succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ declare n integer; begin
  select count(*) into n from public.posts;
  if n != 1 then raise exception 'Public posts unavailable'; end if;
  begin
    perform 1 from public.profiles;
    raise exception 'Private profiles accessible anonymously';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
