-- Transactional checks for new grades: fixtures never survive this script.
begin;
set local statement_timeout = '30s';
insert into auth.users (id,email,email_confirmed_at,is_anonymous) values
('30000000-0000-4000-8000-000000000001','grade-author@example.invalid',now(),false),
('30000000-0000-4000-8000-000000000002','grade-pending@example.invalid',null,false);
insert into public.profiles(id,name) values
('30000000-0000-4000-8000-000000000001','Grade author'),
('30000000-0000-4000-8000-000000000002','Pending author');
insert into public.post_authors(user_id,grade)
select '30000000-0000-4000-8000-000000000001'::uuid, grade from generate_series(10,12) grade;

do $$ declare bad_grade smallint; begin
  foreach bad_grade in array array[6,13]::smallint[] loop
    begin
      insert into public.post_authors(user_id,grade) values ('30000000-0000-4000-8000-000000000001',bad_grade);
      raise exception 'Invalid author grade accepted';
    exception when check_violation then null; end;
    begin
      insert into public.posts(grade,text,author_id) values (bad_grade,'Invalid grade','30000000-0000-4000-8000-000000000001');
      raise exception 'Invalid post grade accepted';
    exception when check_violation then null; end;
  end loop;
end $$;

select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare school_grade smallint; begin
  for school_grade in 10..12 loop
    insert into public.posts(grade,text,author_id) values (school_grade,'Grade validation fixture',auth.uid());
    insert into public.forum_topics(author_id,title,body,grade,category) values
      (auth.uid(),'Проверка класса ' || school_grade,'Проверяем сохранение обсуждения для нового класса.',school_grade,'general');
  end loop;
  insert into public.forum_topics(author_id,title,body,grade,category) values
    (auth.uid(),'Для всех классов','Проверяем, что обсуждение может быть без привязки к классу.',null,'general');
  foreach school_grade in array array[6,13]::smallint[] loop
    begin
      insert into public.forum_topics(author_id,title,body,grade,category) values
        (auth.uid(),'Недопустимый класс','Проверяем отклонение неподдерживаемого класса.',school_grade,'general');
      raise exception 'Invalid forum grade accepted';
    exception when check_violation then null; end;
  end loop;
  begin
    insert into public.posts(grade,text,author_id) values (9,'No grade permission',auth.uid());
    raise exception 'Author grade restriction bypassed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.post_authors(user_id,grade) values (auth.uid(),9);
    raise exception 'Self-author assignment allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin
    insert into public.forum_topics(author_id,title,body,grade,category) values
      (auth.uid(),'Неподтверждённый автор','Неподтверждённый аккаунт не может писать на форуме.',12,'general');
    raise exception 'Unconfirmed author accepted';
  exception when insufficient_privilege then null;
    when raise_exception then if sqlerrm <> 'Author profile unavailable' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare n integer; begin
  select count(*) into n from public.posts where author_id='30000000-0000-4000-8000-000000000001' and grade in (10,11,12);
  if n <> 3 then raise exception 'Guest cannot read new class posts'; end if;
  select count(*) into n from public.forum_topics where author_id='30000000-0000-4000-8000-000000000001' and grade in (10,11,12);
  if n <> 3 then raise exception 'Guest cannot read new class topics'; end if;
  begin
    insert into public.posts(grade,text,author_id) values (12,'Guest denied','30000000-0000-4000-8000-000000000001');
    raise exception 'Guest published a post';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.forum_topics(author_id,title,body,grade,category) values
      ('30000000-0000-4000-8000-000000000001','Гостевая публикация','Гостям доступны только чтение и фильтры, но не публикация.',12,'general');
    raise exception 'Guest published a topic';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Grades 10-12: writes, validation, author permissions, confirmation and guest access passed; fixtures rolled back.' as result;
