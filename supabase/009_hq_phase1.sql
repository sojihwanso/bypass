-- BYPASS HQ 1단계: 개통 노선도 관리 · 아이콘 등록 · 방문·클릭 기록
-- 008 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 바뀌는 것
--   1) 지름길(routes)에 아이콘·판 색·숨김 칸 추가. 숨긴 지름길은 운영진에게만 보임
--   2) 방문·클릭 기록(stats_events) 표: 누구나 한 줄 추가만, 보기는 운영진만. 개인 정보는 남기지 않음
--   3) 아이콘 파일 저장소(route-icons): 누구나 보기, 올리기·지우기는 운영진만

-- ===== 1) 지름길 아이콘 칸 =====
-- icon      : 'auto'(이름 낱말로 자동) | 'upload'(직접 올림) | 기본 그림 이름(calendar, cap …)
-- icon_url  : 직접 올린 그림 주소
-- tile      : 판 색 'auto' | 'line'(분류 색) | 'white' | 'yellow' | '#RRGGBB'
-- icon_full : true 면 올린 그림이 판 전체를 채움
-- hidden    : true 면 노선도에 보이지 않음
alter table public.routes add column if not exists icon      text    not null default 'auto';
alter table public.routes add column if not exists icon_url  text;
alter table public.routes add column if not exists tile      text    not null default 'auto';
alter table public.routes add column if not exists icon_full boolean not null default false;
alter table public.routes add column if not exists hidden    boolean not null default false;

alter table public.routes drop constraint if exists routes_icon_check;
alter table public.routes add  constraint routes_icon_check check (icon ~ '^(auto|upload|[a-z]{2,20})$');
alter table public.routes drop constraint if exists routes_icon_url_check;
alter table public.routes add  constraint routes_icon_url_check check (icon_url is null or (char_length(icon_url) <= 1000 and icon_url ~* '^https://'));
alter table public.routes drop constraint if exists routes_tile_check;
alter table public.routes add  constraint routes_tile_check check (tile ~ '^(auto|line|white|yellow|#[0-9a-fA-F]{6})$');

-- 숨긴 지름길은 운영진에게만 보이게 (005 의 '누구나 읽기'를 바꾼다)
drop policy if exists "우회로: 누구나 읽기" on public.routes;
create policy "우회로: 누구나 읽기" on public.routes for select to anon, authenticated
  using (not hidden or (select public.bypass_role()) = 'staff');

-- 운영진이 새 칸도 쓸 수 있게 (005 에서 칸마다 권한을 주었으므로 새 칸도 따로 준다)
grant insert (icon, icon_url, tile, icon_full, hidden),
      update (icon, icon_url, tile, icon_full, hidden) on public.routes to authenticated;

-- ===== 2) 방문·클릭 기록 =====
create table if not exists public.stats_events (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  kind      text not null check (kind in ('view', 'go')),
  page      text not null check (char_length(page) between 1 and 200),
  route_id  bigint references public.routes (id) on delete set null
);
create index if not exists stats_events_at_idx on public.stats_events (at);
create index if not exists stats_events_route_idx on public.stats_events (route_id);
-- 페이지 경로 모양만 받기, 지름길 번호는 '이용하기' 기록에만
alter table public.stats_events drop constraint if exists stats_events_page_path;
alter table public.stats_events add  constraint stats_events_page_path check (page ~ '^/[^[:space:]<>"]*$');
alter table public.stats_events drop constraint if exists stats_events_go_route;
alter table public.stats_events add  constraint stats_events_go_route check (kind = 'go' or route_id is null);

alter table public.stats_events enable row level security;
revoke all on public.stats_events from anon, authenticated;
grant insert (kind, page, route_id) on public.stats_events to anon, authenticated;
grant select on public.stats_events to authenticated;

drop policy if exists "기록: 누구나 추가" on public.stats_events;
create policy "기록: 누구나 추가" on public.stats_events for insert to anon, authenticated with check (true);
drop policy if exists "기록: 운영진 보기" on public.stats_events;
create policy "기록: 운영진 보기" on public.stats_events for select to authenticated using ((select public.bypass_role()) = 'staff');

-- ===== 3) 아이콘 파일 저장소 =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('route-icons', 'route-icons', true, 512000, array['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "아이콘: 운영진 보기" on storage.objects;
create policy "아이콘: 운영진 보기" on storage.objects for select to authenticated
  using (bucket_id = 'route-icons' and (select public.bypass_role()) = 'staff');
drop policy if exists "아이콘: 운영진 올리기" on storage.objects;
create policy "아이콘: 운영진 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'route-icons' and (select public.bypass_role()) = 'staff');
drop policy if exists "아이콘: 운영진 고치기" on storage.objects;
create policy "아이콘: 운영진 고치기" on storage.objects for update to authenticated
  using (bucket_id = 'route-icons' and (select public.bypass_role()) = 'staff');
drop policy if exists "아이콘: 운영진 지우기" on storage.objects;
create policy "아이콘: 운영진 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'route-icons' and (select public.bypass_role()) = 'staff');
