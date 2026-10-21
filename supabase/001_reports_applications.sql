-- BYPASS: 불편 제보·합류 신청 저장과 회원 열람
-- Supabase 대시보드 → SQL Editor → New query 에 이 파일 전체를 붙여 넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다.
--
-- 누가 무엇을 볼 수 있나
--   - 누구나(로그인 없이도): 메인 페이지에서 제보·합류 신청을 "제출"만 할 수 있음. 남의 글은 못 봄.
--   - 로그인한 회원: 자기가 로그인한 채로 낸 제보(B구역 '내 제보')
--   - 부원·운영진: 모든 제보의 내용 (연락처 제외)
--   - 운영진: 제보 연락처, 합류 신청 전체(이름·연락처 포함)
-- 회원 구분은 Supabase 사용자 app_metadata 의 bypass_role ('member' | 'staff') 입니다.

-- ===== 회원 구분 확인 =====
create or replace function public.bypass_role()
returns text
language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'bypass_role', 'general');
$$;

-- ===== 불편 제보 =====
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  what        text not null check (char_length(what) between 1 and 2000),
  how         text not null check (char_length(how) between 1 and 2000),
  status      text not null default '접수' check (status in ('접수', '심의', '개통', '반려')),
  reporter    uuid references auth.users (id) on delete set null
);

-- 연락처는 운영진만 보도록 따로 둔다
create table if not exists public.report_contacts (
  report_id  bigint primary key references public.reports (id) on delete cascade,
  contact    text not null check (char_length(contact) between 1 and 100)
);

-- ===== 합류 신청 =====
create table if not exists public.applications (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 40),
  contact     text not null check (char_length(contact) between 1 and 100),
  major       text check (major is null or char_length(major) <= 60),
  want        text not null check (char_length(want) between 1 and 300),
  applicant   uuid references auth.users (id) on delete set null
);

alter table public.reports         enable row level security;
alter table public.report_contacts enable row level security;
alter table public.applications    enable row level security;

-- 표에 직접 쓰는 길은 막고, 아래 제출 함수로만 넣는다
revoke all on public.reports, public.report_contacts, public.applications from anon, authenticated;
grant select on public.reports to authenticated;
grant select on public.report_contacts, public.applications to authenticated;
grant update (status) on public.reports to authenticated;
grant delete on public.reports, public.applications to authenticated;

-- ===== 열람 규칙 =====
drop policy if exists "제보: 내 것" on public.reports;
create policy "제보: 내 것" on public.reports
  for select to authenticated using (reporter = (select auth.uid()));

drop policy if exists "제보: 부원·운영진" on public.reports;
create policy "제보: 부원·운영진" on public.reports
  for select to authenticated using ((select public.bypass_role()) in ('member', 'staff'));

drop policy if exists "제보 상태 변경: 운영진" on public.reports;
create policy "제보 상태 변경: 운영진" on public.reports
  for update to authenticated
  using ((select public.bypass_role()) = 'staff')
  with check ((select public.bypass_role()) = 'staff');

drop policy if exists "제보 삭제: 운영진" on public.reports;
create policy "제보 삭제: 운영진" on public.reports
  for delete to authenticated using ((select public.bypass_role()) = 'staff');

drop policy if exists "제보 연락처: 운영진" on public.report_contacts;
create policy "제보 연락처: 운영진" on public.report_contacts
  for select to authenticated using ((select public.bypass_role()) = 'staff');

drop policy if exists "합류 신청: 운영진" on public.applications;
create policy "합류 신청: 운영진" on public.applications
  for select to authenticated using ((select public.bypass_role()) = 'staff');

drop policy if exists "합류 신청 삭제: 운영진" on public.applications;
create policy "합류 신청 삭제: 운영진" on public.applications
  for delete to authenticated using ((select public.bypass_role()) = 'staff');

-- ===== 제출 함수: 메인 페이지 양식이 부르는 것 =====
-- 접수번호를 돌려준다. 예) BYP-2026-007, JOIN-2026-003
create or replace function public.submit_report(p_what text, p_how text, p_contact text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  c text := nullif(btrim(coalesce(p_contact, '')), '');
begin
  insert into public.reports (what, how, reporter)
  values (btrim(p_what), btrim(p_how), auth.uid())
  returning id into new_id;
  if c is not null then
    insert into public.report_contacts (report_id, contact) values (new_id, c);
  end if;
  return 'BYP-' || extract(year from now())::int || '-' || lpad(new_id::text, 3, '0');
end;
$$;

create or replace function public.submit_application(p_name text, p_contact text, p_want text, p_major text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  insert into public.applications (name, contact, major, want, applicant)
  values (btrim(p_name), btrim(p_contact), nullif(btrim(coalesce(p_major, '')), ''), btrim(p_want), auth.uid())
  returning id into new_id;
  return 'JOIN-' || extract(year from now())::int || '-' || lpad(new_id::text, 3, '0');
end;
$$;

revoke all on function public.submit_report(text, text, text) from public;
revoke all on function public.submit_application(text, text, text, text) from public;
grant execute on function public.submit_report(text, text, text) to anon, authenticated;
grant execute on function public.submit_application(text, text, text, text) to anon, authenticated;

-- ===== 부원·운영진 지정 방법 =====
-- 아래에서 아이디만 바꿔 실행하면 됩니다. (아이디@bypass.invalid 형식)
--   update auth.users
--      set raw_app_meta_data = raw_app_meta_data || '{"bypass_role": "staff"}'
--    where email = '아이디@bypass.invalid';
-- 'staff' 대신 'member' 를 넣으면 부원입니다. 바뀐 구분은 그 사람이 다시 로그인하면 적용됩니다.
