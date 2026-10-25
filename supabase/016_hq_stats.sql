-- BYPASS HQ 통계: 방문·'이용하기' 기록(stats_events)을 날짜·페이지·지름길별로 묶어 세는 함수
-- 015 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- - 기록 표는 009 에서 만든 stats_events 를 그대로 씁니다. 새 표는 없습니다.
-- - 함수는 부르는 사람의 권한으로 읽으므로(security invoker), 운영진이 아니면 0 만 나옵니다.
-- - 날짜는 한국 시간(Asia/Seoul) 기준입니다.

-- 날짜별 방문·이용하기 (최근 p_days 일, 기록이 없는 날도 0 으로)
create or replace function public.hq_stats_daily(p_days int default 30)
returns table (day date, views bigint, goes bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with span as (
    select (now() at time zone 'Asia/Seoul')::date as today,
           least(greatest(coalesce(p_days, 30), 1), 366) as n
  ), days as (
    select generate_series(s.today - (s.n - 1), s.today, interval '1 day')::date as day from span s
  ), ev as (
    select (e.at at time zone 'Asia/Seoul')::date as day, e.kind
      from public.stats_events e, span s
     where e.at >= ((s.today - (s.n - 1))::timestamp at time zone 'Asia/Seoul')
  )
  select d.day,
         count(ev.kind) filter (where ev.kind = 'view') as views,
         count(ev.kind) filter (where ev.kind = 'go') as goes
    from days d left join ev on ev.day = d.day
   group by d.day
   order by d.day;
$$;

-- 페이지별 방문 (많은 순, 최대 50개)
create or replace function public.hq_stats_pages(p_days int default 30)
returns table (page text, views bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.page, count(*) as views
    from public.stats_events e
   where e.kind = 'view'
     and e.at >= (((now() at time zone 'Asia/Seoul')::date - (least(greatest(coalesce(p_days, 30), 1), 366) - 1))::timestamp at time zone 'Asia/Seoul')
   group by e.page
   order by views desc, e.page
   limit 50;
$$;

-- 지름길별 '이용하기' (많은 순, 최대 50개). 지운 지름길은 이름 없이 번호만
create or replace function public.hq_stats_routes(p_days int default 30)
returns table (route_id bigint, title text, goes bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.route_id, r.title, count(*) as goes
    from public.stats_events e
    left join public.routes r on r.id = e.route_id
   where e.kind = 'go'
     and e.at >= (((now() at time zone 'Asia/Seoul')::date - (least(greatest(coalesce(p_days, 30), 1), 366) - 1))::timestamp at time zone 'Asia/Seoul')
   group by e.route_id, r.title
   order by goes desc, r.title
   limit 50;
$$;

revoke all on function public.hq_stats_daily(int), public.hq_stats_pages(int), public.hq_stats_routes(int) from public, anon;
grant execute on function public.hq_stats_daily(int), public.hq_stats_pages(int), public.hq_stats_routes(int) to authenticated;

-- 확인: 최근 7일
select * from public.hq_stats_daily(7);
