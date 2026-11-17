-- BYPASS 커뮤니티: 결과물 첨부 파일 (글마다 2개까지 · 한 파일 3MB 미만)
-- 033 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 누가
--   - 붙이기: 올리기 권한(can_upload)이 있는 회원이 자기 글에만. 썸네일·HTML 올리기와 같은 규칙
--   - 보기·받기: 그 글을 읽을 수 있는 회원 (숨긴 글은 쓴 사람과 운영진만). 로그인하지 않으면 못 받음
--   - 빼기: 쓴 사람 또는 운영진
-- 무엇을
--   - 사진(PNG·JPG·WebP·GIF) · PDF · 한글(hwp·hwpx) · 워드 · 엑셀 · 파워포인트 · ZIP · TXT · CSV
--   - HTML·SVG·실행 파일은 받지 않습니다. (열면 스크립트가 돌 수 있어서)
-- 어디에
--   - 저장소 post-files/<회원번호>/<글번호>/<무작위>.<확장자> (공개 아님. 화면이 1시간짜리 주소를 받아 보여 줌)
--   - 원래 파일 이름 · 크기는 post_files 표에

-- ===== 1) 표 =====
create table if not exists public.post_files (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  post_id     bigint not null references public.posts (id) on delete cascade,
  author      uuid default auth.uid() references auth.users (id) on delete set null,
  path        text not null unique check (char_length(path) <= 200 and path ~ '^[0-9a-f-]{36}/[0-9]+/[A-Za-z0-9._-]+$'),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  size        int not null check (size > 0 and size < 3145728),
  mime        text not null check (mime in (
                'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
                'application/x-hwp', 'application/vnd.hancom.hwpx',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/zip', 'text/plain', 'text/csv'))
);
create index if not exists post_files_post_idx on public.post_files (post_id, id);

-- 붙일 때: 쓴 사람 적기 · 내 글인지 · 내 폴더인지 · 2개까지 · 올리기 권한
create or replace function public.post_files_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  n int;
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '42501'; end if;
  new.author := auth.uid();
  new.created_at := now();
  select p.author into owner from public.posts p where p.id = new.post_id;
  if owner is distinct from auth.uid() then raise exception 'not your post' using errcode = '42501'; end if;
  if not public.can_upload(auth.uid()) then raise exception 'upload not allowed' using errcode = '42501'; end if;
  if split_part(new.path, '/', 1) <> auth.uid()::text or split_part(new.path, '/', 2) <> new.post_id::text then
    raise exception 'not your file' using errcode = '42501';
  end if;
  -- 같은 글에 동시에 붙이는 경우까지 2개로 막는다
  perform 1 from public.posts p where p.id = new.post_id for update;
  select count(*) into n from public.post_files f where f.post_id = new.post_id;
  if n >= 2 then raise exception 'too many files' using errcode = '22023'; end if;
  return new;
end;
$$;
revoke all on function public.post_files_check() from public, anon, authenticated;
drop trigger if exists post_files_check on public.post_files;
create trigger post_files_check before insert on public.post_files
  for each row execute function public.post_files_check();

-- ===== 2) 권한 =====
alter table public.post_files enable row level security;
revoke all on public.post_files from anon, authenticated;
grant select, delete on public.post_files to authenticated;
grant insert (post_id, path, name, size, mime) on public.post_files to authenticated;

drop policy if exists "첨부 보기" on public.post_files;
create policy "첨부 보기" on public.post_files for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));   -- posts 의 읽기 규칙을 그대로 따른다
drop policy if exists "첨부 붙이기" on public.post_files;
create policy "첨부 붙이기" on public.post_files for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author = (select auth.uid())));
drop policy if exists "첨부 빼기" on public.post_files;
create policy "첨부 빼기" on public.post_files for delete to authenticated
  using (author = (select auth.uid()) or (select public.bypass_role()) = 'staff');

-- ===== 3) 저장소 (공개 아님) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-files', 'post-files', false, 3145728, array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
  'application/x-hwp', 'application/vnd.hancom.hwpx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'text/plain', 'text/csv'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 받기: 읽을 수 있는 글에 붙은 파일 + 내 폴더(붙이는 중) + 운영진
drop policy if exists "첨부 파일: 보기" on storage.objects;
create policy "첨부 파일: 보기" on storage.objects for select to authenticated
  using (bucket_id = 'post-files' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.bypass_role()) = 'staff'
    or exists (select 1 from public.post_files f where f.path = storage.objects.name)));
drop policy if exists "첨부 파일: 올리기" on storage.objects;
create policy "첨부 파일: 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_upload((select auth.uid())));
drop policy if exists "첨부 파일: 지우기" on storage.objects;
create policy "첨부 파일: 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'post-files' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.bypass_role()) = 'staff'));

-- 확인: 두 줄이 나오면 끝
select 'post_files' as "만든 것" from information_schema.tables where table_schema = 'public' and table_name = 'post_files'
union all
select 'post-files 저장소' from storage.buckets where id = 'post-files';
