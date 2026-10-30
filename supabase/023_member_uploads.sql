-- BYPASS 회원 올리기 권한: HTML 페이지 올리기 · 글 썸네일 그림
-- 022 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 누가 올릴 수 있나 (can_upload)
--   1) 운영진은 언제나
--   2) 운영진이 직접 '허가'한 회원 (upload_grants.granted = true)
--   3) 운영진이 '막음'으로 둔 회원은 아래 요건을 채워도 못 올림 (granted = false)
--   4) 그 밖의 회원은 운영진이 정한 요건(upload_rules)을 모두 채우면 저절로
--      예: 댓글 5개 이상 · 글 1개 이상 · 가입 7일 이상 (0 은 따지지 않음). '자동 허가'를 끄면 직접 허가한 사람만
-- 올리는 것
--   - HTML 페이지: 사이트의 /apps/<주소이름>/ (Edge Function publish-wiki 가 대신 저장. 남의 페이지는 덮어쓰지 못함)
--   - 썸네일 그림: 저장소 post-thumbs/<내 회원번호>/… (2MB 이하 PNG·JPG·WebP·GIF), 내 글의 thumb_url 로 연결

-- ===== 1) 요건 · 개별 허가 =====
create table if not exists public.upload_rules (
  id            int primary key default 1 check (id = 1),
  auto          boolean not null default true,
  min_comments  int not null default 5 check (min_comments between 0 and 1000),
  min_posts     int not null default 0 check (min_posts between 0 and 1000),
  min_days      int not null default 0 check (min_days between 0 and 3650),
  max_pages     int not null default 5 check (max_pages between 1 and 100),   -- 한 사람이 가질 수 있는 페이지 수
  updated_at    timestamptz not null default now()
);
insert into public.upload_rules (id) values (1) on conflict (id) do nothing;
drop trigger if exists upload_rules_touch on public.upload_rules;
create trigger upload_rules_touch before update on public.upload_rules for each row execute function public.bypass_touch_updated_at();

create table if not exists public.upload_grants (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  granted     boolean not null,                -- true: 허가, false: 막음
  note        text check (note is null or char_length(note) <= 200),
  by_name     text,
  updated_at  timestamptz not null default now()
);
drop trigger if exists upload_grants_touch on public.upload_grants;
create trigger upload_grants_touch before update on public.upload_grants for each row execute function public.bypass_touch_updated_at();

alter table public.upload_rules  enable row level security;
alter table public.upload_grants enable row level security;
revoke all on public.upload_rules, public.upload_grants from anon, authenticated;
grant select on public.upload_rules to authenticated;
grant update (auto, min_comments, min_posts, min_days, max_pages) on public.upload_rules to authenticated;
grant select, insert (user_id, granted, note), update (granted, note), delete on public.upload_grants to authenticated;
drop policy if exists "올리기 요건 읽기" on public.upload_rules;
create policy "올리기 요건 읽기" on public.upload_rules for select to authenticated using (true);
drop policy if exists "올리기 요건 고치기: 운영진" on public.upload_rules;
create policy "올리기 요건 고치기: 운영진" on public.upload_rules for update to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');
drop policy if exists "개별 허가 읽기: 본인·운영진" on public.upload_grants;
create policy "개별 허가 읽기: 본인·운영진" on public.upload_grants for select to authenticated
  using (user_id = (select auth.uid()) or (select public.bypass_role()) = 'staff');
drop policy if exists "개별 허가 바꾸기: 운영진" on public.upload_grants;
create policy "개별 허가 바꾸기: 운영진" on public.upload_grants for all to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');

-- 허가한 운영진 이름 남기기
create or replace function public.upload_grants_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', '운영진')
    into new.by_name from auth.users u where u.id = auth.uid();
  return new;
end;
$$;
drop trigger if exists upload_grants_by on public.upload_grants;
create trigger upload_grants_by before insert or update on public.upload_grants for each row execute function public.upload_grants_stamp();

-- ===== 2) 권한 판단 =====
-- 지금 나의 상태: 허가 여부와 이유, 요건별 진행 (커뮤니티 화면에 보여 줌)
create or replace function public.upload_status(p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := coalesce(p_user, auth.uid());
  r public.upload_rules;
  g public.upload_grants;
  n_comments int; n_posts int; n_days int; n_pages int; joined timestamptz; who text;
  ok boolean; why text;
begin
  if uid is null then return jsonb_build_object('allowed', false, 'reason', 'login'); end if;
  -- 다른 사람의 상태는 운영진만
  if uid is distinct from auth.uid() and (select public.bypass_role()) is distinct from 'staff' then
    raise exception 'staff only' using errcode = '42501';
  end if;
  select * into r from public.upload_rules where id = 1;
  select * into g from public.upload_grants where user_id = uid;
  select created_at, coalesce(raw_app_meta_data ->> 'bypass_role', 'general') into joined, who from auth.users where id = uid;
  select count(*) into n_comments from public.post_comments where author = uid;
  select count(*) into n_posts from public.posts where author = uid;
  select count(*) into n_pages from public.user_pages where owner = uid;
  n_days := greatest(0, floor(extract(epoch from (now() - coalesce(joined, now()))) / 86400)::int);
  if who = 'staff' then ok := true; why := 'staff';
  elsif g.user_id is not null and g.granted then ok := true; why := 'granted';
  elsif g.user_id is not null and not g.granted then ok := false; why := 'blocked';
  elsif not coalesce(r.auto, false) then ok := false; why := 'manual';
  elsif n_comments >= r.min_comments and n_posts >= r.min_posts and n_days >= r.min_days then ok := true; why := 'rules';
  else ok := false; why := 'rules';
  end if;
  return jsonb_build_object(
    'allowed', ok, 'reason', why,
    'comments', n_comments, 'posts', n_posts, 'days', n_days, 'pages', n_pages,
    'rules', jsonb_build_object('auto', r.auto, 'min_comments', r.min_comments, 'min_posts', r.min_posts, 'min_days', r.min_days, 'max_pages', r.max_pages),
    'note', case when ok then null else g.note end
  );
end;
$$;

create or replace function public.can_upload(p_user uuid default null)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((public.upload_status(coalesce(p_user, auth.uid())) ->> 'allowed')::boolean, false) $$;

-- ===== 3) 회원이 올린 페이지 기록 · 너무 잦은 올리기 막기 =====
-- 실제 파일은 GitHub 저장소 apps/<주소이름>/index.html. 누가 주인인지는 파일 안의 <meta name="bypass-owner"> 로 Edge Function 이 확인한다.
create table if not exists public.user_pages (
  slug        text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  owner       uuid references auth.users (id) on delete set null,
  owner_name  text,
  title       text check (title is null or char_length(title) <= 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  publishes   int not null default 1
);
create table if not exists public.page_publishes (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  user_id  uuid references auth.users (id) on delete cascade,
  slug     text not null
);
create index if not exists page_publishes_user_at_idx on public.page_publishes (user_id, at);
alter table public.user_pages     enable row level security;
alter table public.page_publishes enable row level security;
revoke all on public.user_pages, public.page_publishes from anon, authenticated;
grant select on public.user_pages to authenticated;
grant delete on public.user_pages to authenticated;
drop policy if exists "회원 페이지 읽기" on public.user_pages;
create policy "회원 페이지 읽기" on public.user_pages for select to authenticated using (true);
drop policy if exists "회원 페이지 기록 지우기: 운영진" on public.user_pages;
create policy "회원 페이지 기록 지우기: 운영진" on public.user_pages for delete to authenticated
  using ((select public.bypass_role()) = 'staff');

-- Edge Function 이 회원의 로그인으로 부른다: 권한·한 시간 10번·페이지 수를 확인하고 기록
create or replace function public.note_page_publish(p_slug text, p_title text, p_new boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st jsonb := public.upload_status(auth.uid());
  recent int; mine int; nm text; staff boolean := (select public.bypass_role()) = 'staff';
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '42501'; end if;
  if not (st ->> 'allowed')::boolean then raise exception 'upload not allowed' using errcode = '42501'; end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,48}$' then raise exception 'bad slug' using errcode = '22023'; end if;
  if not staff then
    select count(*) into recent from public.page_publishes where user_id = auth.uid() and at > now() - interval '1 hour';
    if recent >= 10 then raise exception 'too many publishes' using errcode = '22023'; end if;
    if p_new then
      select count(*) into mine from public.user_pages where owner = auth.uid();
      if mine >= (st -> 'rules' ->> 'max_pages')::int then raise exception 'too many pages' using errcode = '22023'; end if;
    end if;
  end if;
  select coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', '회원') into nm from auth.users u where u.id = auth.uid();
  insert into public.page_publishes (user_id, slug) values (auth.uid(), p_slug);
  insert into public.user_pages (slug, owner, owner_name, title) values (p_slug, auth.uid(), nm, left(nullif(btrim(coalesce(p_title, '')), ''), 100))
  on conflict (slug) do update set title = coalesce(excluded.title, public.user_pages.title), updated_at = now(),
    publishes = public.user_pages.publishes + 1,
    owner = coalesce(public.user_pages.owner, excluded.owner), owner_name = coalesce(public.user_pages.owner_name, excluded.owner_name);
  return jsonb_build_object('ok', true);
end;
$$;

-- ===== 4) 글 썸네일 =====
alter table public.posts add column if not exists thumb_url text;
alter table public.posts drop constraint if exists posts_thumb_url_check;
alter table public.posts add constraint posts_thumb_url_check check (
  thumb_url is null or (char_length(thumb_url) <= 500 and thumb_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/post-thumbs/[0-9a-f-]{36}/[A-Za-z0-9._-]+$')
);
grant insert (thumb_url), update (thumb_url) on public.posts to authenticated;

-- 썸네일은 올리기 권한이 있는 사람이, 자기 폴더의 그림만 (운영진은 남의 글 썸네일을 지울 수 있음)
create or replace function public.posts_thumb_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.thumb_url is not null and new.thumb_url is distinct from (case when tg_op = 'UPDATE' then old.thumb_url end) then
    if not public.can_upload(auth.uid()) then raise exception 'upload not allowed' using errcode = '42501'; end if;
    if position('/post-thumbs/' || auth.uid()::text || '/' in new.thumb_url) = 0 then
      raise exception 'not your image' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists posts_thumb on public.posts;
create trigger posts_thumb before insert or update of thumb_url on public.posts for each row execute function public.posts_thumb_check();

-- 목록 보기에 썸네일 칸 더하기 (뒤에 붙여야 바꿀 수 있다)
create or replace view public.post_feed
with (security_invoker = true) as
select p.id, p.created_at, p.updated_at, p.kind, p.category, p.title, p.body, p.url, p.author, p.author_name, p.hidden,
       (select count(*) from public.post_likes l where l.post_id = p.id) as likes,
       (select count(*) from public.post_comments c where c.post_id = p.id) as comments,
       exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())) as liked,
       p.thumb_url
  from public.posts p;
revoke all on public.post_feed from anon, authenticated;
grant select on public.post_feed to authenticated;

-- 그림 저장소: 누구나 볼 수 있고(공개 주소), 올리기는 권한 있는 회원이 자기 폴더에만
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-thumbs', 'post-thumbs', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "썸네일: 내 폴더 보기" on storage.objects;
create policy "썸네일: 내 폴더 보기" on storage.objects for select to authenticated
  using (bucket_id = 'post-thumbs' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.bypass_role()) = 'staff'));
drop policy if exists "썸네일: 올리기" on storage.objects;
create policy "썸네일: 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-thumbs' and (storage.foldername(name))[1] = (select auth.uid())::text and public.can_upload((select auth.uid())));
drop policy if exists "썸네일: 지우기" on storage.objects;
create policy "썸네일: 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'post-thumbs' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.bypass_role()) = 'staff'));

-- ===== 5) 운영진: 회원별 올리기 현황 =====
create or replace function public.upload_overview()
returns table (id uuid, username text, display_name text, role text, created_at timestamptz,
               comments bigint, posts bigint, pages bigint, granted boolean, note text, allowed boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select public.bypass_role()) is distinct from 'staff' then raise exception 'staff only' using errcode = '42501'; end if;
  return query
  select u.id,
         coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
         coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
         coalesce(u.raw_app_meta_data ->> 'bypass_role', 'general'),
         u.created_at,
         (select count(*) from public.post_comments c where c.author = u.id),
         (select count(*) from public.posts p where p.author = u.id),
         (select count(*) from public.user_pages g2 where g2.owner = u.id),
         g.granted, g.note,
         (s.v ->> 'allowed')::boolean, s.v ->> 'reason'
    from auth.users u
    left join public.upload_grants g on g.user_id = u.id
    cross join lateral (select public.upload_status(u.id) as v) s
   order by u.created_at desc
   limit 500;
end;
$$;

revoke all on function public.upload_status(uuid), public.can_upload(uuid), public.note_page_publish(text, text, boolean), public.upload_overview() from public, anon;
grant execute on function public.upload_status(uuid), public.can_upload(uuid), public.note_page_publish(text, text, boolean), public.upload_overview() to authenticated;

-- 확인
select * from public.upload_rules;
