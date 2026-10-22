-- BYPASS: 개통 노선도 분류 이름 바꾸기 ('학업 노선' → '학업 관련', '생활 노선' → '학교생활')
-- SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- 운영진이 이미 다른 이름으로 고친 분류는 건드리지 않습니다.

update public.route_lines set name = '학업 관련' where id = 'study' and name = '학업 노선';
update public.route_lines set name = '학교생활'  where id = 'life'  and name = '생활 노선';
