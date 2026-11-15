-- BYPASS: 커뮤니티 홈 '미국 증시' — 회원마다 보는 종목 + 시세 임시 저장
-- 027 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 쓰는 곳
--   - 커뮤니티 홈 › 미국 증시: 내 종목 목록(market_watch)을 읽고·고칩니다. 목록이 없으면 S&P 500·나스닥·다우를 보여 줍니다.
--   - Edge Function 'market' (supabase/functions/market): 시세를 Yahoo Finance 에서 받아 market_cache 에 몇 분 동안 담아 둡니다.
--     같은 종목을 여러 사람이 봐도 Yahoo 에는 몇 분에 한 번만 묻습니다.
-- 누가 보나: 내 종목 목록은 나만 읽고 고칩니다. market_cache 는 함수만 씁니다 (회원은 직접 못 읽음).

-- ===== 1) 내 종목 =====
create table if not exists public.market_watch (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  symbols    text[] not null default '{}' check (
               cardinality(symbols) <= 12
               and (cardinality(symbols) = 0 or array_to_string(symbols, ',') ~ '^[A-Z0-9.^=-]{1,15}(,[A-Z0-9.^=-]{1,15})*$')
             ),
  updated_at timestamptz not null default now()
);

create or replace function public.market_watch_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists market_watch_touch on public.market_watch;
create trigger market_watch_touch before insert or update on public.market_watch
  for each row execute function public.market_watch_touch();

alter table public.market_watch enable row level security;
revoke all on public.market_watch from anon, authenticated;
grant select, insert, update, delete on public.market_watch to authenticated;

drop policy if exists "종목: 내 것 읽기" on public.market_watch;
create policy "종목: 내 것 읽기" on public.market_watch for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "종목: 내 것 쓰기" on public.market_watch;
create policy "종목: 내 것 쓰기" on public.market_watch for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "종목: 내 것 고치기" on public.market_watch;
create policy "종목: 내 것 고치기" on public.market_watch for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "종목: 내 것 지우기" on public.market_watch;
create policy "종목: 내 것 지우기" on public.market_watch for delete to authenticated
  using (user_id = (select auth.uid()));

-- ===== 2) 시세 임시 저장 (함수 전용) =====
create table if not exists public.market_cache (
  key        text primary key check (char_length(key) <= 80),
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.market_cache enable row level security;
revoke all on public.market_cache from anon, authenticated;
-- 정책이 없으므로 회원·방문자는 읽지도 쓰지도 못합니다. Edge Function 이 service_role 로만 씁니다.

-- 오래된 임시 시세 정리 (하루 지난 것) — 함수가 가끔 부릅니다
create or replace function public.market_cache_prune()
returns void language sql security definer set search_path = '' as $$
  delete from public.market_cache where fetched_at < now() - interval '1 day';
$$;
revoke all on function public.market_cache_prune() from public, anon, authenticated;
