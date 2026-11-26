-- BYPASS: 선사록 '해운 소식' 자동 수집 — 소식 담아 두는 표
-- 037 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 쓰는 곳
--   - Edge Function 'ship-news' (supabase/functions/ship-news): 하루 한 번 해운 소식을 모아 ship_news 에 담고,
--     선사록이 부르면 여기서 꺼내 돌려줍니다.
-- 누가 보나: 회원·방문자는 표를 직접 읽거나 쓰지 못합니다. 함수가 service_role 로만 씁니다.
-- 담는 것: 제목·매체·날짜·원문 주소·짧은 요약만 (기사 본문은 담지 않음). 45일 지난 소식은 함수가 지웁니다.

create table if not exists public.ship_news (
  u          text primary key check (char_length(u) <= 1000),   -- 원문(또는 구글 뉴스) 주소
  d          date not null,                                      -- 기사 날짜 (한국 시간)
  c          text not null check (char_length(c) <= 20),         -- 분류
  t          text not null check (char_length(t) <= 200),        -- 제목
  s          text not null default '' check (char_length(s) <= 40),   -- 매체
  p          text not null default '' check (char_length(p) <= 120),  -- 요약
  k          text not null default '' check (char_length(k) <= 40),   -- 같은 기사 판정용 제목 키
  fetched_at timestamptz not null default now()
);
create index if not exists ship_news_fetched_idx on public.ship_news (fetched_at desc, d desc);
create index if not exists ship_news_d_idx on public.ship_news (d);

create table if not exists public.ship_news_meta (
  id         int primary key check (id = 1),
  last_fetch timestamptz,        -- 마지막으로 모으기 시작한 때
  last_ok    timestamptz,        -- 마지막으로 다 모은 때
  last_error text                -- 받지 못한 수집처
);

alter table public.ship_news enable row level security;
alter table public.ship_news_meta enable row level security;
revoke all on public.ship_news from anon, authenticated;
revoke all on public.ship_news_meta from anon, authenticated;
-- 정책이 없으므로 회원·방문자는 읽지도 쓰지도 못합니다. Edge Function 이 service_role 로만 씁니다.
