-- BYPASS: 노선 설명 문구 정리 ('우회합니다' → '건너뜁니다')
-- 이 브랜치를 main 에 합친 뒤에 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- 운영진이 이미 다른 문구로 고친 노선은 건드리지 않습니다.

update public.route_lines
   set description = '수강·학점·공부에 걸리는 절차를 건너뜁니다.'
 where id = 'study' and description = '수강·학점·공부에 걸리는 절차를 우회합니다.';

update public.route_lines
   set description = '밥·공지·학교생활의 잔절차를 건너뜁니다.'
 where id = 'life' and description = '밥·공지·학교생활의 잔절차를 우회합니다.';
