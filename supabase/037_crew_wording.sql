-- BYPASS: '국원' → '크루원' (DB 에 저장된 문구)
-- 036 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 바꾸는 것
--   - 사이트 설정(site_settings): 모집 안내 같은 사이트 상태 문구 · 페이지 문구
--   - 보관된 지름길(routes) 설명
--   - 회의 안건·자료실 권한 이름 "쓰기: 국원·운영진" → "쓰기: 크루원·운영진" (이름만, 권한은 그대로)
-- 바꾸지 않는 것
--   - 회원이 쓴 글·댓글, 운영진이 쓴 공지·안건 내용 (사람이 쓴 글은 그대로 둠)
--   - 회원 구분 값 'member' (화면에 보이는 이름만 '크루원'으로 바뀜)

-- 1) 사이트 설정 문구
update public.site_settings
   set value = replace(value::text, '국원', '크루원')::jsonb,
       updated_at = now()
 where value::text like '%국원%';

-- 2) 보관된 지름길 설명 · 3) 권한 이름
do $$
declare t text;
begin
  if to_regclass('public.routes') is not null then
    update public.routes set description = replace(description, '국원', '크루원') where description like '%국원%';
  end if;
  foreach t in array array['agenda_items', 'resources'] loop
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = '쓰기: 국원·운영진') then
      execute format('drop policy if exists "쓰기: 크루원·운영진" on public.%I', t);
      execute format('alter policy "쓰기: 국원·운영진" on public.%I rename to "쓰기: 크루원·운영진"', t);
    end if;
  end loop;
end $$;

-- 확인: 0 이 나오면 끝 (사이트 설정에 남은 '국원' 개수)
select count(*) as "남은 국원" from public.site_settings where value::text like '%국원%';
