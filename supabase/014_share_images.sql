-- BYPASS HQ 링크 미리보기: 미리보기 그림 저장소
-- SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 카톡·SNS 에 링크를 보낼 때 뜨는 그림(1200×630)을 HQ 에서 올리는 곳입니다.
-- 누구나 볼 수 있고(카톡이 가져가야 하므로), 올리기·지우기는 운영진만 합니다.
-- 제목·설명은 데이터베이스가 아니라 각 페이지 HTML 에 직접 적힙니다 (Edge Function publish-meta).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('share-images', 'share-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "미리보기 그림: 운영진 보기" on storage.objects;
create policy "미리보기 그림: 운영진 보기" on storage.objects for select to authenticated
  using (bucket_id = 'share-images' and (select public.bypass_role()) = 'staff');
drop policy if exists "미리보기 그림: 운영진 올리기" on storage.objects;
create policy "미리보기 그림: 운영진 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'share-images' and (select public.bypass_role()) = 'staff');
drop policy if exists "미리보기 그림: 운영진 고치기" on storage.objects;
create policy "미리보기 그림: 운영진 고치기" on storage.objects for update to authenticated
  using (bucket_id = 'share-images' and (select public.bypass_role()) = 'staff');
drop policy if exists "미리보기 그림: 운영진 지우기" on storage.objects;
create policy "미리보기 그림: 운영진 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'share-images' and (select public.bypass_role()) = 'staff');
