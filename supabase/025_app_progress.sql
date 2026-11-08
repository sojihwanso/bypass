-- BYPASS: /apps/ 페이지 진도를 회원 계정에 저장 (사람마다 따로, 기기가 바뀌어도 이어짐)
-- 024 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 쓰는 곳: /assets/app-shell.js (모든 /apps/<주소이름>/ 페이지의 껍데기)
--   - 앱이 localStorage 에 쓰는 내용을 껍데기가 받아 이 표에 저장합니다. 앱은 고칠 것이 없습니다.
--   - 로그인 안 한 사람은 이 표를 쓰지 않고, 그 브라우저에만 저장됩니다.
-- 누가 보나: 자기 진도만 읽고·쓰고·지울 수 있습니다. 운영진도 남의 진도는 못 봅니다.
-- 크기: 한 사람·한 앱당 약 1.5MB 까지.

create table if not exists public.app_progress (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app        text not null check (app ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  data       jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 1500000),
  updated_at timestamptz not null default now(),
  primary key (user_id, app)
);

create or replace function public.app_progress_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists app_progress_touch on public.app_progress;
create trigger app_progress_touch before insert or update on public.app_progress
  for each row execute function public.app_progress_touch();

alter table public.app_progress enable row level security;
revoke all on public.app_progress from anon, authenticated;
grant select, insert, update, delete on public.app_progress to authenticated;

drop policy if exists "진도: 내 것 읽기" on public.app_progress;
create policy "진도: 내 것 읽기" on public.app_progress for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "진도: 내 것 쓰기" on public.app_progress;
create policy "진도: 내 것 쓰기" on public.app_progress for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "진도: 내 것 고치기" on public.app_progress;
create policy "진도: 내 것 고치기" on public.app_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "진도: 내 것 지우기" on public.app_progress;
create policy "진도: 내 것 지우기" on public.app_progress for delete to authenticated
  using (user_id = (select auth.uid()));
