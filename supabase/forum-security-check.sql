-- Live permission/integrity checks; all fixtures disappear at ROLLBACK.
begin;
insert into auth.users (id,email,email_confirmed_at,is_anonymous) values
('10000000-0000-4000-8000-000000000001','forum-one@example.invalid',now(),false),
('10000000-0000-4000-8000-000000000002','forum-two@example.invalid',now(),false),
('10000000-0000-4000-8000-000000000003','forum-pending@example.invalid',null,false);
insert into public.profiles (id,name) values
('10000000-0000-4000-8000-000000000001','First author'),
('10000000-0000-4000-8000-000000000002','Second author'),
('10000000-0000-4000-8000-000000000003','Pending author');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into public.forum_topics(author_id,title,body,grade,category) values
('10000000-0000-4000-8000-000000000001','Почему спутники остаются на орбите?','Обсуждаем силу притяжения и движение спутника по орбите.',9,'mechanics'),
('10000000-0000-4000-8000-000000000001','Как преломляется свет?','Разбираем преломление света и поведение лучей на границе двух сред.',8,'optics');
do $$
declare t uuid; other_t uuid; c uuid; n integer;
begin
  select id into t from public.forum_topics where title='Почему спутники остаются на орбите?';
  select id into other_t from public.forum_topics where title='Как преломляется свет?';
  if not exists (select 1 from public.forum_topics where id=t and author_name='First author'
    and search_document @@ websearch_to_tsquery('russian','спутник')) then raise exception 'Snapshot/search failed'; end if;
  insert into public.forum_comments(topic_id,author_id,body) values(t,auth.uid(),'Нужно учесть начальную скорость спутника.') returning id into c;
  insert into public.forum_comments(topic_id,author_id,body,parent_id) values(t,auth.uid(),'Согласен, скорость направлена по касательной.',c);
  if (select comment_count from public.forum_topics where id=t) <> 2 then raise exception 'Comment count failed'; end if;
  begin
    insert into public.forum_comments(topic_id,author_id,body,parent_id) values(other_t,auth.uid(),'Cross topic reply',c);
    raise exception 'Cross topic reply accepted';
  exception when foreign_key_violation then null; end;
  insert into public.forum_likes(topic_id,user_id) values(t,auth.uid());
  begin
    insert into public.forum_likes(topic_id,user_id) values(t,auth.uid());
    raise exception 'Duplicate like accepted';
  exception when unique_violation then null; end;
  if (select like_count from public.forum_topics where id=t) <> 1 then raise exception 'Like counter failed'; end if;
  delete from public.forum_likes where topic_id=t and user_id=auth.uid();
  if (select like_count from public.forum_topics where id=t) <> 0 then raise exception 'Unlike failed'; end if;
  insert into public.forum_likes(topic_id,user_id) values(t,auth.uid());
  begin
    update public.forum_topics set view_count=10000 where id=t;
    raise exception 'Counter spoof accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.forum_topics(author_id,title,body,category,author_name) values(auth.uid(),'Forged author','Long enough example body for a topic.','general','Admin');
    raise exception 'Author name spoof accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.forum_topics(author_id,title,body,category) values(auth.uid(),'Bad category','Long enough example body for a topic.','bad');
    raise exception 'Invalid category accepted';
  exception when check_violation then null; end;
  begin
    insert into public.forum_topics(author_id,title,body,category) values('10000000-0000-4000-8000-000000000002','Forged owner','Long enough example body for a topic.','general');
    raise exception 'Author ID spoof accepted';
  exception when insufficient_privilege then null;
    when raise_exception then if sqlerrm <> 'Author profile unavailable' then raise; end if;
  end;
  if public.forum_record_view(t,'20000000-0000-4000-8000-000000000001') <> 1 then raise exception 'Account view failed'; end if;
  if public.forum_record_view(t,'20000000-0000-4000-8000-000000000002') <> 1 then raise exception 'Account view dedup failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$
declare t uuid; n integer;
begin
  select id into t from public.forum_topics where title='Почему спутники остаются на орбите?';
  select count(*) into n from public.forum_likes;
  if n <> 0 then raise exception 'Private likes exposed'; end if;
  delete from public.forum_likes where topic_id=t;
  if (select like_count from public.forum_topics where id=t) <> 1 then raise exception 'Removed another account like'; end if;
  begin
    insert into public.forum_likes(topic_id,user_id) values(t,'10000000-0000-4000-8000-000000000001');
    raise exception 'Like ownership spoof accepted';
  exception when insufficient_privilege then null; end;
  insert into public.forum_comments(topic_id,author_id,body) values(t,auth.uid(),'Ответ от другого участника.');
  if (select comment_count from public.forum_topics where id=t) <> 3 then raise exception 'Member comment failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","user_metadata":{"email_verified":true}}',true);
set local role authenticated;
do $$
declare t uuid;
begin
  select id into t from public.forum_topics limit 1;
  begin
    insert into public.forum_likes(topic_id,user_id) values(t,auth.uid());
    raise exception 'Unconfirmed user liked';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.forum_comments(topic_id,author_id,body) values(t,auth.uid(),'Unconfirmed comment');
    raise exception 'Unconfirmed user commented';
  exception when insufficient_privilege then null;
    when raise_exception then if sqlerrm <> 'Author profile unavailable' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$
declare t uuid; n integer;
begin
  select id into t from public.forum_topics where title='Почему спутники остаются на орбите?';
  select count(*) into n from public.forum_comments where topic_id=t;
  if n <> 3 then raise exception 'Guest cannot read comments'; end if;
  begin
    insert into public.forum_topics(author_id,title,body,category) values('10000000-0000-4000-8000-000000000001','Guest topic','This guest must not be allowed to post.','general');
    raise exception 'Guest created topic';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.forum_comments(topic_id,author_id,body) values(t,'10000000-0000-4000-8000-000000000001','Guest reply');
    raise exception 'Guest commented';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.forum_likes(topic_id,user_id) values(t,'10000000-0000-4000-8000-000000000001');
    raise exception 'Guest liked';
  exception when insufficient_privilege then null; end;
  if public.forum_record_view(t,'20000000-0000-4000-8000-000000000001') <> 2 then raise exception 'Guest view failed'; end if;
  if public.forum_record_view(t,'20000000-0000-4000-8000-000000000001') <> 2 then raise exception 'Reload inflated views'; end if;
  if public.forum_record_view(t,'20000000-0000-4000-8000-000000000002') <> 3 then raise exception 'Second reader not counted'; end if;
  begin
    perform 1 from private.forum_views;
    raise exception 'Visitor keys exposed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
