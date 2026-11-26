# 선사록 해운 소식 자동 수집 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase Edge Function `ship-news`가 하루 한 번 해운 소식을 모아 두고, 선사록(v3.1.0)이 이를 받아 기존 40건과 합쳐 보여 준다.

**Architecture:** 함수는 외부 라이브러리 없는 `index.ts` 한 파일(대시보드에 붙여 넣기 위해). RSS 해석·고르기·분류·중복 제거는 export한 순수 함수로 두고 Node(`node --test`, 타입 제거 실행)로 시험한다. 저장은 REST(`/rest/v1/ship_news`)로, `market` 함수와 같은 방식. 앱은 `NEWS_FEED.url`만 채우고 캐시를 쌓는 방식으로 바꾼다.

**Tech Stack:** Deno(Supabase Edge) TypeScript, Postgres SQL, 바닐라 JS, Node 26 `node:test`, playwright-core.

**Spec:** `docs/superpowers/specs/2026-11-26-sasarok-news-feed-design.md`

## Global Constraints
- 함수 응답: `{updated, items:[{d,c,t,s,u,p}]}`, 최근 30일, 최신순, 최대 200건. 저장 45일.
- 24시간 지난 뒤 첫 요청 때만 수집. 수집 시작 때 `last_fetch`를 먼저 갱신(동시 수집 방지).
- 외부 요청 각 8초 제한, 실패한 수집처는 건너뜀. 기사 본문은 저장하지 않음(제목 200자, 요약 120자, 매체 40자).
- CORS: `market`과 같은 BYPASS 주소 목록, GET·OPTIONS.
- `Deno`가 없는 곳(Node 테스트)에서도 import 가능해야 함: `typeof Deno !== 'undefined'`일 때만 `Deno.serve`.
- 앱: 브라우저 캐시는 덮어쓰지 않고 합침(90일·500건), 6시간 안이면 서버에 묻지 않음. 함수 없거나 실패해도 40건은 늘 보임.
- 분류 10개: 기존 7개 + 조선, 항만, 해외 해운사.
- 버전 v3.1.0, 패치노트 같은 커밋.

## Review Focus
1. RSS에 CDATA, HTML 엔티티, 태그가 섞인 제목·요약 → 깨끗한 글자. → Task 1 `parse-cdata-entities`.
2. 같은 기사가 전문지와 구글 뉴스(제목 끝 ' - 매체명')에 함께 → 하나만. → Task 1 `dedupe-title-key`.
3. 수집처 하나가 시간 초과·404 → 나머지로 계속, 오류 기록. → Task 2 `refresh-skips-failed-source`.
4. 함수 응답이 이상한 모양(배열 아님, 잘못된 날짜·주소) → 앱이 멈추지 않고 무시. → Task 4 `feed-bad-shape`.
5. 캐시가 6시간 안이면 서버를 부르지 않음. → Task 4 `feed-cache-skips-fetch`.

---

### Task 1: 순수 함수 (해석·고르기·분류·중복)
**Files:** Create `supabase/functions/ship-news/index.ts`(이 Task는 export 함수만), Test `docs/superpowers/tests/ship_info/fn/ship-news.test.mjs`
**Interfaces (Produces):**
- `parseRss(xml: string, fallbackSource: string): Raw[]`, `Raw = {t, u, d, s, p}` — `<item>`마다 title/link/pubDate/description/source. 날짜는 한국 시간 YYYY-MM-DD. 구글 뉴스는 `<source>`를 매체로, 제목 끝 ` - <매체>`를 뗀다.
- `isMaritime(t: string): boolean` — 해운 낱말 목록.
- `classify(t: string, p: string): string` — spec 순서의 낱말 규칙.
- `titleKey(t: string): string` — 괄호 안·특수문자·공백 제거, 앞 30글자.
- `pickItems(raws: Raw[], fromSearch: boolean): Item[]` — 검색 결과면 `isMaritime` 통과만, 정리·분류 붙임.
- `dedupe(items: Item[]): Item[]` — 주소 또는 titleKey 같은 것 첫 하나만.
- `SOURCES: {name, url, search: boolean}[]` — spec 목록.
- [ ] 테스트: `parse-cdata-entities`, `parse-google-source`(제목 ' - 연합뉴스' 제거, s='연합뉴스'), `date-kst`(`Wed, 26 Nov 2026 16:30:00 GMT` → `2026-11-27`), `maritime-filter`, `classify-rules`(조선소 수주→조선, 부산항 물동량→항만, 머스크 실적→해외 해운사보다 '실적과 시황'? spec 순서대로 실적과 시황), `dedupe-title-key`, `summary-trim`(태그 제거, 120자, 제목과 같으면 빈 값).
- [ ] `node --test docs/superpowers/tests/ship_info/fn/` FAIL → 구현 → PASS → Commit.

### Task 2: 수집·저장·응답 (`handle`)
**Files:** Modify `supabase/functions/ship-news/index.ts`; Create `supabase/038_ship_news.sql`; Test 같은 파일에 추가
**Interfaces:** `handle(req: Request, deps = {env, http, now}): Promise<Response>` — `http`는 fetch 대체(테스트에서 가짜). 흐름: OPTIONS → CORS 204. GET → meta 읽기 → 24시간 지났으면 meta 갱신 → `refresh()`(SOURCES 병렬, 8초 AbortController, 해석·고르기·중복 → upsert `on_conflict=u`, 45일 지난 것 delete, meta last_ok/last_error) → 최근 30일 200건 select → JSON(`Cache-Control: public, max-age=600`).
- SQL: `ship_news`(u text pk, d date, c text, t text, s text, p text, k text, fetched_at timestamptz default now()), 인덱스 d desc, `ship_news_meta`(id int pk check id=1, last_fetch, last_ok, last_error), RLS 켜고 anon·authenticated 권한 회수(함수만 service role로 씀). 여러 번 실행해도 안전.
- [ ] 테스트(가짜 http): `refresh-when-stale`(meta 25시간 전 → 수집처 호출, upsert 본문에 항목, 응답 items), `no-refresh-when-fresh`(1시간 전 → 수집처 호출 0), `refresh-skips-failed-source`(한 곳 500 → 나머지 저장, last_error에 이름), `cors-options`, `response-shape`(필드 d,c,t,s,u,p만).
- [ ] FAIL → 구현 → PASS → Commit.

### Task 3: README
**Files:** Create `supabase/functions/ship-news/README.md` — `market/README.md` 형식: SQL 실행, 함수 올리기(이름 `ship-news`, Verify JWT 끔), 확인 방법(브라우저로 함수 주소 열어 JSON), 알아 둘 것(하루 한 번, 수집처, 용량, 실패 시 Logs).
- [ ] Commit(Task 2와 함께 가능).

### Task 4: 앱 연결 (v3.1.0)
**Files:** Modify `apps/ship_info/index.html` (`NEWS_CATS`, `NEWS_FEED`, `fetchFeed`, 캐시 읽기, `renderNewsItem`, 소식 화면 안내 줄, 버전·패치노트), Test `docs/superpowers/tests/ship_info/tests/23-news-feed.test.mjs`
- `NEWS_FEED = {url:'https://itzdjdgjqcpmxdfssfel.supabase.co/functions/v1/ship-news', refreshMinutes:360, cacheKey:'sasarok-news-cache-v2'}`. 캐시 형식 `{at: ms, items:[…]}`. 새로 받으면 기존 캐시 items와 주소로 합쳐 90일·500건으로 자름.
- 자동 수집 항목은 표시 `auto:true`(서버·캐시에서 온 것), 목록 meta에 `<span class="auto">자동 수집</span>`.
- `NEWS_CATS`에 '조선','항만','해외 해운사' 추가.
- 안내 줄: 성공 "하루 한 번 자동으로 새 소식을 받습니다. 마지막 갱신 M월 D일 H시." (`updated` 기준), 실패 "소식 서버에 연결하지 못해 저장된 소식을 보여 줍니다."
- [ ] 테스트(page.route로 함수 주소 가짜 응답): `feed-merges`(가짜 2건 → 목록에 보이고 '자동 수집' 표시, 분류 칩 '조선' 있음), `feed-cache-skips-fetch`(캐시 at=지금 → 요청 0), `feed-cache-accumulates`(캐시 1건 + 응답 1건 다른 주소 → 둘 다 보임, 캐시에 2건), `feed-bad-shape`(응답 `{"items":"x"}`와 잘못된 항목 → 오류 0, 40건 그대로), `feed-fail-status`(500 → 실패 안내 줄).
- [ ] FAIL → 구현 → PASS, 전체 run.mjs PASS → 버전 3.1.0·패치노트 → Commit.

### 마무리
- 최종 검토 에이전트 1회 → Critical/Important TDD로 고침.
- fetch·rebase·push, 배포 확인. 함수를 올리기 전이므로 실제 사이트에서는 실패 안내 줄이 나오는 것이 정상(사용자가 올린 뒤 확인).
- HANDOFF.md, 메모 갱신, 작업 폴더 정리.
