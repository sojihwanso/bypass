-- BYPASS 과목 자료 허브: 개통 노선도 3번 표지판
-- 010 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 바뀌는 것
--   1) 분류(route_lines)에 종류 칸: 'shortcut'(지름길) | 'hub'(자료 허브)
--      자료 허브 표지판에서는 학부·교수님으로 거르고 정렬해 볼 수 있음
--   2) 지름길(routes)에 학부(department)·교수(professor) 칸
--   3) 3번 표지판 '과목 자료 허브'를 만들고, 지금 있는 위키를 모두 이곳으로 옮김 (처음 한 번만)

-- ===== 1) 분류 종류 =====
alter table public.route_lines add column if not exists kind text not null default 'shortcut';
alter table public.route_lines drop constraint if exists route_lines_kind_check;
alter table public.route_lines add  constraint route_lines_kind_check check (kind in ('shortcut', 'hub'));

-- ===== 2) 학부 · 교수 =====
alter table public.routes add column if not exists department text;
alter table public.routes add column if not exists professor  text;
alter table public.routes drop constraint if exists routes_department_check;
alter table public.routes add  constraint routes_department_check check (department is null or char_length(department) between 1 and 40);
alter table public.routes drop constraint if exists routes_professor_check;
alter table public.routes add  constraint routes_professor_check check (professor is null or char_length(professor) between 1 and 40);
-- 005 에서 칸마다 쓰기 권한을 주었으므로 새 칸도 따로 준다 (쓰기는 지금처럼 운영진만: 정책)
grant insert (department, professor), update (department, professor) on public.routes to authenticated;

-- ===== 3) 과목 자료 허브 표지판 + 위키 옮기기 (표지판이 처음 생길 때만) =====
do $$
begin
  if not exists (select 1 from public.route_lines where id = 'hub') then
    insert into public.route_lines (id, name, no, color, description, sort, kind)
    values ('hub', '과목 자료 허브', '3', '#1F5C99',
            '흩어진 과목 자료를 한곳에 모았습니다. 학부·교수님별로 찾아보십시오.',
            (select coalesce(max(sort), 0) + 10 from public.route_lines), 'hub');
    update public.routes r
       set line = 'hub',
           sort = s.n * 10
      from (select id, row_number() over (order by line, sort, created_at) as n
              from public.routes where type = 'wiki') s
     where r.id = s.id;
  end if;
end $$;

-- 확인: 실행 결과에 표지판과 허브로 옮긴 자료가 보입니다.
select l.no as "번호", l.name as "표지판", l.kind as "종류",
       (select count(*) from public.routes r where r.line = l.id) as "항목 수"
  from public.route_lines l order by l.sort, l.id;
