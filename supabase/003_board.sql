-- BYPASS: 공사장 C구역 공지, D구역 회의 안건·자료실
-- 002_member_admin.sql 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 누가 무엇을 하나
--   공지      : 로그인한 회원 모두 읽기 / 운영진만 쓰기·고정·지우기
--   회의 안건 : 부원·운영진 읽기 / 운영진만 쓰기·처리 표시·지우기
--   자료실    : 부원·운영진 읽기 / 운영진만 쓰기·지우기

-- ===== 글쓴이 이름 자동 기록 =====
-- auth.users 는 회원이 직접 볼 수 없으므로, 쓸 때 이름을 함께 저장해 둔다.
create or replace function public.bypass_stamp_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author := auth.uid();
  select coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', '운영진')
    into new.author_name
    from auth.users u where u.id = auth.uid();
  new.author_name := coalesce(new.author_name, '운영진');
  return new;
end;
$$;

-- ===== 공지 =====
create table if not exists public.notices (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  title        text not null check (char_length(title) between 1 and 200),
  body         text check (body is null or char_length(body) <= 2000),
  pinned       boolean not null default false,
  author       uuid references auth.users (id) on delete set null,
  author_name  text
);

-- ===== 회의 안건 =====
create table if not exists public.agenda_items (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  title        text not null check (char_length(title) between 1 and 200),
  note         text check (note is null or char_length(note) <= 1000),
  done         boolean not null default false,
  report_id    bigint references public.reports (id) on delete set null,
  author       uuid references auth.users (id) on delete set null,
  author_name  text
);

-- ===== 자료실 (링크 모음) =====
create table if not exists public.resources (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  title        text not null check (char_length(title) between 1 and 200),
  url          text not null check (url ~* '^https?://' and char_length(url) <= 1000),
  note         text check (note is null or char_length(note) <= 500),
  author       uuid references auth.users (id) on delete set null,
  author_name  text
);

drop trigger if exists stamp_author on public.notices;
create trigger stamp_author before insert on public.notices for each row execute function public.bypass_stamp_author();
drop trigger if exists stamp_author on public.agenda_items;
create trigger stamp_author before insert on public.agenda_items for each row execute function public.bypass_stamp_author();
drop trigger if exists stamp_author on public.resources;
create trigger stamp_author before insert on public.resources for each row execute function public.bypass_stamp_author();

alter table public.notices      enable row level security;
alter table public.agenda_items enable row level security;
alter table public.resources    enable row level security;

revoke all on public.notices, public.agenda_items, public.resources from anon, authenticated;
grant select, delete on public.notices, public.agenda_items, public.resources to authenticated;
grant insert (title, body, pinned) on public.notices to authenticated;
grant update (pinned) on public.notices to authenticated;
grant insert (title, note, report_id) on public.agenda_items to authenticated;
grant update (done) on public.agenda_items to authenticated;
grant insert (title, url, note) on public.resources to authenticated;

-- 공지: 로그인한 회원 모두 읽기
drop policy if exists "공지: 회원 읽기" on public.notices;
create policy "공지: 회원 읽기" on public.notices for select to authenticated using (true);

-- 회의 안건·자료실: 부원·운영진 읽기
drop policy if exists "안건: 부원 읽기" on public.agenda_items;
create policy "안건: 부원 읽기" on public.agenda_items for select to authenticated
  using ((select public.bypass_role()) in ('member', 'staff'));
drop policy if exists "자료: 부원 읽기" on public.resources;
create policy "자료: 부원 읽기" on public.resources for select to authenticated
  using ((select public.bypass_role()) in ('member', 'staff'));

-- 쓰기·고치기·지우기: 운영진만 (세 표 모두)
do $$
declare t text;
begin
  foreach t in array array['notices', 'agenda_items', 'resources'] loop
    execute format('drop policy if exists "쓰기: 운영진" on public.%I', t);
    execute format('create policy "쓰기: 운영진" on public.%I for insert to authenticated with check ((select public.bypass_role()) = %L)', t, 'staff');
    execute format('drop policy if exists "고치기: 운영진" on public.%I', t);
    execute format('create policy "고치기: 운영진" on public.%I for update to authenticated using ((select public.bypass_role()) = %L) with check ((select public.bypass_role()) = %L)', t, 'staff', 'staff');
    execute format('drop policy if exists "지우기: 운영진" on public.%I', t);
    execute format('create policy "지우기: 운영진" on public.%I for delete to authenticated using ((select public.bypass_role()) = %L)', t, 'staff');
  end loop;
end $$;

-- 처음 한 번: 지금 공사장에 적혀 있던 공지를 옮겨 둔다 (공지가 하나도 없을 때만)
insert into public.notices (title, pinned, author_name, created_at)
select v.title, v.pinned, '운영진', v.created_at
  from (values
    ('비밀번호를 잊으셨다면 운영진에게 문의해 주세요.', true, timestamptz '2026-10-20 09:00+09'),
    ('회원 전용 페이지 ‘공사장’이 문을 열었습니다.', false, timestamptz '2026-10-20 10:00+09'),
    ('동아리가 만든 앱을 모아 보는 ‘발명한 지름길 모음’을 준비하고 있습니다.', false, timestamptz '2026-10-20 10:01+09')
  ) as v(title, pinned, created_at)
 where not exists (select 1 from public.notices);
