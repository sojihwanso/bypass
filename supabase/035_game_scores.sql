-- BYPASS: 숨은 미니게임(컨테이너 쌓기) 크루 랭킹
-- 034 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- - 회원마다 게임별 최고 기록 하나만 남깁니다 (더 높을 때만 바뀜).
-- - 표는 직접 못 건드리고, 아래 함수 두 개로만 기록하고 읽습니다.
-- - 이름은 기록할 때 저장하지 않고 읽을 때 지금 닉네임을 붙입니다 (닉네임을 바꾸면 랭킹에도 바로).
-- - 게임은 브라우저에서 돌아가서 마음먹고 조작하면 막기 어렵습니다. 말이 안 되는 점수(300층 넘게)와
--   너무 잦은 기록(3초에 한 번 넘게)만 거릅니다. 이상한 기록은 운영진이 HQ 대신 SQL 로 지우면 됩니다:
--   delete from public.game_scores where user_id = '회원 번호';

create table if not exists public.game_scores (
  game       text not null check (game ~ '^[a-z0-9-]{1,30}$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  best       int  not null check (best between 0 and 300),
  plays      int  not null default 1,
  updated_at timestamptz not null default now(),
  primary key (game, user_id)
);
create index if not exists game_scores_rank_idx on public.game_scores (game, best desc, updated_at);
alter table public.game_scores enable row level security;
revoke all on public.game_scores from anon, authenticated;

-- 기록 남기기: 돌려주는 값 = { best, rank, total, new_best }
create or replace function public.submit_game_score(p_game text, p_score int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  prev public.game_scores;
  b int;
  r int;
  n int;
  nb boolean;
begin
  if me is null then raise exception 'login required' using errcode = '42501'; end if;
  if p_game !~ '^[a-z0-9-]{1,30}$' then raise exception 'bad game' using errcode = '22023'; end if;
  if p_score is null or p_score < 0 or p_score > 300 then raise exception 'bad score' using errcode = '22023'; end if;
  select * into prev from public.game_scores where game = p_game and user_id = me;
  nb := not found or p_score > prev.best;
  if prev.updated_at > now() - interval '3 seconds' then raise exception 'too fast' using errcode = '54000'; end if;
  insert into public.game_scores as g (game, user_id, best, plays, updated_at)
       values (p_game, me, p_score, 1, now())
  on conflict (game, user_id) do update
       set plays = g.plays + 1,
           updated_at = now(),
           best = greatest(g.best, excluded.best)
  returning best into b;
  select count(*) + 1 into r from public.game_scores where game = p_game and best > b;
  select count(*) into n from public.game_scores where game = p_game;
  return jsonb_build_object('best', b, 'rank', r, 'total', n, 'new_best', nb);
end;
$$;

-- 랭킹 읽기: 상위 p_limit 명 + 내 순위 (회원만)
create or replace function public.game_top(p_game text, p_limit int default 10)
returns table (rank bigint, name text, best int, updated_at timestamptz, me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select rank() over (order by s.best desc) as rank,
           coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), u.raw_user_meta_data ->> 'username', '회원') as name,
           s.best, s.updated_at, s.user_id = auth.uid() as me,
           row_number() over (order by s.best desc, s.updated_at) as rn
      from public.game_scores s
      join auth.users u on u.id = s.user_id
     where s.game = p_game and auth.uid() is not null
  )
  select rank, name, best, updated_at, me from ranked
   where rn <= least(greatest(coalesce(p_limit, 10), 1), 50) or me
   order by rn
$$;

revoke all on function public.submit_game_score(text, int), public.game_top(text, int) from public, anon;
grant execute on function public.submit_game_score(text, int), public.game_top(text, int) to authenticated;

-- 확인
select count(*) as "기록 수" from public.game_scores;
