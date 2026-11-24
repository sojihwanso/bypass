# 선사록 홈 개편과 디자인 심사 반영 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선사록 홈에 항구 일러스트 히어로를 넣고, 디자인 심사(29/40)에서 나온 문제를 작은 것까지 모두 고친 v1.0.0을 만든다.

**Architecture:** `apps/ship_info/index.html` 한 파일(인라인 CSS·JS, 해시 라우팅)을 그대로 유지하며 고친다. 그림만 `apps/ship_info/assets/`에 webp로 둔다. 검증은 playwright-core로 로컬 정적 서버를 열어 DOM을 확인하는 Node 스크립트로 한다.

**Tech Stack:** 정적 HTML/CSS/바닐라 JS, Pretendard, playwright-core(검증용, `/Users/turo/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core`, Chrome 채널), Python 3 + Pillow 13(그림 변환), `python3 -I -m http.server`.

**Spec:** `docs/superpowers/specs/2026-11-24-sasarok-home-and-critique-fixes-design.md`

## Global Constraints

- 수정은 `apps/ship_info/` 안에서만. 검증 스크립트는 `docs/superpowers/tests/ship_info/`.
- **커밋·푸시 금지** (사용자가 말할 때까지). 각 태스크 끝의 "Commit" 단계 대신 "변경 확인(`git status --short apps/ship_info`)"만 한다.
- 파일·폴더 삭제가 필요하면 먼저 사용자에게 묻는다.
- 다크모드 유지, '개인이 만든 자료 모음이며 회사나 학교와 관계가 없습니다' 고지와 자료 출처 유지, 제보 게시판 '저장 안 됨' 표시 유지.
- 데이터(CO, TYPES, CAP, JOB, NEWS 등) 내용은 바꾸지 않는다. 표시 방식만 바꾼다.
- 버전 `1.0.0`. 버전 표시는 우측 상단(버전 왼쪽, bypass 로고 오른쪽)과 최하단 중앙. 버전 5번 누르면 이스터에그 카드(`Ver.1.0.0`, `Made by "Bypass"`, '패치노트' 버튼). 패치노트 최신이 위.
- bypass 로고: `/assets/favicon.svg`, 링크 `https://teambypass.vercel.app/`.
- 주황 바탕 위 글자는 `#16181d`(흰색 금지). 강조색 토큰 값은 그대로.
- 대비: 본문·버튼 글자 4.5:1 이상(라이트·다크 모두).
- 확인 폭: 1440×900, 390×844. 테마: light, dark.

## Review Focus

1. 해시에 필터가 담긴 주소(`#type-container?cadet=1`)를 새로고침·공유했을 때 같은 표가 그대로 나와야 한다 → Task 6 테스트 `hash-roundtrip`.
2. localStorage가 막힌 환경(사파리 개인정보 모드)에서도 비교 담기가 동작해야 한다(저장만 안 됨) → Task 6 테스트 `cmp-no-storage`.
3. 저장된 비교 목록에 지금 데이터에 없는 회사 이름이 들어 있어도 비교 화면이 깨지지 않아야 한다 → Task 6 테스트 `cmp-stale-name`.
4. 다크모드에서 히어로 그림이 밤 그림으로 바뀌고 제목 대비가 유지돼야 한다 → Task 1 테스트 `hero-theme-swap`.
5. 390px 폭에서 가로 스크롤이 생기지 않아야 한다(표 포함) → Task 3 테스트 `no-hscroll-mobile`.

---

### Task 0: 검증 도구와 그림 준비

**Files:**
- Create: `docs/superpowers/tests/ship_info/lib.mjs`, `docs/superpowers/tests/ship_info/run.mjs`
- Create: `apps/ship_info/assets/hero-day.webp`, `apps/ship_info/assets/hero-night.webp`
- 원본: 세션 임시 폴더 `scratchpad/sasarok-mock/banner-day.jpg`(1376×768), `banner-night.png`(1024×572)

**Interfaces:**
- Produces: `lib.mjs`가 `export async function withPage({width,height,theme,hash}, fn)`(테마는 localStorage `sasarok-theme-v1`에 미리 넣음, 서버 `http://127.0.0.1:8765/index.html`), `export function assert(cond, msg)`, `export const results`. `run.mjs`는 `tests/*.test.mjs`를 차례로 import해 실행하고 PASS/FAIL 개수를 출력, 실패 있으면 exit 1.
- 각 테스트 파일은 `export default [{name, fn}]` 형태.

- [ ] **Step 1:** `lib.mjs`, `run.mjs` 작성. 서버는 실행 전에 `python3 -I -m http.server 8765 --bind 127.0.0.1 --directory apps/ship_info`를 백그라운드로 켠다(스크립트가 켜지 않음).
- [ ] **Step 2:** 빈 상태로 `node docs/superpowers/tests/ship_info/run.mjs` → `0 passed, 0 failed`.
- [ ] **Step 3:** 그림 변환(`python3 -I`, Pillow). 두 그림 모두 위에서부터 높이의 80%만 남겨 자르고(밤 그림 워터마크 y≈483/572 제거), `WEBP quality=85 method=6`으로 저장. 결과 크기: day 1376×614, night 1024×458.
- [ ] **Step 4:** 두 webp를 열어 눈으로 확인: 워터마크 없음, 왼쪽 하늘 비어 있음.

### Task 1: 홈 히어로와 홈 배치 (layout)

**Files:** Modify `apps/ship_info/index.html` (홈 마크업 407-448행, 홈 CSS, `renderHome()` 1161행, `renderFav()` 1151행). Test: `tests/home.test.mjs`

**Interfaces:**
- Produces: 마크업 `section.hero` (`img.hero-day`, `img.hero-night`, `h1`, `p.hero-lead`, `a.hero-cta[href="#types-h"]`), 홈 그리드 순서 `.types` → `.fav` → `.news` → `.bshell` → `.bypass`. `.intro` 블록은 히어로로 대체되어 사라짐.

- [ ] **Step 1: 실패하는 테스트** `home.test.mjs`
  - `hero-present`: `#v-home .hero h1` 텍스트가 `배 종류부터 정하면지원할 회사가 좁혀집니다`(공백 제거 비교), `.hero-cta` 텍스트 `선종 고르기`.
  - `hero-theme-swap`: light에서 `img.hero-day` 보이고 `img.hero-night` `display:none`; dark에서 반대. dark에서 `h1` 색 대비(배경 `#0b1626` 기준) ≥ 4.5.
  - `types-first`: 1440폭에서 `.types`의 `getBoundingClientRect().top`이 `.news`·`.fav`보다 작거나 같고 x가 가장 왼쪽. 390폭에서 DOM 표시 순서가 hero, types, fav, news, bshell, bypass.
  - `fav-collapsed-empty`: 즐겨찾기 비었을 때 `.fav` 높이 ≤ 72px.
  - `cta-contrast`: `.hero-cta` 글자색 `rgb(22, 24, 29)`.
- [ ] **Step 2:** 실행 → 5개 FAIL.
- [ ] **Step 3: 구현.** 히어로는 `main.wrap` 밖(머리 바로 아래) 전체 폭. 데스크톱 높이 `clamp(300px,34vw,420px)`, 그림 `object-fit:cover; object-position:right 40%`. 820px 이하에서는 그림 높이 180px 위, 글 아래(배경 `--sheet`). 문구: h1 기존 그대로, `p.hero-lead` = `선사 53곳, 선종 9개. 2027 실습생 선발 여부까지 한 표에서 확인합니다.`(숫자는 `CO.length`, `TYPES.length`로 채움). 히어로는 홈에서만 보이게(`route()`에서 `#hero` hidden 토글). 홈 그리드: 왼쪽 넓은 칸에 `.types`, 오른쪽 칸에 fav/news/bshell/bypass 세로. `.bypass`는 검은 배경 대신 `--sheet` 카드 + 주황 테두리 없는 차분한 모양(BYPASS 글자와 링크 유지). `renderFav()`는 둘 다 비었을 때 한 줄(`즐겨찾기 · 담긴 선종·선사 없음. 별표를 누르면 여기에 모입니다.`) 모드.
- [ ] **Step 4:** 실행 → PASS. 1440/390 × light/dark 스크린샷을 열어 확인.

### Task 2: 선종 화면 순서와 접기 (layout)

**Files:** Modify `index.html` (`#v-type` 475-524행, `renderTypeHead()` 1206행, footer 640-652행). Test: `tests/type.test.mjs`

**Interfaces:**
- Produces: `#type-pc`가 `.filters`·`.result-line`·`.table-scroll` **뒤**로 이동. 장단점 각 `ul`은 처음 3개만 보이고 `button.pc-more[aria-expanded]`('장점 n개 더 보기' / '접기'). footer `읽기 전에`는 `<details id="readme">`, 홈에서 `open`, 다른 화면에서 닫힘.

- [ ] **Step 1: 테스트**
  - `table-above-pros`: `#type-container`에서 `.table-scroll` top < `#type-pc` top.
  - `table-in-first-screens-mobile`: 390폭에서 `#reg-body` 첫 행(또는 카드) top < 1400.
  - `pros-collapsed`: `#type-pc .pros li` 중 보이는 것 3개, `.pc-more` 누르면 전부 보이고 `aria-expanded="true"`.
  - `readme-open-home-only`: 홈에서 `#readme.open === true`, `#type-lng`에서 `false`.
- [ ] **Step 2:** FAIL 확인.
- [ ] **Step 3:** 구현. 장단점 제목에 '(현직자·실습 후기 정리)' 같은 새 문구는 넣지 않는다.
- [ ] **Step 4:** PASS + 스크린샷 확인.

### Task 3: 휴대폰 표 카드화, 누르기 영역, 키보드 (adapt)

**Files:** Modify `index.html` (`.reg` CSS, `renderTable()` 1226행, `renderHome()` 행 마크업, 머리 `.mast-meta` CSS, `setupBoard()` 1389행). Test: `tests/adapt.test.mjs`

**Interfaces:**
- Consumes: Task 2의 `#v-type` 순서.
- Produces: 640px 이하에서 `.reg`는 `display:block`, 각 `tr.row`는 카드(회사명·구분 한 줄, 규모+태그, 실습·예비역 배지, 비교 체크). `tr.row`와 `.trow`에 `tabindex="0"`, Enter로 이동. `.qtabs` 좌우 화살표로 탭 이동.

- [ ] **Step 1: 테스트**
  - `no-hscroll-mobile`: 390폭 `#home`, `#type-container`, `#co-HMM`, `#compare`, `#news`, `#board`에서 `document.documentElement.scrollWidth <= 390`.
  - `card-shows-job`: 390폭 `#type-container` 첫 `tr.row` 안의 `.jobs`가 화면 안(`right <= 390`)에 보임.
  - `touch-targets`: 390폭에서 `input[data-pickco]`를 감싼 라벨, `.star`, `#f-routes .chip`의 높이 ≥ 40.
  - `row-keyboard`: `tr.row` 포커스 후 Enter → `location.hash`가 `#co-`로 시작. `.trow`도 Enter → `#type-`.
  - `qtabs-arrows`: `#qt-pub` 포커스 후 ArrowRight → `#qt-wait[aria-selected="true"]`이고 포커스 이동.
  - `mobile-mast-height`: 390폭 `header.mast` 높이 ≤ 170.
- [ ] **Step 2:** FAIL 확인.
- [ ] **Step 3:** 구현. 머리: 390폭에서 다크모드 버튼을 아이콘형(텍스트 '다크모드'는 `aria-label`로) 대신 줄바꿈 없이 같은 줄에 배치. '이 회사의 다른 선종' 열은 카드에서 숨김.
- [ ] **Step 4:** PASS + 390 스크린샷.

### Task 4: 색과 대비 (colorize)

**Files:** Modify `index.html` (`.ctag`, `.basis`, `.src-tag`, `.chip[aria-pressed="true"]`, `.chip small`, `::placeholder`, `.status`, `.bp-tag`, `renderCompare()` 1338행). Test: `tests/color.test.mjs`

**Interfaces:**
- Produces: `function capTag(k)` → `'<span class="ctag '+k+'">'+CAP_TAG[k]+'</span>'` (표, 선사 화면, 비교 화면 공통). `.ctag.p` 꽉 찬 배경(`--ink` 바탕, `--sheet` 글자), `.ctag.c` 실선 테두리, `.ctag.e` 점선 테두리, 셋 다 같은 중립색. `.basis`, `.src-tag`는 회색(`--muted`) 테두리.

- [ ] **Step 1: 테스트**
  - `chip-contrast`: light·dark 모두 `#news-cats .chip[aria-pressed="true"]`와 그 안 `small`의 글자/배경 대비 ≥ 4.5.
  - `placeholder-contrast`: `#q-all::placeholder` 색 대비 ≥ 4.5(light·dark, 계산은 `getComputedStyle(el,'::placeholder').color`).
  - `compare-uses-ctag`: 선사 2개 담고 `#compare`에서 `.cmp .ctag` 개수 ≥ 1, 텍스트 `(추정)` 같은 괄호 표기 0개.
  - `estimate-not-red`: `.ctag.e` 색이 `--minus`(라이트 `rgb(179, 38, 30)`)와 다름.
  - `status-no-sidebar`: `.status` 계산된 `border-left-width`가 다른 변과 같음.
- [ ] **Step 2:** FAIL 확인.
- [ ] **Step 3:** 구현. 주황 바탕 요소(`.chip[aria-pressed=true]`, `.btn` 주황형, `.hero-cta`, `.bp-tag`) 글자 `#16181d`, `.chip small` opacity 제거.
- [ ] **Step 4:** PASS + `impeccable detect --json apps/ship_info/index.html`에서 low-contrast 0건 확인.

### Task 5: 숫자로 드러나는 신뢰 수준 (bolder)

**Files:** Modify `index.html` (`.cap` CSS, `renderTable()` capCell, `renderCo()` typeLines). Test: `tests/bolder.test.mjs`

- [ ] **Step 1: 테스트** `cap-weight`: `#type-container`에서 보도 태그가 붙은 `.cap`의 font-weight ≥ 700, 추정 태그가 붙은 `.cap` font-weight ≤ 500이고 색이 `--muted`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `.cap`에 신뢰 클래스(`cap-p|cap-c|cap-e`)를 붙여 굵기·색만 바꾼다(크기 그대로).
- [ ] **Step 4:** PASS.

### Task 6: 상태 보존과 기능 보강 (harden)

**Files:** Modify `index.html` (`cmp` 959행, `pick()` 1378행, `resetFilters()`/`route()` 1409-1449행, `renderTable()`, `renderCo()` 빵부스러기, `setupBoard()`, 이벤트 1452행~). Test: `tests/harden.test.mjs`

**Interfaces:**
- Produces:
  - `const CMP_KEY = 'sasarok-cmp-v1'`, `function loadCmp()`(없는 이름·선종 id 버림, 각 최대 `LIMIT`), `function saveCmp()`(try/catch).
  - 해시 형식 `#type-<id>?kind=owner&fleet=m&foreign=0&cadet=1&reserve=1&q=<텍스트>&r=<항로,항로>&sort=<rank|name|fleet|job>`. 기본값은 생략. `function filterQuery()` → 문자열, `function applyQuery(params)`. 필터가 바뀔 때 `history.replaceState`로 해시 갱신(스크롤 위치 유지, `lastHash`도 갱신).
  - 선종 이동 시 `kind, fleet, foreign, cadet, reserve` 유지, `q, routes, sort` 초기화(`resetTypeOnly()`).
  - `state.sort`: 표 머리 `순위`, `회사`, `선단`, `실습, 병역`이 `<button class="th-sort" aria-sort>`. job 정렬 = 실습생 선발 → 예비역 가능 → 순위.
  - `button#f-pickall`('표에 나온 회사 비교에 담기'): 남은 자리만큼 위에서부터 담고, 넘치면 토스트.
  - 빈 결과: `'조건에 맞는 회사가 없습니다. ' + <원인 필터 이름> + ' 조건을 풀면 n곳이 보입니다.'` — 필터를 하나씩 끈 결과 수를 계산해 가장 많이 늘어나는 필터 하나를 알려 줌.
  - `#cmp-live`(`aria-live="polite"`, `.sr`): 담기·빼기 때 `'HMM 비교에 담음 (선사 2/5)'` 형식.
  - 선사 화면 빵부스러기: 선종 표에서 왔으면 `처음 › <선종 이름>(필터 유지 링크) › 선사`. `sessionStorage['sasarok-last-type']`에 마지막 선종 해시 저장.
  - 제보: `#p-send` `disabled`, 버튼 문구 `서버 연결 전 (보내기 준비 중)`, 그 아래 `쓴 내용 복사` 버튼(`navigator.clipboard.writeText`, 실패 시 본문 선택).

- [ ] **Step 1: 테스트**
  - `cmp-persist`: 선사 2개 담고 새로고침 → `#cmp-n` 텍스트 `선사 2 / 선종 0`.
  - `cmp-no-storage`: `addInitScript`로 `localStorage.setItem`이 throw하게 만든 뒤 담기 → 화면 카운트 1, 오류 없음.
  - `cmp-stale-name`: 저장값 `{"co":["없는회사","HMM"],"ty":["zzz"]}` 넣고 로드 → `선사 1 / 선종 0`, `#compare` 정상.
  - `hash-roundtrip`: `#type-container?kind=owner&cadet=1` 직접 열기 → `#f-kind [data-v=owner][aria-pressed=true]`, `#f-cadet` 체크, `#r-count` = 필터 적용 수. 칩 하나 누르면 해시에 `r=` 포함.
  - `keep-filters-across-types`: `#type-container`에서 cadet 켜고 `#type-lng`로 이동 → `#f-cadet` 체크 유지, 항로 칩 모두 해제.
  - `sort-name`: '회사' 머리 누름 → 첫 두 행 이름이 `localeCompare('ko')` 오름차순, `aria-sort="ascending"`.
  - `pick-all`: 비어 있는 상태에서 `#f-pickall` → 카운트 `선사 5 / 선종 0`(표에 5곳 이상일 때).
  - `empty-culprit`: 결과 0이 되는 조합에서 빈 행 문구에 필터 이름과 `곳이 보입니다` 포함.
  - `crumb-back`: `#type-container?cadet=1`에서 첫 회사 클릭 → 빵부스러기에 `컨테이너선` 링크, 누르면 해시가 `#type-container?cadet=1`.
  - `cmp-live`: 표에서 HMM 체크 → `#cmp-live` 텍스트에 `HMM`과 `비교에 담음` 포함.
  - `board-disabled`: `#p-send.disabled === true`, 텍스트에 `서버 연결 전`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** PASS + 1~5 태스크 테스트 재실행 PASS.

### Task 7: 용어와 설명 (clarify)

**Files:** Modify `index.html` (홈 문구, `#f-fleet` 라벨, 표 머리, `jobCell()` 1218행, `#sort-note` 위치, HELP 1106행). Test: `tests/clarify.test.mjs`

**Interfaces:**
- Produces: `function cadetState(j)` → `'yes'|'no'|'tbd'` (`j.yes` 참이면 yes, `j.cadet`에 `없음` 포함이면 no, 그 밖 tbd). 배지 문구 `실습생 선발` / `실습생 없음` / `실습생 미정`.

- [ ] **Step 1: 테스트**
  - `term-fleet`: 문서 전체 텍스트에 `선대 규모` 0회(모두 `선단 규모`).
  - `term-compare`: 체크박스 라벨 텍스트가 모두 `비교에 담기`(시각 텍스트 또는 sr 라벨), 단독 `비교` 라벨 0개(머리 `비교` 링크 제외).
  - `cadet-split`: `jobCell` 결과 문자열에 `없음/미정` 0회. 페이지 안에서 `CO.find(c => c.job && cadetState(c.job)==='no')`로 찾은 회사의 선종 표 행 배지가 `실습생 없음`.
  - `legend-above`: `#sort-note`(또는 새 `#cap-legend`)의 top < `.table-scroll` top.
  - `th-help`: `#th-cap`, 선단, 실습 머리에 `title` 속성이 있고 비어 있지 않음.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** 구현. 범례 한 줄: `규모 옆 표시: 보도(발표 수치) · 환산(선박 수 × 대표 선형) · 추정(대략)`. 나머지 정렬 설명은 표 아래에 그대로.
- [ ] **Step 4:** PASS.

### Task 8: 버전, 이스터에그, 마무리 (polish)

**Files:** Modify `index.html` (`.mast-meta` 387행, footer, 새 `VERSION`/`PATCH_NOTES`, 이스터에그 CSS·JS, 해운 소식 `.nf` CSS, `#f-reset` 스타일, 홈 소식 카드, `.cmp` 첫 열 머리). Test: `tests/polish.test.mjs`

**Interfaces:**
- Produces: `const VERSION = '1.0.0'`, `const PATCH_NOTES = [{v:'1.0.0', d:'2026-11-24', i:[…]}]`. 머리 `button.ver#ver-top`, footer `button.ver#ver-foot`(가운데), 그 오른쪽 `a.bp-logo`(img `/assets/favicon.svg`, alt `BYPASS`, href `https://teambypass.vercel.app/`, `target=_blank rel=noopener`). `openEgg()`는 seacal 구조(`.egg` > `.egg-card` > `.ev` `Ver.1.0.0`, `.eb` `Made by "Bypass"`, `.egg-btns > button.egg-pn` 패치노트). 클릭 5회(2초 안) 누적으로 열림, Esc·바깥 클릭으로 닫힘, 포커스는 카드로.
- 패치노트 1.0.0 항목(이 세션 기록 기준): 홈 항구 일러스트(라이트 낮·다크 밤), 선종 화면 표 먼저, 휴대폰 표 카드, 신뢰 태그 모양 통일과 대비 개선, 비교 목록 저장·필터 주소 공유·열 정렬·한꺼번에 담기, 용어 통일과 실습생 없음/미정 구분, 버전 표시와 패치노트.

- [ ] **Step 1: 테스트**
  - `version-shown`: `#ver-top`, `#ver-foot` 텍스트 `v1.0.0`; `#ver-top`의 x < `.bp-logo` x; `#ver-foot` 가운데(중심 x와 뷰포트 중심 차 ≤ 4).
  - `egg-opens`: `#ver-top` 5번 클릭 → `.egg-card .ev` = `Ver.1.0.0`; `.egg-pn` 클릭 → 패치노트 첫 섹션 `v1.0.0`; Esc → `.egg` 없음.
  - `bp-logo-link`: `.bp-logo` href `https://teambypass.vercel.app/`, img 로드 성공(`naturalWidth > 0`).
  - `news-filter-heights`: `#nf-from`, `#nf-reset` 높이 차 ≤ 2.
  - `reset-style-same`: `#f-reset`과 `#nf-reset`의 계산된 border·padding·font-size 같음.
  - `home-news-fade`: 홈 `#news-list` 컨테이너에 하단 페이드(`mask-image` 또는 `::after` 그라디언트) 존재.
  - `cmp-head-line`: `.cmp thead th:first-child` `border-left-width` = 0.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** PASS.

### Task 9: 전체 확인

- [ ] **Step 1:** `node docs/superpowers/tests/ship_info/run.mjs` → 전부 PASS, 출력 남김.
- [ ] **Step 2:** 1440×900·390×844 × light·dark로 홈, 선종, 선사, 비교, 소식, 제보 스크린샷을 찍어 직접 열어 확인.
- [ ] **Step 3:** `impeccable detect --json apps/ship_info/index.html` 결과 기록(대비 경고 0 목표).
- [ ] **Step 4:** `/impeccable critique`를 다시 돌려 점수 비교(사용자에게 보고).
- [ ] **Step 5:** 로컬 서버 종료, `git status --short`로 바뀐 파일 목록 보고. 커밋·푸시는 사용자 지시를 기다린다.
