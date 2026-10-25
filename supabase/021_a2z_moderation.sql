-- BYPASS Alfa to Zulu 운영: 랭킹에서 제외 · 이름 변경 요청
-- 012 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 바뀌는 것
--   1) 사람(a2z_players)마다
--      hidden      : 운영진이 랭킹에서 뺌 (풀 때까지)
--      rename_req  : 이름 변경 요청. 본인이 이름을 바꿀 때까지 랭킹에서 빠지고, 바꾸면 저절로 풀림
--      rename_note : 요청 사유 (본인에게 보임)
--   2) 막힌 이름(a2z_blocked_names): 변경을 요청한 이름은 누구도 다시 쓸 수 없음 (띄어쓰기·대소문자·보이지 않는 글자 무시)
--   3) 종합 순위(a2z_board)는 제외·요청 중인 사람을 빼고 보여 줌
--   4) a2z_me: 본인(열쇠)이 자기 상태를 확인 (요청 받았는지, 제외됐는지)
--   5) 운영진 함수 a2z_admin_players · a2z_admin_set (게임 페이지의 '운영진' 버튼에서 씀)
-- 기록(a2z_runs)은 지우지 않고 그대로 둡니다. 요청이 풀리면 예전 기록이 다시 순위에 올라옵니다.

-- ===== 1) 칸 =====
alter table public.a2z_players add column if not exists hidden      boolean not null default false;
alter table public.a2z_players add column if not exists rename_req  boolean not null default false;
alter table public.a2z_players add column if not exists rename_note text;
alter table public.a2z_players add column if not exists flagged_at  timestamptz;
alter table public.a2z_players drop constraint if exists a2z_players_rename_note_check;
alter table public.a2z_players add  constraint a2z_players_rename_note_check check (rename_note is null or char_length(rename_note) <= 100);

-- 운영진: 새 칸 읽기·고치기 (줄 단위 권한은 012 의 '운영진' 정책)
grant select (id, created_at, nickname, hidden, rename_req, rename_note, flagged_at) on public.a2z_players to authenticated;
grant update (hidden, rename_req, rename_note, flagged_at) on public.a2z_players to authenticated;

-- 이름 비교용: 띄어쓰기·보이지 않는 글자(한글 채움 문자 등)를 빼고 소문자로
create or replace function public.a2z_norm(t text)
returns text language sql immutable set search_path = ''
as $$ select lower(regexp_replace(coalesce(t, ''), '[[:space:]\u3164\u115f\u1160\uffa0\u200b-\u200f\u2060\ufeff]+', '', 'g')) $$;

-- 막힌 이름: 운영진이 변경을 요청한 이름. 요청을 거두면 다시 풀린다
create table if not exists public.a2z_blocked_names (
  norm       text primary key,
  name       text not null,
  player_id  bigint references public.a2z_players (id) on delete set null,
  at         timestamptz not null default now()
);
alter table public.a2z_blocked_names enable row level security;
revoke all on public.a2z_blocked_names from anon, authenticated;
grant select, insert, delete on public.a2z_blocked_names to authenticated;
drop policy if exists "a2z 막힌 이름: 운영진" on public.a2z_blocked_names;
create policy "a2z 막힌 이름: 운영진" on public.a2z_blocked_names for all to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');

-- ===== 2) 닉네임 정하기·바꾸기: 막힌 이름 검사, 바꾸면 요청 풀림 =====
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
  -- 운영진이 변경을 요청했던 이름은 누구도 다시 쓸 수 없다
  if exists (select 1 from public.a2z_blocked_names b where b.norm = public.a2z_norm(n)) then
    raise exception 'blocked nickname' using errcode = '22023';
  end if;
  insert into public.a2z_players (key_hash, nickname) values (h, n)
  on conflict (key_hash) do update
    set nickname = excluded.nickname,
        rename_req = false,
        rename_note = null
  returning id into pid;
  return pid;
end;
$$;

-- ===== 3) 종합 순위: 제외·요청 중인 사람은 빼고 =====
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
    join public.a2z_players p on p.id = b.player_id and not p.hidden and not p.rename_req
    join cnt c on c.player_id = b.player_id
   order by b.ms, b.at
   limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

-- ===== 4) 내 상태 (열쇠를 가진 본인만) =====
create or replace function public.a2z_me(p_key text)
returns table (id bigint, nickname text, rename_req boolean, rename_note text, hidden boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nickname, p.rename_req, p.rename_note, p.hidden
    from public.a2z_players p
   where p_key ~ '^[A-Za-z0-9_-]{32,80}$' and p.key_hash = extensions.digest(p_key, 'sha256');
$$;

-- ===== 5) 운영진 =====
-- 사람 목록 + 고른 방식(p_mode)의 최고 기록. 제외·요청 중인 사람도 모두 보인다
create or replace function public.a2z_admin_players(p_mode text default 'seq')
returns table (id bigint, created_at timestamptz, nickname text, hidden boolean, rename_req boolean, rename_note text,
               best_ms int, mode_runs bigint, all_runs bigint, last_at timestamptz)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select public.bypass_role()) is distinct from 'staff' then raise exception 'staff only' using errcode = '42501'; end if;
  return query
  select p.id, p.created_at, p.nickname, p.hidden, p.rename_req, p.rename_note,
         m.best, coalesce(m.n, 0), coalesce(a.n, 0), a.last_at
    from public.a2z_players p
    left join lateral (select min(r.ms) as best, count(*) as n from public.a2z_runs r where r.player_id = p.id and r.mode = p_mode) m on true
    left join lateral (select count(*) as n, max(r.at) as last_at from public.a2z_runs r where r.player_id = p.id) a on true
   order by (p.rename_req or p.hidden) desc, m.best nulls last, a.last_at desc nulls last, p.id desc
   limit 500;
end;
$$;

-- 한 사람에게 조치: request(이름 변경 요청) · cancel(요청 취소) · hide(랭킹 제외) · unhide(제외 풀기) · clear(기록 모두 지우기)
create or replace function public.a2z_admin_set(p_id bigint, p_action text, p_note text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  note text := nullif(btrim(coalesce(p_note, '')), '');
  nick text;
begin
  if (select public.bypass_role()) is distinct from 'staff' then raise exception 'staff only' using errcode = '42501'; end if;
  if note is not null and char_length(note) > 100 then raise exception 'note too long' using errcode = '22023'; end if;
  if p_action not in ('request', 'cancel', 'hide', 'unhide', 'clear') then raise exception 'bad action' using errcode = '22023'; end if;
  select p.nickname into nick from public.a2z_players p where p.id = p_id;
  if not found then raise exception 'no player' using errcode = 'P0002'; end if;

  if p_action = 'request' then
    update public.a2z_players set rename_req = true, rename_note = note, flagged_at = now() where id = p_id;
    insert into public.a2z_blocked_names (norm, name, player_id) values (public.a2z_norm(nick), nick, p_id)
    on conflict (norm) do nothing;
  elsif p_action = 'cancel' then
    -- 요청을 거두면 그 이름도 다시 쓸 수 있게
    update public.a2z_players set rename_req = false, rename_note = null where id = p_id;
    delete from public.a2z_blocked_names b where b.norm = public.a2z_norm(nick);
  elsif p_action = 'hide' then
    update public.a2z_players set hidden = true, flagged_at = now() where id = p_id;
  elsif p_action = 'unhide' then
    update public.a2z_players set hidden = false where id = p_id;
  else
    delete from public.a2z_runs where player_id = p_id;
  end if;
end;
$$;

revoke all on function public.a2z_norm(text) from public;
revoke all on function public.a2z_me(text) from public;
revoke all on function public.a2z_admin_players(text) from public, anon;
revoke all on function public.a2z_admin_set(bigint, text, text) from public, anon;
grant execute on function public.a2z_norm(text) to anon, authenticated;
grant execute on function public.a2z_me(text) to anon, authenticated;
grant execute on function public.a2z_admin_players(text) to authenticated;
grant execute on function public.a2z_admin_set(bigint, text, text) to authenticated;

-- 확인
select count(*) as "참가자", count(*) filter (where rename_req) as "이름 변경 요청", count(*) filter (where hidden) as "랭킹 제외" from public.a2z_players;
