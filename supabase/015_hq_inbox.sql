-- BYPASS HQ 3단계(접수): 불편 제보 · 합류 신청을 HQ 에서 처리
-- 014 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 바뀌는 것
--   1) 합류 신청(applications)에 처리 상태와 운영진 메모 칸
--      상태: '새 신청' → '연락함' → '합류' 또는 '보류'
--   2) 불편 제보 운영진 메모(report_memos) 표: 제보자·국원에게는 보이지 않음
--   3) 처리가 끝난 제보의 연락처를 운영진이 지울 수 있게 (제보 양식의 '처리가 끝나면 파기' 약속)

-- ===== 1) 합류 신청: 상태·메모 =====
alter table public.applications add column if not exists status     text not null default '새 신청';
alter table public.applications add column if not exists memo       text;
alter table public.applications add column if not exists updated_at timestamptz;
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add  constraint applications_status_check check (status in ('새 신청', '연락함', '합류', '보류'));
alter table public.applications drop constraint if exists applications_memo_check;
alter table public.applications add  constraint applications_memo_check check (memo is null or char_length(memo) <= 1000);

drop trigger if exists applications_touch on public.applications;
create trigger applications_touch before update on public.applications
  for each row execute function public.bypass_touch_updated_at();

grant update (status, memo) on public.applications to authenticated;
drop policy if exists "합류 신청 처리: 운영진" on public.applications;
create policy "합류 신청 처리: 운영진" on public.applications for update to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');

-- ===== 2) 불편 제보 운영진 메모 =====
create table if not exists public.report_memos (
  report_id   bigint primary key references public.reports (id) on delete cascade,
  memo        text not null check (char_length(memo) between 1 and 1000),
  updated_at  timestamptz not null default now()
);
drop trigger if exists report_memos_touch on public.report_memos;
create trigger report_memos_touch before update on public.report_memos
  for each row execute function public.bypass_touch_updated_at();
alter table public.report_memos enable row level security;
revoke all on public.report_memos from anon, authenticated;
grant select, insert (report_id, memo), update (memo), delete on public.report_memos to authenticated;
drop policy if exists "제보 메모: 운영진" on public.report_memos;
create policy "제보 메모: 운영진" on public.report_memos for all to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');

-- ===== 3) 제보 연락처 지우기 (운영진) =====
grant delete on public.report_contacts to authenticated;
drop policy if exists "제보 연락처 지우기: 운영진" on public.report_contacts;
create policy "제보 연락처 지우기: 운영진" on public.report_contacts for delete to authenticated
  using ((select public.bypass_role()) = 'staff');

-- 확인
select status as "합류 신청 상태", count(*) as "건수" from public.applications group by status order by 1;
