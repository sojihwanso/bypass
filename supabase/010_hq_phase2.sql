-- BYPASS HQ 2단계: 사이트 상태(운영 상태 전광판·모집 기간) · 처리 현황 안건
-- 009 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 바뀌는 것
--   1) 사이트 설정(site_settings) 표: 메인 전광판 모드·문구·모집 기간. 누구나 읽기, 고치기는 운영진만
--   2) 처리 현황 안건(dockets) 표: 메인 '안건 처리 현황'과 /dockets/ 전체 보기.
--      숨긴 안건은 운영진에게만 보임. 지금 메인에 있는 4건을 처음 한 번만 옮겨 넣음

-- ===== 1) 사이트 설정 =====
-- key 'status' 의 value 모양
--   { "mode": "normal" | "recruiting" | "exam",
--     "texts": { "normal": "…", "recruiting": "… {마감} …", "exam": "…" },
--     "recruit_start": "2026-11-01" | null, "recruit_end": "2026-11-20" | null }
create table if not exists public.site_settings (
  key         text primary key check (key ~ '^[a-z_]{1,40}$'),
  value       jsonb not null check (jsonb_typeof(value) = 'object' and pg_column_size(value) <= 8000),
  updated_at  timestamptz not null default now()
);

alter table public.site_settings drop constraint if exists site_settings_status_shape;
alter table public.site_settings add constraint site_settings_status_shape check (
  key <> 'status' or (
        value ->> 'mode' in ('normal', 'recruiting', 'exam')
    and jsonb_typeof(value -> 'texts') = 'object'
    and char_length(coalesce(value -> 'texts' ->> 'normal', '')) <= 120
    and char_length(coalesce(value -> 'texts' ->> 'recruiting', '')) <= 120
    and char_length(coalesce(value -> 'texts' ->> 'exam', '')) <= 120
    and (value ->> 'recruit_start' is null or value ->> 'recruit_start' ~ '^\d{4}-\d{2}-\d{2}$')
    and (value ->> 'recruit_end' is null or value ->> 'recruit_end' ~ '^\d{4}-\d{2}-\d{2}$')
  )
);

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.bypass_touch_updated_at();

alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert (key, value), update (value) on public.site_settings to authenticated;

drop policy if exists "설정: 누구나 읽기" on public.site_settings;
create policy "설정: 누구나 읽기" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "설정: 운영진 추가" on public.site_settings;
create policy "설정: 운영진 추가" on public.site_settings for insert to authenticated
  with check ((select public.bypass_role()) = 'staff');
drop policy if exists "설정: 운영진 고치기" on public.site_settings;
create policy "설정: 운영진 고치기" on public.site_settings for update to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');

-- 지금 index.html 에 적힌 값으로 시작
insert into public.site_settings (key, value) values ('status', jsonb_build_object(
  'mode', 'normal',
  'texts', jsonb_build_object(
    'normal', '본 국은 현재 정상 운영 중입니다. 제보는 상시 접수합니다.',
    'recruiting', '2026학년도 BYPASS 국원 공개 모집 중 (~ {마감})',
    'exam', '시험 기간 중 본 국의 심의 업무가 일시 정지됩니다. 접수는 계속됩니다.'),
  'recruit_start', null,
  'recruit_end', null))
on conflict (key) do nothing;

-- ===== 2) 처리 현황 안건 =====
-- status : 'building'(공사 중) | 'done'(완료: 도도새 직인) | 'new'(신설 개통: 신설 개통 인장) | 'rejected'(반려)
-- old_way: 기존 절차 (반려 안건은 '접수 내용')   new_way: 개선 후   reason: 반려 사유
-- no     : '0-5' 처럼 적으면 '제0-5호'로 보임.   no_note: '창립 전' 처럼 번호 옆 괄호
-- sort   : 작을수록 앞. 메인에는 앞에서 4건, /dockets/ 에는 전부
create table if not exists public.dockets (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  no          text not null check (char_length(no) between 1 and 20 and no !~ '[<>]'),
  no_note     text check (no_note is null or char_length(no_note) <= 20),
  title       text not null check (char_length(title) between 1 and 60),
  status      text not null default 'building' check (status in ('building', 'done', 'new', 'rejected')),
  old_way     text check (old_way is null or char_length(old_way) <= 300),
  new_way     text check (new_way is null or char_length(new_way) <= 300),
  reason      text check (reason is null or char_length(reason) <= 300),
  route_id    bigint references public.routes (id) on delete set null,
  report_id   bigint references public.reports (id) on delete set null,
  sample      boolean not null default false,
  hidden      boolean not null default false,
  sort        int not null default 0
);
create unique index if not exists dockets_no_key on public.dockets (no);
create index if not exists dockets_sort_idx on public.dockets (sort);
create index if not exists dockets_route_idx on public.dockets (route_id);
create index if not exists dockets_report_idx on public.dockets (report_id);

drop trigger if exists dockets_touch on public.dockets;
create trigger dockets_touch before update on public.dockets
  for each row execute function public.bypass_touch_updated_at();

alter table public.dockets enable row level security;
revoke all on public.dockets from anon, authenticated;
grant select on public.dockets to anon, authenticated;
grant insert (no, no_note, title, status, old_way, new_way, reason, route_id, report_id, sample, hidden, sort),
      update (no, no_note, title, status, old_way, new_way, reason, route_id, report_id, sample, hidden, sort),
      delete on public.dockets to authenticated;

drop policy if exists "안건: 누구나 읽기" on public.dockets;
create policy "안건: 누구나 읽기" on public.dockets for select to anon, authenticated
  using (not hidden or (select public.bypass_role()) = 'staff');
drop policy if exists "안건: 운영진 추가" on public.dockets;
create policy "안건: 운영진 추가" on public.dockets for insert to authenticated
  with check ((select public.bypass_role()) = 'staff');
drop policy if exists "안건: 운영진 고치기" on public.dockets;
create policy "안건: 운영진 고치기" on public.dockets for update to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');
drop policy if exists "안건: 운영진 지우기" on public.dockets;
create policy "안건: 운영진 지우기" on public.dockets for delete to authenticated
  using ((select public.bypass_role()) = 'staff');

-- 지금 메인에 있는 안내판 4건을 옮긴다 (표가 비어 있을 때 한 번만). 지름길은 주소로 찾아 잇는다
insert into public.dockets (no, no_note, title, status, old_way, new_way, reason, route_id, sample, sort)
select v.no, v.no_note, v.title, v.status, v.old_way, v.new_way, v.reason,
       (select r.id from public.routes r where r.url = v.url order by r.id limit 1),
       v.sample, v.sort
from (values
  ('0-1', '창립 전', '수강플래너', 'done',
   '강의 목록을 하나씩 열어 시간이 겹치는지 맞춰 봄', '과목을 담으면 시간표로 바로 보이고, 계획을 여러 개 비교·공유', null::text,
   'https://mymmu.my/', false, 10),
  ('0-2', '창립 전', '졸업이수학점 계산기', 'done',
   '졸업이수학점 직접 계산', '들은 과목을 체크하면 남은 졸업 요건을 한 화면에 표시', null,
   'https://eesuu.mymmu.my/', false, 20),
  ('0-3', '창립 전', '학식 알리미 ‘꿀꿀이’', 'done',
   '오늘 학식이 뭔지 보려고 식단 게시판을 찾아 들어감', '카톡에서 식단을 바로 확인', null,
   'https://pf.kakao.com/_uuxfmX', false, 30),
  ('0-4', null, '강의동 이동 불편', 'rejected',
   '비 오는 날 강의동까지 걸어가야 함', null, '해당 불편은 절차가 아닌 날씨에 기인함.',
   null, true, 40)
) as v(no, no_note, title, status, old_way, new_way, reason, url, sample, sort)
where not exists (select 1 from public.dockets);
