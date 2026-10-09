-- Applied via Supabase MCP; filename matches the recorded remote migration version.
-- Extend the existing grade checks only. Data, grants and RLS stay unchanged.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.post_authors
  drop constraint post_authors_grade_check,
  add constraint post_authors_grade_check check (grade in (7,8,9,10,11,12));

alter table public.posts
  drop constraint posts_grade_check,
  add constraint posts_grade_check check (grade in (7,8,9,10,11,12));

alter table public.forum_topics
  drop constraint forum_topics_grade_check,
  add constraint forum_topics_grade_check check (grade in (7,8,9,10,11,12));
