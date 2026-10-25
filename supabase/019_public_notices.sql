-- BYPASS HQ 4단계: 전체 공개 공지
-- 018 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 바뀌는 것
--   1) 공지(notices)에 대상(audience)과 게시 기간(starts_at, ends_at)
--      'members' = 회원 전용(지금처럼 공사장에만), 'public' = 전체 공개(메인 전광판에도 한 줄)
--   2) 로그인하지 않은 방문자는 '전체 공개'이면서 게시 기간 안인 공지만 읽음 (쓴 사람 계정 번호는 못 읽음)
--   3) 운영진이 HQ 에서 제목·내용도 고칠 수 있게 (지금까지는 고정만 바꿀 수 있었음)

alter table public.notices add column if not exists audience   text not null default 'members';
alter table public.notices add column if not exists starts_at  timestamptz;
alter table public.notices add column if not exists ends_at    timestamptz;
alter table public.notices drop constraint if exists notices_audience_check;
alter table public.notices add  constraint notices_audience_check check (audience in ('members', 'public'));
alter table public.notices drop constraint if exists notices_period_check;
alter table public.notices add  constraint notices_period_check check (starts_at is null or ends_at is null or starts_at < ends_at);

grant insert (title, body, pinned, audience, starts_at, ends_at),
      update (title, body, pinned, audience, starts_at, ends_at) on public.notices to authenticated;

-- 방문자(로그인 안 함): 게시 중인 전체 공개 공지만
grant select (id, created_at, title, body, pinned, audience, starts_at, ends_at) on public.notices to anon;
drop policy if exists "공지: 전체 공개 읽기" on public.notices;
create policy "공지: 전체 공개 읽기" on public.notices for select to anon
  using (audience = 'public' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

create index if not exists notices_public_idx on public.notices (audience, starts_at, ends_at);

select audience as "대상", count(*) as "공지 수" from public.notices group by audience;
