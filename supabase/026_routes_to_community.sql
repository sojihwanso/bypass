-- BYPASS: 준공 현황(routes)의 지름길을 커뮤니티 결과물(posts, kind = 'showcase')로 옮긴다
-- 025 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다
-- (같은 주소의 결과물이 이미 있으면 건너뜁니다).
--
-- 무엇이 어떻게 옮겨지나
--   제목 → 제목, 설명 → 소개, 주소 → 주소
--   종류: 앱(app) → 앱, 위키(wiki) → 위키, 채널(channel) → 도구
--   과목·학부·교수 → 소개 아래 한 줄로
--   '공사 중'이던 것 → 소개 끝에 한 줄로 표시
--   숨김이던 것 → 커뮤니티에서도 숨김(운영진만 보임)
--   올린 날짜 → 그대로 (목록 순서가 유지되도록)
--   쓴 사람 → 운영진 계정 가운데 가장 먼저 가입한 사람 (커뮤니티에서 바로 고칠 수 있게)
-- 옮기지 않는 것
--   '견본'(sample) 표시가 붙은 예시 지름길, 주소가 없는 지름길(결과물은 주소가 있어야 함)
--   아이콘 그림(커뮤니티 썸네일은 글쓴이가 따로 올리는 방식이라 옮길 수 없음)
--
-- routes · route_lines 표는 지우지 않고 보관합니다. 보관 페이지(/archive/routes/)와
-- HQ › 준공 현황(보관)이 계속 읽습니다.

begin;

-- 커뮤니티 글은 원래 '로그인한 본인'만 쓸 수 있고 10분에 5개까지라, 옮기는 동안만 그 검사를 끈다
alter table public.posts disable trigger posts_stamp;

with staff as (
  select u.id,
         coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', 'BYPASS 운영진') as name
    from auth.users u
   where u.raw_app_meta_data ->> 'bypass_role' = 'staff'
   order by u.created_at
   limit 1
),
src as (
  select r.*,
         case when r.url ~* '^http://' then regexp_replace(r.url, '^http://', 'https://', 'i') else r.url end as url2,
         nullif(concat_ws(' · ',
           case when nullif(btrim(r.subject), '') is not null then '과목: ' || btrim(r.subject) end,
           case when nullif(btrim(r.department), '') is not null then '학부: ' || btrim(r.department) end,
           case when nullif(btrim(r.professor), '') is not null then '교수: ' || btrim(r.professor) end
         ), '') as tags
    from public.routes r
   where not r.sample
     and r.url is not null
)
insert into public.posts (created_at, updated_at, kind, category, title, body, url, author, author_name, hidden)
select s.created_at,
       s.updated_at,
       'showcase',
       case s.type when 'app' then '앱' when 'wiki' then '위키' else '도구' end,
       left(btrim(s.title), 100),
       nullif(concat_ws(E'\n\n',
         nullif(btrim(s.description), ''),
         s.tags,
         case when s.status = 'building' then '※ 준공 현황에서 ‘공사 중’이던 결과물입니다.' end
       ), ''),
       s.url2,
       (select id from staff),
       coalesce((select name from staff), 'BYPASS 운영진'),
       s.hidden
  from src s
 where (s.url2 ~* '^https://[^\s<>"]+$' or s.url2 ~ '^/[A-Za-z0-9/_.~%-]*$')
   and not exists (select 1 from public.posts p where p.kind = 'showcase' and p.url = s.url2);

alter table public.posts enable trigger posts_stamp;

comment on table public.routes is '보관(2026-11-10): 커뮤니티 결과물(posts)로 옮김. /archive/routes/ 와 HQ › 준공 현황(보관)에서만 읽는다.';
comment on table public.route_lines is '보관(2026-11-10): 준공 현황 분류. /archive/routes/ 에서만 읽는다.';

commit;

-- 확인: 옮겨진 결과물
select p.id as "번호", p.category as "종류", p.title as "제목", p.url as "주소", case when p.hidden then '숨김' else '' end as "숨김"
  from public.posts p
 where p.kind = 'showcase'
   and exists (select 1 from public.routes r where (case when r.url ~* '^http://' then regexp_replace(r.url, '^http://', 'https://', 'i') else r.url end) = p.url)
 order by p.created_at;
