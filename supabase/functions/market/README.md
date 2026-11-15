# 미국 증시 시세 설정 (한 번만)

커뮤니티 홈 › **미국 증시** 칸이 동작하려면 두 가지를 해 두어야 합니다.
GitHub 토큰이나 API 키는 **필요 없습니다**.

## 1. SQL 실행

Supabase SQL Editor에서 `supabase/028_market_watch.sql` 전체를 붙여 넣고 **Run** 을 누릅니다.
- 회원마다 보는 종목 목록(`market_watch`)과 시세를 몇 분 동안 담아 두는 표(`market_cache`)가 생깁니다.
- 이걸 안 해도 칸은 보이지만, 종목을 바꾸면 그 기기에서만 바뀌고 새로 고치면 기본 종목으로 돌아갑니다.

## 2. 함수 올리기 — Supabase 프로젝트 주인이 함

1. Supabase 대시보드 → 왼쪽 **Edge Functions** → **Deploy a new function** → **Via Editor**
2. 함수 이름: `market` (정확히 이 이름)
3. 편집기 내용을 지우고, 이 폴더의 `index.ts` 전체를 붙여 넣은 뒤 **Deploy**
4. 함수 화면의 **Details**(또는 Settings)에서 **Verify JWT / Enforce JWT verification** 을 끕니다. 로그인 여부는 함수가 직접 확인합니다.

비밀 값(Secrets)은 넣을 것이 없습니다. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase 가 자동으로 넣어 줍니다.

함수를 올리기 전에는 홈에 "시세 기능을 준비하고 있어요"라고만 보입니다.

## 알아 둘 것

- 시세는 Yahoo Finance 의 무료 차트 API 에서 받습니다. **실시간이 아니고 몇 분 늦을 수 있습니다.**
- 같은 종목은 1일 그래프 2분, 5일 10분, 1달 30분, 6달·1년 1시간, 5년 6시간 동안 `market_cache` 에 담아 두고 다시 묻지 않습니다.
  회원이 많아도 Yahoo 에는 그만큼만 묻습니다.
- Yahoo 가 막거나 응답 모양을 바꾸면 "지금은 시세를 불러오지 못했어요"가 뜹니다. 이때는 Edge Functions › `market` › Logs 를 확인해 주세요.
- 한 사람이 넣을 수 있는 종목은 12개까지입니다. 미국 주식·ETF·지수(^GSPC 등)·환율(KRW=X)을 넣을 수 있습니다.
