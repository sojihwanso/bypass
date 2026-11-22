# 여권스냅 v1.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈을 "오늘 한 페이지"로, 보상을 "쓸 수 있는 문장"으로 바꾸고, 기록을 기기에 저장하며, 치트시트를 현지용으로 다듬는다.

**Architecture:** 단일 파일 `apps/passport-snap/index.html` 안에서 기존 `state`와 렌더 함수를 확장한다. 새 저장 계층 `store`(localStorage, 언어별)를 두고 모든 상태 변경 지점에서 `saveStore()`를 부른다. 테스트는 저장소 밖 의존성 없이, 이미 깔린 playwright-core + 시스템 Chrome으로 도는 Node 스크립트 하나.

**Tech Stack:** 바닐라 HTML/CSS/JS, `Intl.Segmenter`, localStorage. 테스트: Node 26 + playwright-core(`/Users/turo/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core`), `channel: 'chrome'`.

**Spec:** `docs/superpowers/specs/2026-11-23-passport-snap-v110-design.md`

## Global Constraints

- 단일 파일 유지, 외부 라이브러리·웹폰트 추가 금지.
- DESIGN.md 규칙: 화면당 채운 초록(cta) 버튼은 "지금 할 일" 하나, 파스텔은 soft·border·base·dark 4단계, 원문 → 가나/병음 → 한글 발음 → 뜻 순서, 눌림 받침은 채운 버튼만, 보조 글자는 `--text-muted`(#5f6663), 터치 44px, `prefers-reduced-motion` 대응, 확대 허용.
- 저장 키 `passportsnap.v1`, 음성 키 `passportsnap.voiceGender`는 그대로. 모든 localStorage 접근은 try/catch.
- 용어: "제원" → "현지 정보" (언어팩 데이터 키 `specs`와 함수명은 그대로).
- 버전 `1.1.0`, PATCH_NOTES 맨 위에 추가.
- 문구는 한국어 친근한 존댓말, 사실만(평가와 무관한 칭찬 금지).

## Review Focus

1. 기존 사용자 첫 방문(저장 없음)·깨진 JSON·옛 형태 저장값 → 빈 기본값으로 정상 시작 (Task 1 `store-corrupt`).
2. localStorage가 예외를 던지는 환경(사생활 모드) → 앱 정상 동작, 통계 배지 "저장 안 됨" (Task 1 `store-blocked`).
3. 언어 전환 중 퀴즈가 열린 상태 등에서 다른 언어 기록이 섞이지 않음 → 일본어 완료가 중국어에 안 보임 (Task 1 `per-language`).
4. 14일 코스에서 오늘 완료 판정·다음 DAY가 7일 코스와 섞이지 않음 (Task 3 `course-14`).
5. 즐겨찾기 0개일 때 ★ 칩 선택 → 빈 상태 안내(검색 0건과 다른 문구) (Task 4 `fav-empty`).

---

## 공통: 테스트 실행 방법

- 서버: 워크트리 루트에서 `python3 -m http.server 8791 --bind 127.0.0.1` (이미 떠 있으면 재사용). 페이지: `http://127.0.0.1:8791/apps/passport-snap/index.html`.
- 테스트 파일: `docs/superpowers/tests/passport-snap.e2e.cjs`. 실행: `node docs/superpowers/tests/passport-snap.e2e.cjs [이름필터]`. 출력: 테스트마다 `ok - name` / `not ok - name: 이유`, 끝에 `N passed, M failed`, 실패 시 exit 1.
- 각 테스트는 새 browser context(빈 localStorage)에서 시작. 도우미: `open(page, {width=390,height=844, storage=null})`(storage 주면 `passportsnap.v1`에 미리 넣고 로드), `reload(page)`, `stored(page)`(저장값 JSON 반환), `answerAll(page, {wrong: n})`(현재 퀴즈를 끝까지 풀되 처음 n문항은 일부러 오답, 오답 재출제는 정답으로).
- 정답 찾기: 테스트는 `window.quiz.queue[0]`에서 정답 id/char를 읽는다(전역 `quiz` 유지).

---

### Task 1: 저장 계층과 언어별 기록

**Files:**
- Create: `docs/superpowers/tests/passport-snap.e2e.cjs` (러너 + 도우미 + 이 태스크 테스트)
- Modify: `apps/passport-snap/index.html` — `state`(약 986행), `updateStatsUI`, `selectLanguage`, `setCourseMode`, `toggleKoPron`, `nextQuizQuestion`, `recordWrongItem`/`removeWrongItem`/`doClearWrongNotebook`, `ensureLangNotebook`, 통계 카드 배지 마크업

**Interfaces:**
- Produces:
  - `store`: `{ version:1, lang, courseMode, showKoPron, phraseDensity, langs:{ [code]: { completed:{[lessonKey]: 'YYYY-MM-DD'}, usable:number[], favorites:number[], notebook:{phrases:{}, chars:{}} } } }`
  - `loadStore(): void` (시작 시 1회, `state.lang/courseMode/showKoPron` 반영), `saveStore(): void`, `langData(code = state.lang)` → 해당 언어 객체(없으면 생성), `todayStr(): string`(로컬 YYYY-MM-DD), `storageOk: boolean`
  - `isLessonDone(key): boolean`, `markLessonDone(key, title): void` (이미 있으면 날짜 유지)
  - `state.completedLessons`/`completedLabels`/`xp`/`wrongReviewCount`/`state.wrongNotebook` 제거 → 위 함수와 `langData().notebook`으로 대체 (`ensureLangNotebook`은 `langData(code).notebook` 반환으로 유지)

- [ ] **Step 1: 러너와 실패하는 테스트 작성** — 테스트:
  - `persist-lesson`: DAY 1(`startLesson('7-1')`) 끝까지 풀기 → reload → `stored().langs.ja.completed['7-1']`가 오늘 날짜, 홈 목록 DAY 1이 완료 표시(`[data-lesson="7-1"].done` 존재).
  - `per-language`: ja DAY 1 완료 → `selectLanguage('zh')` → `[data-lesson="7-1"].done` 없음.
  - `store-corrupt`: storage에 `"{not json"` 넣고 로드 → 페이지 오류 0, 홈 렌더.
  - `store-blocked`: `addInitScript`로 `localStorage.getItem/setItem`이 throw → 페이지 오류 0, 통계 배지 텍스트 "저장 안 됨"; 정상 환경에서는 "이 기기에 저장".
  - `persist-settings`: 14일 코스·중국어 선택 → reload → 코스 토글 14일 활성, `state.lang === 'zh'`.
- [ ] **Step 2: 실행해 실패 확인** — `node docs/superpowers/tests/passport-snap.e2e.cjs` → 5 failed.
- [ ] **Step 3: 구현** — 위 Interfaces대로. 홈 목록의 각 DAY 요소에 `data-lesson="<key>"`와 완료 시 `.done`(Task 3이 마크업을 바꿔도 유지). 통계 배지 id `store-badge`. 시작 시 `storageOk` = 테스트 키 쓰기/지우기 성공 여부.
- [ ] **Step 4: 테스트 통과 확인** — 5 passed.
- [ ] **Step 5: 커밋** — `여권스냅: 기록을 기기에 저장, 언어별 분리`

### Task 2: 쓸 수 있는 문장과 결과 화면

**Files:** Modify `index.html` — `openPhraseQuiz`, `startWrongNotebookQuiz`, `checkQuizAnswer`, `nextQuizQuestion`, `renderQuizScreen`(done 분기), `updateStatsUI`, topbar `.session-pill`, 통계 카드 마크업; 테스트 추가.

**Interfaces:**
- Consumes: `langData()`, `saveStore()`, `markLessonDone()`
- Produces:
  - `quiz.firstTryCorrect:number`, `quiz.addedUsable:number`, `quiz.lostUsable:number`, `quiz.wrongItems: Array<queue item>`(세션 중 틀린 항목, 중복 제거)
  - `startReviewOf(items): void` — 주어진 항목으로 복습 퀴즈 열기(`mode:'review'`, 모든 문항 첫 출제는 `isRetry:false`)
  - 결과 DOM: `#result-first`(“n/총”), `#result-usable`, `#result-wrong`, 주 버튼 `#result-primary`
  - 세션 표시 `#stat-usable`(쓸 수 있는 문장 수), 통계 카드 `#card-stat-usable`, `#card-stat-notes`

- [ ] **Step 1: 실패하는 테스트** —
  - `usable-first-try`: 랜덤 퀴즈 10문항을 처음 2문항 오답으로 풀기 → `#result-first` = "8/10", `#result-usable` 안에 "+8", `#result-wrong`에 "2", `#result-primary` 텍스트 "틀린 2문장 바로 복습 →", 결과 제목에 "오늘 학습을 마쳤습니다" 없음, `stored().langs.ja.usable.length === 8`.
  - `review-recovers`: 위에 이어 `#result-primary` 클릭 → 큐 길이 2, 모두 정답 → usable 10, 오답노트 해당 2문장 삭제됨.
  - `wrong-removes-usable`: usable에 있는 문장을 퀴즈에서 틀리면 usable에서 빠지고 결과에 "다시 연습 필요" 문구.
  - `no-xp`: 페이지 텍스트에 "XP" 없음(`document.body.innerText`).
  - `all-correct`: 전부 정답 → `#result-wrong`에 "모두 한 번에 맞힘", `#result-primary` "코스로 돌아가기".
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 첫 출제(`isRetry:false`) 정답 시 `firstTryCorrect++`, 구문 문항이면 usable에 없을 때 추가하고 `addedUsable++`. 오답 시 usable에 있으면 제거·`lostUsable++`, `wrongItems`에 추가. 오답 복습 모드에서 첫 출제 정답이면 노트에서도 제거. 결과 화면 제목: lesson "DAY n 완료"(+부제 "오늘 학습을 마쳤습니다"), random "랜덤 퀴즈 완료", review "오답 복습 완료", char "<탭명> 퀴즈 완료". 틀린 수 상자는 rose 계열(soft 배경·dark 글자), 0이면 sage. 진행 막대: `완료한 문항 / (완료 + 남은 큐)`.
- [ ] **Step 4: 통과 확인** (Task 1 포함 전체)
- [ ] **Step 5: 커밋** — `여권스냅: XP 대신 쓸 수 있는 문장, 결과 화면을 사실대로`

### Task 3: 홈 = 오늘 한 페이지

**Files:** Modify `index.html` — `#view-home` 마크업(hero, 코스 섹션, side-rail 타이머 카드), `renderCourseGrid`(→ `renderHome`), `startNextOrFirstLesson`, `toggleTimer`/`renderTimer`(대상 요소 이동), CSS(`.hero-3s` 영역, 새 `.today-*`, `.course-list`/`.course-row`); 테스트 추가.

**Interfaces:**
- Consumes: `isLessonDone`, `langData().completed`, `todayStr()`
- Produces: `homeState(): {kind:'todo'|'doneToday'|'courseDone', lesson, nextLesson, doneCount, total}`, `renderHome(): void`(기존 `renderCourseGrid` 호출부 모두 교체). DOM: `#today` (hero), `#today-primary`(todo일 때만 채운 초록), `.course-row[data-lesson]`.

- [ ] **Step 1: 실패하는 테스트** —
  - `one-green`: 첫 방문 홈에서 화면에 보이는 `.btn-primary` 개수 === 1, 텍스트 "DAY 1 시작 →".
  - `done-today`: DAY 1 완료 후 홈 `#today`에 "오늘 분량 완료"와 "내일 DAY 2", 보이는 `.btn-primary` 0개.
  - `review-not-today`: storage에 `completed:{'7-1':'2000-01-01'}` → DAY 1 복습 완료 → `#today`는 todo 상태(DAY 2), 날짜는 그대로 '2000-01-01'.
  - `course-14`: 14일 코스에서 DAY 1 완료 → 7일 코스로 바꾸면 todo DAY 1.
  - `course-done`: 7개 모두 완료(storage, 과거 날짜) → `#today`에 "코스 완료", 보이는 `.btn-primary` 0개.
  - `timer-autostart`: `#today-primary` 클릭 → `state.timerRunning === true`(카운트다운 모드).
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 상태 규칙은 spec B와 "검토에서 나온 세부 결정" 3·5. todo hero: 배지 "DAY n / 총 N" · h2 레슨 제목 · "n문장 · 약 20분" · 진행 막대(완료/N) · 인라인 타이머(시간·시작/일시정지·초기화·20분/스톱워치) · `#today-primary` · 코스 토글. 전체 코스 목록 한 줄: DAY 태그 · 제목 · 상태 · outline 작은 버튼("복습"=완료, "미리 하기"=남음, 오늘 줄은 버튼 없이 "오늘" 배지). side-rail 타이머 카드 삭제. 모바일 순서: hero → 코스 목록 → 위젯.
- [ ] **Step 4: 통과 확인** + 1280·390 스크린샷 눈으로 확인
- [ ] **Step 5: 커밋** — `여권스냅: 홈을 오늘 한 페이지로`

### Task 4: 치트시트 현지 모드

**Files:** Modify `index.html` — `#view-phrases` 마크업(검색·칩 sticky 래퍼, 밀도 토글), `renderPhraseCatChips`, `setPhraseCat`, `renderPhraseList`, `openShowCard`(★ 토글), CSS; 테스트 추가.

**Interfaces:**
- Consumes: `langData().favorites`, `store.phraseDensity`, `saveStore()`
- Produces: `toggleFavorite(id): void`, `isFavorite(id): boolean`, `state.phraseCat` 값 `'fav'` 추가, `setPhraseDensity('compact'|'detail')`, `phraseDensity(): 'compact'|'detail'`(저장값 없으면 `innerWidth <= 640 ? 'compact':'detail'`). DOM: `.fav-btn[data-id]`(aria-pressed), `#chip-fav`, `#density-toggle`, `#phrase-empty`.

- [ ] **Step 1: 실패하는 테스트** —
  - `fav-persist`: 문장 #3 ★ → reload → `#chip-fav` 텍스트 "★ 고정 (1)", 클릭 시 목록 1개(#3).
  - `fav-empty`: 즐겨찾기 0개에서 `#chip-fav` 클릭 → `#phrase-empty`에 "고정한 문장이 없습니다" 포함.
  - `search-empty`: 검색 "zzzz" → `#phrase-empty`에 "‘zzzz’에 맞는 문장이 없습니다"와 장면 칩 버튼 ≥3, 지우기 버튼 클릭 시 210개 복귀.
  - `compact-default`: 390px → 첫 `.phrase-item`에 `.phrase-tip` 보이지 않음; 1280px → 보임. 토글 후 reload 시 선택 유지.
  - `sticky-search`: 390px에서 2000px 스크롤 후 검색창 `getBoundingClientRect().top` < 120.
  - `mobile-first-screen`: 390x844 치트시트 첫 화면(탭바 위)에 보이는 `.phrase-item` ≥ 3.
  - `chip-counts`: 검색 "화장실" 후 각 카테고리 칩 숫자가 검색 결과 기준.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — spec E. 촘촘히: 원문·한글 발음(설정 따름)·뜻 한 덩어리, 가나 줄은 `readingOf` 규칙, 팁 숨김, 동작은 ★·듣기·크게 보기 3개 아이콘/작은 버튼 한 줄. 크게 보기 상단에도 ★.
- [ ] **Step 4: 통과 확인** + 390 스크린샷 확인
- [ ] **Step 5: 커밋** — `여권스냅: 치트시트 ★고정·장면 칩·촘촘히 보기`

### Task 5: 크게 보기 줄바꿈과 큰 글자 토큰

**Files:** Modify `index.html` — `openShowCard`/`fitShowText`, 학습 미리보기 카드 템플릿(`renderQuizScreen` preview), `:root` 토큰, 인라인/템플릿 font-size(25·28·30·32·38·56·24px), `.btn-blue:hover`; `apps/passport-snap/DESIGN.md`·`.impeccable/design.json` 토큰 반영; 테스트 추가.

**Interfaces:**
- Produces: `segmentedHTML(text: string, lang: string): string`(단어 사이에 `<wbr>`, HTML 이스케이프, 미지원 시 이스케이프된 원문). 토큰 `--fs-glyph: 28px`, `--fs-glyph-lg: 38px`, `--fs-glyph-xl: 56px`, `--pastel-sky-hover: #dceefa`.

- [ ] **Step 1: 실패하는 테스트** —
  - `wrap-dokoka`: 1280px, 「トイレはどこですか？」 문장의 크게 보기 열기 → `#sc-jp` 렌더 줄들 중 "ど"로 끝나는 줄 없음(Range로 각 글자의 top 비교해 'ど'와 'こ'가 같은 줄).
  - `wrap-zh`: 중국어 크게 보기에서 `#sc-jp` innerHTML에 `<wbr>` 포함.
  - `detect-clean`: `impeccable detect --json apps/passport-snap/index.html` 결과에 `design-system-font-size`, `design-system-color` 0건.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — `Intl.Segmenter(lang,{granularity:'word'})`, `#sc-jp`·미리보기 원문에 `word-break: keep-all`. 25·30·32px→`--fs-glyph`(28) 또는 `--fs-glyph-lg`(38) 중 가까운 것, 24px→`--fs-title`(21) 아님: 오답노트 문자 글자는 `--fs-glyph`. DESIGN.md 타이포에 glyph 3단계, colors에 sky-hover, rounded에 실제 쓰는 값 정리(빌더 재량).
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `여권스냅: 크게 보기 어절 줄바꿈, 큰 글자 토큰`

### Task 6: 학습 화면 접근성과 키보드

**Files:** Modify `index.html` — `#quiz-screen` 마크업, `openPhraseQuiz`/`startCharQuiz`/`startReviewOf`/`closeQuizScreen`(포커스·inert), 전역 keydown, 브랜드 마크업(h1); 테스트 추가.

**Interfaces:**
- Produces: `openQuizScreen(): void`(열기 공통: 연 요소 기억, `main`·`.topbar`·`.tabbar`·`.app-foot`에 `inert`, 포커스 이동), `closeQuizScreen()`(inert 해제, 포커스 복귀).

- [ ] **Step 1: 실패하는 테스트** —
  - `dialog-role`: 레슨 열면 `#quiz-screen[role=dialog][aria-modal=true]`, `document.activeElement`가 `#quiz-screen` 안, `main.inert === true`; 닫으면 포커스가 연 버튼.
  - `keys-preview`: 미리보기에서 ArrowRight → 카운터 "카드 2/30", ArrowLeft → "카드 1/30".
  - `keys-quiz`: 퀴즈에서 "1" 키 → 첫 보기 선택(`.option-btn.selected`), Enter → 판정 띠 표시, Enter → 다음 문항.
  - `one-h1`: `document.querySelectorAll('h1').length === 1`, 텍스트 "여권스냅".
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 키 처리는 `#quiz-screen.open`이고 포커스가 입력창이 아닐 때만. 확인 대화상자가 열려 있으면 무시.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `여권스냅: 학습 화면 대화상자·키보드 조작`

### Task 7: "현지 정보" 용어, 버전 1.1.0, 문서

**Files:** Modify `index.html`(spec G의 모든 위치, `renderLanguageHeadings`, `renderHelp`, VERSION·PATCH_NOTES), `apps/passport-snap/PRODUCT.md`(저장 구현·보상 용어·글꼴 설명 정정), `apps/passport-snap/DESIGN.md`·`.impeccable/design.json`(오늘 페이지, 코스 목록, ★ 고정, 결과 화면 컴포넌트); 테스트 추가.

- [ ] **Step 1: 실패하는 테스트** —
  - `no-jewon`: 일본어·중국어 각각 홈·현지 정보·도움말을 연 상태의 `document.body.innerText`에 "제원" 없음(패치노트 1.0.0 항목은 이스터에그 안이라 제외).
  - `version`: `#ver-top` 텍스트 "v1.1.0", 패치노트 첫 항목 v1.1.0.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 패치노트 1.1.0 항목(사용자 관점, 6줄 안팎): 오늘 한 페이지, 쓸 수 있는 문장, 기기 저장, ★ 고정·촘촘히 보기, 크게 보기 줄바꿈, 현지 정보 이름·키보드 조작.
- [ ] **Step 4: 전체 테스트 + 최종 검증** — 전체 e2e 통과; 1280·768·390·360·320px 가로 넘침 0(스크립트), 콘솔 오류 0, `impeccable detect` 차단 0; 1280·390 홈·치트시트·결과 화면 스크린샷 눈으로 확인.
- [ ] **Step 5: 커밋** — `여권스냅 v1.1.0: 현지 정보 용어, 패치노트, 문서 갱신`
