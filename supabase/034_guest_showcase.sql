-- BYPASS: 로그인 안 한 손님도 결과물 둘러보기
-- 033 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 손님(anon)에게 보이는 것: 숨기지 않은 결과물의 제목·설명·주소·썸네일·분류·올린 사람 닉네임·좋아요 수
-- 안 보이는 것: 게시판 글, 댓글, 회의실, 숨긴 결과물, 회원 번호(uuid) 등 나머지 전부
-- posts 표를 손님에게 여는 대신, 필요한 칸만 돌려주는 함수 하나만 엽니다.

create or replace function public.guest_showcase()
returns table (
  id bigint,
  created_at timestamptz,
  category text,
  title text,
  body text,
  url text,
  thumb_url text,
  author_name text,
  likes bigint,
  pin_rank int
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.created_at, p.category, p.title, p.body, p.url, p.thumb_url, p.author_name,
         (select count(*) from public.post_likes l where l.post_id = p.id) as likes,
         p.pin_rank::int
    from public.posts p
   where p.kind = 'showcase' and not p.hidden
   order by p.pin_rank nulls last, p.created_at desc
   limit 500
$$;

revoke all on function public.guest_showcase() from public;
grant execute on function public.guest_showcase() to anon, authenticated;

-- 확인: 손님에게 보일 결과물 수
select count(*) as "손님에게 보이는 결과물" from public.guest_showcase();
