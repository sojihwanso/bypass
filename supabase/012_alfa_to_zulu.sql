-- BYPASS · Alfa to Zulu 종합 랭킹
-- 011 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 바뀌는 것
--   1) 연습한 사람(a2z_players)과 완주 기록(a2z_runs) 표. 로그인 없이 닉네임만으로 참여
--      - 브라우저마다 비밀 열쇠를 만들어 두고, 서버에는 열쇠의 지문(sha256)만 저장
--      - 표를 직접 읽고 쓰는 길은 막고, 아래 함수로만 올리고 읽음 (운영진은 지우기 가능)
--   2) 함수: a2z_join(닉네임 정하기·바꾸기) · a2z_submit(기록 올리기) · a2z_board(종합 순위)
--   3) 개통 노선도 3번 표지판(과목 자료 허브)에 'Alfa to Zulu' 추가 (처음 한 번만)

create extension if not exists pgcrypto with schema extensions;

-- ===== 1) 표 =====
create table if not exists public.a2z_players (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  key_hash    bytea not null unique,
  nickname    text not null check (char_length(nickname) between 1 and 16)
);

create table if not exists public.a2z_runs (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  player_id  bigint not null references public.a2z_players (id) on delete cascade,
  mode       text not null check (mode in ('seq', 'mix', 'dseq', 'dmix', 'aseq', 'amix')),
  ms         int not null check (ms between 1000 and 3600000),     -- 기록(힌트 1회당 +3초 포함)
  raw        int not null check (raw between 1000 and 3600000),    -- 실제 걸린 시간
  err        int not null default 0 check (err between 0 and 10000),
  hints      int not null default 0 check (hints between 0 and 100),
  acc        numeric(4, 3) not null default 1 check (acc between 0 and 1)
);
create index if not exists a2z_runs_mode_ms_idx on public.a2z_runs (mode, ms);
create index if not exists a2z_runs_player_idx on public.a2z_runs (player_id, at);

drop trigger if exists a2z_players_touch on public.a2z_players;
create trigger a2z_players_touch before update on public.a2z_players
  for each row execute function public.bypass_touch_updated_at();

alter table public.a2z_players enable row level security;
alter table public.a2z_runs    enable row level security;
revoke all on public.a2z_players, public.a2z_runs from anon, authenticated;
-- 운영진은 장난 기록을 지울 수 있다 (Supabase Table Editor 또는 HQ)
grant select (id, created_at, nickname), delete on public.a2z_players to authenticated;
grant select, delete on public.a2z_runs to authenticated;
drop policy if exists "a2z 사람: 운영진" on public.a2z_players;
create policy "a2z 사람: 운영진" on public.a2z_players for all to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');
drop policy if exists "a2z 기록: 운영진" on public.a2z_runs;
create policy "a2z 기록: 운영진" on public.a2z_runs for all to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');

-- ===== 2) 함수 =====
-- 닉네임 정하기·바꾸기. 같은 열쇠면 같은 사람. 돌려주는 값: 내 번호
create or replace function public.a2z_join(p_key text, p_nick text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  n text := btrim(regexp_replace(coalesce(p_nick, ''), '\s+', ' ', 'g'));
  h bytea;
  pid bigint;
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9_-]{32,80}$' then raise exception 'bad key' using errcode = '22023'; end if;
  if char_length(n) not between 1 and 16 or n ~ '[<>]' then raise exception 'bad nickname' using errcode = '22023'; end if;
  h := extensions.digest(p_key, 'sha256');
  insert into public.a2z_players (key_hash, nickname) values (h, n)
  on conflict (key_hash) do update set nickname = excluded.nickname
  returning id into pid;
  return pid;
end;
$$;

-- 완주 기록 올리기. 너무 빠르거나 계산이 맞지 않는 기록, 너무 잦은 기록은 받지 않는다
create or replace function public.a2z_submit(p_key text, p_mode text, p_ms int, p_raw int, p_err int, p_hints int, p_acc numeric)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid bigint;
  words int := case when p_mode in ('seq', 'mix') then 26 when p_mode in ('dseq', 'dmix') then 11 else 37 end;
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9_-]{32,80}$' then raise exception 'bad key' using errcode = '22023'; end if;
  select id into pid from public.a2z_players where key_hash = extensions.digest(p_key, 'sha256');
  if pid is null then raise exception 'join first' using errcode = 'P0002'; end if;
  if p_mode not in ('seq', 'mix', 'dseq', 'dmix', 'aseq', 'amix') then raise exception 'bad mode' using errcode = '22023'; end if;
  -- 단어마다 최소 0.3초, 기록 = 실제 시간 + 힌트 × 3초
  if p_raw < words * 300 or abs(p_ms - (p_raw + coalesce(p_hints, 0) * 3000)) > 50 then raise exception 'bad time' using errcode = '22023'; end if;
  if exists (select 1 from public.a2z_runs where player_id = pid and at > now() - interval '3 seconds') then
    raise exception 'too fast' using errcode = '22023';
  end if;
  insert into public.a2z_runs (player_id, mode, ms, raw, err, hints, acc)
  values (pid, p_mode, p_ms, p_raw, greatest(0, coalesce(p_err, 0)), greatest(0, coalesce(p_hints, 0)), least(1, greatest(0, coalesce(p_acc, 1))));
  return pid;
end;
$$;

-- 종합 순위: 사람마다 가장 빠른 기록 하나
create or replace function public.a2z_board(p_mode text, p_limit int default 100)
returns table (player_id bigint, nickname text, best_ms int, err int, hints int, acc numeric, at timestamptz, runs bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select distinct on (r.player_id) r.player_id, r.ms, r.err, r.hints, r.acc, r.at
      from public.a2z_runs r
     where r.mode = p_mode
     order by r.player_id, r.ms, r.at
  ), cnt as (
    select r.player_id, count(*) as runs from public.a2z_runs r where r.mode = p_mode group by r.player_id
  )
  select b.player_id, p.nickname, b.ms, b.err, b.hints, b.acc, b.at, c.runs
    from best b
    join public.a2z_players p on p.id = b.player_id
    join cnt c on c.player_id = b.player_id
   order by b.ms, b.at
   limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.a2z_join(text, text) from public;
revoke all on function public.a2z_submit(text, text, int, int, int, int, numeric) from public;
revoke all on function public.a2z_board(text, int) from public;
grant execute on function public.a2z_join(text, text) to anon, authenticated;
grant execute on function public.a2z_submit(text, text, int, int, int, int, numeric) to anon, authenticated;
grant execute on function public.a2z_board(text, int) to anon, authenticated;

-- ===== 3) 노선도에 올리기 (같은 주소가 없을 때만) =====
insert into public.routes (title, type, line, status, url, description, subject, sort)
select 'Alfa to Zulu', 'app',
       coalesce((select id from public.route_lines where id = 'hub'), (select id from public.route_lines order by sort limit 1)),
       'open', '/tools/alfa-to-zulu/',
       'IMO SMCP 포네틱 알파벳과 숫자 발음을 타자로 익히고, 다른 사람들과 기록을 겨룹니다.',
       '해사통신영어',
       (select coalesce(max(sort), 0) + 10 from public.routes where line = 'hub')
where not exists (select 1 from public.routes where url = '/tools/alfa-to-zulu/');

-- 확인
select title as "이름", line as "분류", url as "주소" from public.routes where url = '/tools/alfa-to-zulu/';
