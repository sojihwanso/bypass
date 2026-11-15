-- BYPASS: HQ › 커뮤니티 › 회의실에서 운영진이 안건·자료의 글을 고칠 수 있게
-- 028 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 전에는 안건은 '처리 완료' 표시만, 자료는 지우기만 할 수 있었습니다.
-- 고치기 규칙(운영진만)은 003 에 이미 있으므로, 고칠 수 있는 칸만 열어 줍니다.
-- 이 파일을 안 돌려도 HQ 회의실의 완료 표시·지우기·새로 올리기는 됩니다 (고치기만 안 됨).

grant update (title, note, done) on public.agenda_items to authenticated;
grant update (title, url, note) on public.resources to authenticated;
