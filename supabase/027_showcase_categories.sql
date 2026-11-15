-- BYPASS: 결과물 분류를 '형태(앱·위키·도구·실험)'에서 '쓰임(학습 · 학교생활 · 실무 스킬 · 실험실)'으로 바꾸고, HQ에서 관리
-- 026 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 바뀌는 것
--   1) 분류 표 showcase_categories: 이름·설명·색·순서를 HQ › 결과물 › 분류에서 고칩니다 (운영진만)
--        학습 / 학교생활 / 실무 스킬 / 실험실 / 미분류(운영진만 고름)
--   2) 이미 올라온 결과물은 제목·주소를 보고 새 분류로 옮깁니다. 못 정한 것은 '미분류' →
--      HQ › 결과물에서 '미분류'만 골라 보고 하나씩 정해 주세요.
--   3) 추천 고정(pin_rank): 운영진이 고른 결과물을 커뮤니티 결과물 맨 위에 순서대로 보입니다
--   4) 분류 이름 바꾸기·지우기 함수 (그 분류에 있던 결과물도 함께 옮김)
-- 게시판 말머리(질문·팁·자랑·잡담)는 그대로입니다.

begin;

-- ===== 1) 분류 표 =====
create table if not exists public.showcase_categories (
  name        text primary key check (char_length(btrim(name)) between 1 and 20 and name = btrim(name) and name !~ '[<>"]'),
  description text check (description is null or char_length(description) <= 80),
  color       text not null default 'gray' check (color in ('blue', 'violet', 'orange', 'green', 'teal', 'rose', 'gray')),
  sort        int not null default 0,
  pickable    boolean not null default true,      -- 회원이 결과물을 올릴 때 고를 수 있나 ('미분류'는 운영진만)
  created_at  timestamptz not null default now()
);

alter table public.showcase_categories enable row level security;
revoke all on public.showcase_categories from anon, authenticated;
grant select on public.showcase_categories to anon, authenticated;
grant insert, update, delete on public.showcase_categories to authenticated;

drop policy if exists "분류: 누구나 읽기" on public.showcase_categories;
create policy "분류: 누구나 읽기" on public.showcase_categories for select to anon, authenticated using (true);
drop policy if exists "분류: 운영진 쓰기" on public.showcase_categories;
create policy "분류: 운영진 쓰기" on public.showcase_categories for insert to authenticated with check ((select public.bypass_role()) = 'staff');
drop policy if exists "분류: 운영진 고치기" on public.showcase_categories;
create policy "분류: 운영진 고치기" on public.showcase_categories for update to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');
drop policy if exists "분류: 운영진 지우기" on public.showcase_categories;
create policy "분류: 운영진 지우기" on public.showcase_categories for delete to authenticated using ((select public.bypass_role()) = 'staff');

insert into public.showcase_categories (name, description, color, sort, pickable) values
  ('학습',      '해기사 시험, 항해·기관 과목, 시뮬레이터, 토익·해사영어', 'blue',   10, true),
  ('학교생활',  '수강·학점·시험 일정, 학식, 카톡 채널',                 'green',  20, true),
  ('실무 스킬', '엑셀·문서·PDF처럼 졸업 뒤에도 쓰는 것',                'orange', 30, true),
  ('실험실',    '만드는 중이거나 재미로 만든 것',                        'rose',   40, true),
  ('미분류',    '운영진이 분류를 정하기 전',                            'gray',   99, false)
on conflict (name) do nothing;

-- ===== 2) 결과물 분류 규칙: 표에 있는 이름만 =====
alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts add constraint posts_category_check check (
  (kind = 'post' and category in ('질문', '팁', '자랑', '잡담'))
  or (kind = 'showcase' and char_length(btrim(category)) between 1 and 20)
);

create or replace function public.posts_showcase_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ok boolean;
begin
  if new.kind = 'showcase' and (tg_op = 'INSERT' or new.category is distinct from old.category or new.kind is distinct from old.kind) then
    select c.pickable into ok from public.showcase_categories c where c.name = new.category;
    if ok is null then raise exception 'unknown showcase category' using errcode = '23514'; end if;
    -- 회원은 '미분류'처럼 고를 수 없는 분류로 올리거나 옮기지 못한다 (SQL Editor 처럼 로그인 없이 돌리는 건 허용)
    if not ok and auth.uid() is not null and (select public.bypass_role()) is distinct from 'staff' then
      raise exception 'staff only category' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists posts_category on public.posts;
create trigger posts_category before insert or update of category, kind on public.posts
  for each row execute function public.posts_showcase_category();

-- ===== 3) 추천 고정 =====
alter table public.posts add column if not exists pin_rank smallint;
alter table public.posts drop constraint if exists posts_pin_rank_check;
alter table public.posts add constraint posts_pin_rank_check check (pin_rank is null or (kind = 'showcase' and pin_rank between 1 and 99));
grant update (pin_rank) on public.posts to authenticated;

create or replace function public.posts_pin_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pin_rank is distinct from old.pin_rank and auth.uid() is not null and (select public.bypass_role()) is distinct from 'staff' then
    raise exception 'staff only' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists posts_pin on public.posts;
create trigger posts_pin before update of pin_rank on public.posts for each row execute function public.posts_pin_guard();

-- 커뮤니티 도장: 분류·숨김·추천을 바꿔도 '고침'이 붙지 않게 (내용이 바뀔 때만 updated_at)
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
    -- '고침' 표시는 글 내용(제목·본문·주소·썸네일)이 바뀔 때만. 분류·숨김·추천만 바꾸면 그대로 둔다
    if coalesce(current_setting('bypass.bulk', true), '') <> '1'
       and (new.title, new.body, new.url, new.thumb_url) is distinct from (old.title, old.body, old.url, old.thumb_url) then
      new.updated_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- ===== 4) 이미 올라온 결과물 옮기기 (예전 분류 앱·위키·도구·실험인 것만) =====
alter table public.posts disable trigger posts_stamp;
update public.posts p
   set category = case
     when p.category = '실험' then '실험실'
     when (p.title || ' ' || coalesce(p.url, '')) ~* '(토익|toeic|\mrc\M|영어|영단어|smcp|alfa|zulu|english)' then '학습'
     when (p.title || ' ' || coalesce(p.url, '')) ~* '(엑셀|excel|pdf|문서|워드|한글 ?파일|ppt|코딩|python)' then '실무 스킬'
     when (p.title || ' ' || coalesce(p.url, '')) ~* '(수강|플래너|학점|시간표|학사|mymmu|eesuu|examplan|시험 ?일정|학식|꿀꿀|식단|기숙사|셔틀|pf\.kakao)' then '학교생활'
     when p.category = '위키'
       or (p.title || ' ' || coalesce(p.url, '')) ~* '(해기사|cbt|ecdis|colreg|marpol|레이더|radar|항해|기관|계기|탱커|선박|해양|해사|사고|allision|ra006)' then '학습'
     else '미분류'
   end
 where p.kind = 'showcase' and p.category in ('앱', '위키', '도구', '실험');
alter table public.posts enable trigger posts_stamp;

-- ===== 5) 분류 이름 바꾸기 · 지우기 (운영진) =====
create or replace function public.showcase_category_rename(p_old text, p_new text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.bypass_role()) is distinct from 'staff' then raise exception 'staff only' using errcode = '42501'; end if;
  p_new := btrim(coalesce(p_new, ''));
  if p_new = p_old then return; end if;
  insert into public.showcase_categories (name, description, color, sort, pickable, created_at)
    select p_new, c.description, c.color, c.sort, c.pickable, c.created_at from public.showcase_categories c where c.name = p_old;
  if not found then raise exception 'no such category' using errcode = 'P0002'; end if;
  perform set_config('bypass.bulk', '1', true);
  update public.posts set category = p_new where kind = 'showcase' and category = p_old;
  perform set_config('bypass.bulk', '', true);
  delete from public.showcase_categories where name = p_old;
end;
$$;

create or replace function public.showcase_category_delete(p_name text, p_move_to text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.bypass_role()) is distinct from 'staff' then raise exception 'staff only' using errcode = '42501'; end if;
  if exists (select 1 from public.posts where kind = 'showcase' and category = p_name) then
    if p_move_to is null or p_move_to = p_name then raise exception 'category not empty' using errcode = '23503'; end if;
    perform set_config('bypass.bulk', '1', true);
    update public.posts set category = p_move_to where kind = 'showcase' and category = p_name;
    perform set_config('bypass.bulk', '', true);
  end if;
  delete from public.showcase_categories where name = p_name;
end;
$$;

revoke all on function public.showcase_category_rename(text, text) from public, anon;
revoke all on function public.showcase_category_delete(text, text) from public, anon;
grant execute on function public.showcase_category_rename(text, text) to authenticated;
grant execute on function public.showcase_category_delete(text, text) to authenticated;

-- ===== 6) 목록용 보기: 추천 고정 순서 추가 (맨 끝에) =====
create or replace view public.post_feed
with (security_invoker = true) as
select p.id, p.created_at, p.updated_at, p.kind, p.category, p.title, p.body, p.url, p.author, p.author_name, p.hidden,
       (select count(*) from public.post_likes l where l.post_id = p.id) as likes,
       (select count(*) from public.post_comments c where c.post_id = p.id) as comments,
       exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())) as liked,
       p.thumb_url,
       p.pin_rank
  from public.posts p;
revoke all on public.post_feed from anon, authenticated;
grant select on public.post_feed to authenticated;

commit;

-- 확인: 분류별 결과물 수 ('미분류'가 있으면 HQ › 결과물에서 정해 주세요)
select c.sort as "순서", c.name as "분류", count(p.id) as "결과물 수"
  from public.showcase_categories c
  left join public.posts p on p.kind = 'showcase' and p.category = c.name
 group by c.sort, c.name order by c.sort;
