-- BYPASS: 분류 이름 '○○ 지름길' → '○○ 허브' (페이지 이름 '개통 노선도' → '준공 현황'과 함께)
-- SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- (HQ → 준공 현황 → 분류 탭 → 고치기 에서 하나씩 바꿔도 똑같습니다)

update public.route_lines
set name = regexp_replace(name, '지름길$', '허브')
where name ~ '지름길$';

select id, no, name from public.route_lines order by sort;
