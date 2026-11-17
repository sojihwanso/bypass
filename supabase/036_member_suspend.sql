-- BYPASS: 회원 활동 정지 · 회원 관리 자세히 보기
-- 035 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 활동 정지 (운영진이 HQ › 회원에서)
--   - 정지된 회원은 글·결과물·댓글·답글을 새로 쓰거나 고칠 수 없고, HTML 페이지·썸네일도 못 올립니다.
--     (읽기, 좋아요, 내 글 지우기, 로그인은 그대로)
--   - 기간: 1일·3일·7일·30일 또는 무기한. 기간이 지나면 저절로 풀립니다. 운영진이 언제든 바로 풀 수 있습니다.
--   - 사유는 정지된 본인에게 커뮤니티 위쪽 안내로 보입니다.
--   - 운영진은 정지할 수 없습니다. (먼저 회원 구분을 바꾸세요)
--   - 막는 곳은 데이터베이스 자체라, 화면을 우회해도 못 씁니다.
--
-- 회원 관리 자세히 (list_members_detail): 글·결과물·댓글 수, 받은 좋아요, 올린 페이지, 프로필 사진, 올리기 권한, 정지 상태

-- ===== 1) 정지 기록 =====
create table if not exists public.member_suspensions (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  until       timestamptz,                                   -- null = 무기한
  reason      text check (reason is null or char_length(reason) <= 200),
  by_name     text,
  created_at  timestamptz not null default now()
);
alter table public.member_suspensions enable row level security;
revoke all on public.member_suspensions from anon, authenticated;

create or replace function public.is_suspended(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.member_suspensions s where s.user_id = p_user and (s.until is null or s.until > now())) $$;
revoke all on function public.is_suspended(uuid) from public, anon;
grant execute on function public.is_suspended(uuid) to authenticated;

-- ===== 2) 막기: 글·댓글·안건·자료를 새로 쓰거나 고칠 때 (운영진은 언제나 통과) =====
create or replace function public.bypass_block_suspended()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null
     and (select public.bypass_role()) is distinct from 'staff'
     and public.is_suspended(auth.uid()) then
    raise exception 'suspended' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.bypass_block_suspended() from public, anon, authenticated;

drop trigger if exists posts_suspended on public.posts;
create trigger posts_suspended before insert or update on public.posts for each row execute function public.bypass_block_suspended();
drop trigger if exists post_comments_suspended on public.post_comments;
create trigger post_comments_suspended before insert or update on public.post_comments for each row execute function public.bypass_block_suspended();
do $$
begin
  if to_regclass('public.agenda_items') is not null then
    execute 'drop trigger if exists agenda_items_suspended on public.agenda_items';
    execute 'create trigger agenda_items_suspended before insert or update on public.agenda_items for each row execute function public.bypass_block_suspended()';
  end if;
  if to_regclass('public.resources') is not null then
    execute 'drop trigger if exists resources_suspended on public.resources';
    execute 'create trigger resources_suspended before insert or update on public.resources for each row execute function public.bypass_block_suspended()';
  end if;
end $$;

-- 올리기 권한(페이지·썸네일)에도 정지를 반영 (023 의 upload_status 에 한 줄 추가)
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
  elsif public.is_suspended(uid) then ok := false; why := 'suspended';
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

-- ===== 3) 운영진: 정지 · 풀기 =====
create or replace function public.suspend_member(p_user uuid, p_days int, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text; me text; u timestamptz;
begin
  if (select public.bypass_role()) is distinct from 'staff' then raise exception 'staff only' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'not yourself' using errcode = '42501'; end if;
  select coalesce(raw_app_meta_data ->> 'bypass_role', 'general') into who from auth.users where id = p_user;
  if not found then raise exception 'no user' using errcode = 'P0002'; end if;
  if who = 'staff' then raise exception 'staff cannot be suspended' using errcode = '42501'; end if;
  if p_days is not null and p_days not between 1 and 365 then raise exception 'bad days' using errcode = '22023'; end if;
  u := case when p_days is null then null else now() + make_interval(days => p_days) end;
  select coalesce(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'username', '운영진') into me from auth.users where id = auth.uid();
  insert into public.member_suspensions (user_id, until, reason, by_name, created_at)
       values (p_user, u, nullif(left(btrim(coalesce(p_reason, '')), 200), ''), me, now())
  on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, by_name = excluded.by_name, created_at = now();
  return jsonb_build_object('until', u, 'reason', nullif(left(btrim(coalesce(p_reason, '')), 200), ''));
end;
$$;

create or replace function public.unsuspend_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.bypass_role()) is distinct from 'staff' then raise exception 'staff only' using errcode = '42501'; end if;
  delete from public.member_suspensions where user_id = p_user;
end;
$$;

-- ===== 4) 본인: 내가 정지 중인지 (커뮤니티 안내용) =====
create or replace function public.my_suspension()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('until', s.until, 'reason', s.reason, 'since', s.created_at)
    from public.member_suspensions s
   where s.user_id = auth.uid() and (s.until is null or s.until > now())
$$;

-- ===== 5) 운영진: 회원 자세히 =====
create or replace function public.list_members_detail()
returns table (
  id uuid, username text, display_name text, role text,
  created_at timestamptz, last_sign_in_at timestamptz,
  posts int, showcases int, comments int, likes int, pages int,
  avatar_at timestamptz,
  upload_ok boolean, upload_why text,
  suspended boolean, suspend_until timestamptz, suspend_reason text, suspend_by text, suspend_at timestamptz,
  name_changed_at timestamptz
)
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
           u.created_at, u.last_sign_in_at,
           (select count(*)::int from public.posts p where p.author = u.id and p.kind = 'post'),
           (select count(*)::int from public.posts p where p.author = u.id and p.kind = 'showcase'),
           (select count(*)::int from public.post_comments c where c.author = u.id),
           (select count(*)::int from public.post_likes l join public.posts p on p.id = l.post_id where p.author = u.id and l.user_id <> u.id),
           (select count(*)::int from public.user_pages g where g.owner = u.id),
           (select a.updated_at from public.member_avatars a where a.user_id = u.id),
           (public.upload_status(u.id) ->> 'allowed')::boolean,
           public.upload_status(u.id) ->> 'reason',
           (s.user_id is not null and (s.until is null or s.until > now())),
           s.until, s.reason, s.by_name, s.created_at,
           nullif(u.raw_app_meta_data ->> 'name_changed_at', '')::timestamptz
      from auth.users u
      left join public.member_suspensions s on s.user_id = u.id
     order by u.created_at desc;
end;
$$;

revoke all on function public.suspend_member(uuid, int, text), public.unsuspend_member(uuid), public.my_suspension(), public.list_members_detail() from public, anon;
grant execute on function public.suspend_member(uuid, int, text), public.unsuspend_member(uuid), public.my_suspension(), public.list_members_detail() to authenticated;

-- 확인: 지금 정지 중인 회원
select coalesce(u.raw_user_meta_data ->> 'display_name', u.email) as "회원", s.until as "까지(비면 무기한)", s.reason as "사유"
  from public.member_suspensions s join auth.users u on u.id = s.user_id
 where s.until is null or s.until > now();
