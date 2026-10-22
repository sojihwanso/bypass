-- BYPASS: 개통 노선도 목록을 공사장에서 관리
-- 004_password_reset.sql 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- ※ 009_hq_phase1.sql 을 실행한 뒤 이 파일을 다시 실행했다면 009 도 다시 실행하세요. (숨긴 지름길 읽기 권한이 원래대로 돌아가기 때문)
--
-- 누가 무엇을 하나
--   노선·우회로 목록 : 누구나(로그인 없이도) 읽기 — 노선도는 공개 페이지이므로
--                      운영진만 추가·고치기·지우기

-- ===== 노선 (학업, 생활 …) =====
create table if not exists public.route_lines (
  id          text primary key check (id ~ '^[a-z0-9-]{1,30}$'),
  name        text not null check (char_length(name) between 1 and 30),
  no          text not null check (char_length(no) between 1 and 4),
  color       text not null check (color ~* '^#[0-9a-f]{6}$'),
  description text check (description is null or char_length(description) <= 200),
  sort        int not null default 0
);

-- ===== 우회로 (앱, 위키, 채널 …) =====
create table if not exists public.routes (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  title       text not null check (char_length(title) between 1 and 100),
  type        text not null check (type in ('app', 'wiki', 'channel')),
  line        text not null references public.route_lines (id) on update cascade,
  status      text not null default 'open' check (status in ('open', 'building')),
  url         text check (url is null or (char_length(url) <= 1000 and (url ~* '^https?://' or url ~ '^/[a-z0-9/_-]*$'))),
  description text check (description is null or char_length(description) <= 300),
  subject     text check (subject is null or char_length(subject) <= 60),
  featured    boolean not null default false,
  sample      boolean not null default false,
  sort        int not null default 0,
  -- 개통한 우회로에는 주소가 있어야 한다
  constraint open_needs_url check (status <> 'open' or url is not null)
);

create or replace function public.bypass_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists touch_updated_at on public.routes;
create trigger touch_updated_at before update on public.routes for each row execute function public.bypass_touch_updated_at();

alter table public.route_lines enable row level security;
alter table public.routes      enable row level security;

revoke all on public.route_lines, public.routes from anon, authenticated;
grant select on public.route_lines, public.routes to anon, authenticated;
grant insert, update, delete on public.route_lines to authenticated;
grant insert (title, type, line, status, url, description, subject, featured, sample, sort),
      update (title, type, line, status, url, description, subject, featured, sample, sort),
      delete on public.routes to authenticated;

drop policy if exists "노선: 누구나 읽기" on public.route_lines;
create policy "노선: 누구나 읽기" on public.route_lines for select to anon, authenticated using (true);
drop policy if exists "우회로: 누구나 읽기" on public.routes;
create policy "우회로: 누구나 읽기" on public.routes for select to anon, authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['route_lines', 'routes'] loop
    execute format('drop policy if exists "쓰기: 운영진" on public.%I', t);
    execute format('create policy "쓰기: 운영진" on public.%I for insert to authenticated with check ((select public.bypass_role()) = %L)', t, 'staff');
    execute format('drop policy if exists "고치기: 운영진" on public.%I', t);
    execute format('create policy "고치기: 운영진" on public.%I for update to authenticated using ((select public.bypass_role()) = %L) with check ((select public.bypass_role()) = %L)', t, 'staff', 'staff');
    execute format('drop policy if exists "지우기: 운영진" on public.%I', t);
    execute format('create policy "지우기: 운영진" on public.%I for delete to authenticated using ((select public.bypass_role()) = %L)', t, 'staff');
  end loop;
end $$;

-- ===== 처음 한 번: 지금 노선도에 있던 목록을 옮긴다 =====
insert into public.route_lines (id, name, no, color, description, sort) values
  ('study', '학업 노선', '1', '#0F5A3A', '수강·학점·공부에 걸리는 절차를 우회합니다.', 1),
  ('life',  '생활 노선', '2', '#EE6A1F', '밥·공지·학교생활의 잔절차를 우회합니다.', 2)
on conflict (id) do nothing;

insert into public.routes (title, type, line, status, url, description, subject, featured, sample, sort)
select v.* from (values
  ('수강플래너', 'app', 'study', 'open', 'https://mymmu.my/', '과목을 검색해 담으면 시간표로 바로 보이고, 계획을 여러 개 비교·공유합니다.', null::text, true, false, 1),
  ('졸업이수학점 계산기', 'app', 'study', 'open', 'https://eesuu.mymmu.my/', '들은 과목을 체크하면 남은 졸업 요건을 한 화면에 표시합니다. (항해정보시스템학부)', null, true, false, 2),
  ('과목 위키: 예시 과목 A', 'wiki', 'study', 'building', '/wiki/sample-a/', '강의 요점, 시험 범위, 자주 틀리는 문제를 과목별로 정리합니다.', '예시 과목 A', false, true, 3),
  ('과목 위키: 예시 과목 B', 'wiki', 'study', 'building', '/wiki/sample-b/', '선배들이 남긴 정리와 족보 대신, 국원들이 함께 고치는 공개 정리 노트입니다.', '예시 과목 B', false, true, 4),
  ('학식 알리미 ‘꿀꿀이’', 'channel', 'life', 'open', 'https://pf.kakao.com/_uuxfmX', '카카오톡 채널 ‘목해대 꿀꿀이’에서 학식 식단을 바로 확인합니다.', null, true, false, 1)
) as v(title, type, line, status, url, description, subject, featured, sample, sort)
where not exists (select 1 from public.routes);
