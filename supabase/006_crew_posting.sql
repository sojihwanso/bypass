-- BYPASS: 국원도 회의 안건·자료를 올릴 수 있게
-- 003_board.sql 을 실행한 뒤 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 바뀌는 규칙 (회의 안건 agenda_items · 자료실 resources)
--   올리기 : 국원·운영진          (전: 운영진만)
--   지우기 : 운영진은 전부, 국원은 자기가 올린 것만
--   처리 완료 표시(안건) : 운영진만 (그대로)
-- 공지(notices)는 그대로 운영진만 씁니다.

do $$
declare t text;
begin
  foreach t in array array['agenda_items', 'resources'] loop
    execute format('drop policy if exists "쓰기: 운영진" on public.%I', t);
    execute format('drop policy if exists "쓰기: 국원·운영진" on public.%I', t);
    execute format('create policy "쓰기: 국원·운영진" on public.%I for insert to authenticated with check ((select public.bypass_role()) in (%L, %L))', t, 'member', 'staff');

    execute format('drop policy if exists "지우기: 운영진" on public.%I', t);
    execute format('drop policy if exists "지우기: 운영진·올린 사람" on public.%I', t);
    execute format('create policy "지우기: 운영진·올린 사람" on public.%I for delete to authenticated using ((select public.bypass_role()) = %L or ((select public.bypass_role()) = %L and author = (select auth.uid())))', t, 'staff', 'member');
  end loop;
end $$;
