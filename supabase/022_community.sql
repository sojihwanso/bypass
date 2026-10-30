-- BYPASS 커뮤니티: 회원이 올리는 결과물 · 게시판 글 · 댓글 · 좋아요
-- 021 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 누가 무엇을 하나 (로그인한 회원 = 일반 회원·국원·운영진 모두)
--   읽기   : 로그인한 회원 모두. 숨긴 글은 쓴 사람과 운영진만
--   쓰기   : 로그인한 회원 모두 (10분에 글 5개, 댓글 20개까지)
--   고치기 : 쓴 사람 (제목·내용·주소·분류). 숨기기는 운영진만
--   지우기 : 쓴 사람 또는 운영진
--   좋아요 : 한 사람이 글마다 한 번
-- 로그인하지 않은 방문자는 아무것도 볼 수 없습니다.

-- ===== 1) 표 =====
create table if not exists public.posts (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  kind         text not null check (kind in ('post', 'showcase')),     -- post: 게시판 글, showcase: 결과물
  category     text not null,
  title        text not null check (char_length(btrim(title)) between 1 and 100),
  body         text check (body is null or char_length(body) <= 5000),
  url          text check (url is null or (char_length(url) <= 1000 and (url ~* '^https://[^\s<>"]+$' or url ~ '^/[A-Za-z0-9/_.~%-]*$'))),
  author       uuid references auth.users (id) on delete set null,
  author_name  text,
  hidden       boolean not null default false,
  constraint posts_category_check check (
    (kind = 'post' and category in ('질문', '팁', '자랑', '잡담'))
    or (kind = 'showcase' and category in ('앱', '위키', '도구', '실험'))
  ),
  constraint posts_showcase_url check (kind <> 'showcase' or url is not null)
);
create index if not exists posts_kind_created_idx on public.posts (kind, created_at desc);
create index if not exists posts_author_idx on public.posts (author);

create table if not exists public.post_comments (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  post_id      bigint not null references public.posts (id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 1000),
  author       uuid references auth.users (id) on delete set null,
  author_name  text
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

create table if not exists public.post_likes (
  post_id     bigint not null references public.posts (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ===== 2) 쓴 사람 이름 · 너무 잦은 글 막기 · 숨기기는 운영진만 =====
create or replace function public.community_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then raise exception 'login required' using errcode = '42501'; end if;
    new.author := auth.uid();
    select coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', '회원')
      into new.author_name from auth.users u where u.id = auth.uid();
    new.author_name := coalesce(new.author_name, '회원');
    new.created_at := now();
    if tg_table_name = 'posts' then
      new.hidden := false;
      select count(*) into recent from public.posts where author = auth.uid() and created_at > now() - interval '10 minutes';
      if recent >= 5 then raise exception 'too many posts' using errcode = '22023'; end if;
    else
      select count(*) into recent from public.post_comments where author = auth.uid() and created_at > now() - interval '10 minutes';
      if recent >= 20 then raise exception 'too many comments' using errcode = '22023'; end if;
    end if;
  else  -- UPDATE (posts)
    if new.hidden is distinct from old.hidden and (select public.bypass_role()) is distinct from 'staff' then
      raise exception 'staff only' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists posts_stamp on public.posts;
create trigger posts_stamp before insert or update on public.posts for each row execute function public.community_stamp();
drop trigger if exists post_comments_stamp on public.post_comments;
create trigger post_comments_stamp before insert on public.post_comments for each row execute function public.community_stamp();

-- ===== 3) 권한 =====
alter table public.posts         enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes    enable row level security;
revoke all on public.posts, public.post_comments, public.post_likes from anon, authenticated;

grant select, delete on public.posts to authenticated;
grant insert (kind, category, title, body, url) on public.posts to authenticated;
grant update (category, title, body, url, hidden) on public.posts to authenticated;
grant select, delete on public.post_comments to authenticated;
grant insert (post_id, body) on public.post_comments to authenticated;
grant select, insert (post_id), delete on public.post_likes to authenticated;

drop policy if exists "글 읽기" on public.posts;
create policy "글 읽기" on public.posts for select to authenticated
  using (not hidden or author = (select auth.uid()) or (select public.bypass_role()) = 'staff');
drop policy if exists "글 쓰기" on public.posts;
create policy "글 쓰기" on public.posts for insert to authenticated
  with check ((select auth.uid()) is not null);
drop policy if exists "글 고치기" on public.posts;
create policy "글 고치기" on public.posts for update to authenticated
  using (author = (select auth.uid()) or (select public.bypass_role()) = 'staff')
  with check (author = (select auth.uid()) or (select public.bypass_role()) = 'staff');
drop policy if exists "글 지우기" on public.posts;
create policy "글 지우기" on public.posts for delete to authenticated
  using (author = (select auth.uid()) or (select public.bypass_role()) = 'staff');

-- 댓글: 읽을 수 있는 글에만 (posts 의 읽기 규칙을 그대로 따른다)
drop policy if exists "댓글 읽기" on public.post_comments;
create policy "댓글 읽기" on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "댓글 쓰기" on public.post_comments;
create policy "댓글 쓰기" on public.post_comments for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and not p.hidden));
drop policy if exists "댓글 지우기" on public.post_comments;
create policy "댓글 지우기" on public.post_comments for delete to authenticated
  using (author = (select auth.uid()) or (select public.bypass_role()) = 'staff');

drop policy if exists "좋아요 읽기" on public.post_likes;
create policy "좋아요 읽기" on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "좋아요 누르기" on public.post_likes;
create policy "좋아요 누르기" on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id and not p.hidden));
drop policy if exists "좋아요 취소" on public.post_likes;
create policy "좋아요 취소" on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- ===== 4) 목록용 보기: 좋아요·댓글 수와 내가 눌렀는지 (부르는 사람의 권한으로) =====
create or replace view public.post_feed
with (security_invoker = true) as
select p.id, p.created_at, p.updated_at, p.kind, p.category, p.title, p.body, p.url, p.author, p.author_name, p.hidden,
       (select count(*) from public.post_likes l where l.post_id = p.id) as likes,
       (select count(*) from public.post_comments c where c.post_id = p.id) as comments,
       exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())) as liked
  from public.posts p;
revoke all on public.post_feed from anon, authenticated;
grant select on public.post_feed to authenticated;

-- 확인
select kind as "종류", count(*) as "글 수" from public.posts group by kind order by 1;
