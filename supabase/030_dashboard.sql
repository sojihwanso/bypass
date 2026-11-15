-- BYPASS: 커뮤니티 홈 '내 대시보드' — 회원마다 위젯 구성 · D-day · 즐겨찾기 저장
-- 029 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 쓰는 곳: /community/ 홈 (대시보드 편집 · D-day · 결과물의 ☆ 즐겨찾기)
--   layout 예) {"widgets":[{"id":"market","w":2},{"id":"continue","w":1}], "ddays":[{"name":"해기사 필기","date":"2026-12-08"}], "favs":[12, 40]}
-- 누가 보나: 자기 것만 읽고·쓰고·지울 수 있습니다. 운영진도 남의 대시보드는 못 봅니다.
-- 이 파일을 돌리기 전에도 대시보드는 쓸 수 있지만, 그 브라우저에만 저장됩니다.

create table if not exists public.dashboard_prefs (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  layout     jsonb not null default '{}'::jsonb check (jsonb_typeof(layout) = 'object' and octet_length(layout::text) <= 20000),
  updated_at timestamptz not null default now()
);

create or replace function public.dashboard_prefs_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists dashboard_prefs_touch on public.dashboard_prefs;
create trigger dashboard_prefs_touch before insert or update on public.dashboard_prefs
  for each row execute function public.dashboard_prefs_touch();

alter table public.dashboard_prefs enable row level security;
revoke all on public.dashboard_prefs from anon, authenticated;
grant select, insert, update, delete on public.dashboard_prefs to authenticated;

drop policy if exists "대시보드: 내 것 읽기" on public.dashboard_prefs;
create policy "대시보드: 내 것 읽기" on public.dashboard_prefs for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "대시보드: 내 것 쓰기" on public.dashboard_prefs;
create policy "대시보드: 내 것 쓰기" on public.dashboard_prefs for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "대시보드: 내 것 고치기" on public.dashboard_prefs;
create policy "대시보드: 내 것 고치기" on public.dashboard_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "대시보드: 내 것 지우기" on public.dashboard_prefs;
create policy "대시보드: 내 것 지우기" on public.dashboard_prefs for delete to authenticated
  using (user_id = (select auth.uid()));
