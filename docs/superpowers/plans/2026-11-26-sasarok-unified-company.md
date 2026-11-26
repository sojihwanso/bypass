# 선사록 v3.0.0 선사·등록 업체 통합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선사(CO 53곳)와 KOSWEC 등록 업체(332곳 추가)를 한 회사 목록·한 회사 화면으로 합치고, 선종 표에 등록 자료만 있는 회사를 접힌 묶음으로 넣어 v3.0.0으로 낸다.

**Architecture:** `index.html` 안에서 CO는 그대로 두고, `koswec.json`을 불러온 뒤 `buildUni(k)`가 회사 목록 `UNI`(385곳)를 만든다. 회사 화면(`renderCo`), 선종 표 아래 묶음(`renderRegGroup`), 선사 목록(`renderDir`), 검색이 모두 `UNI`를 쓴다. `#firm-<id>`는 `#co-<이름>`으로 넘긴다.

**Tech Stack:** 단일 정적 HTML(바닐라 JS), Node + playwright-core 테스트(`docs/superpowers/tests/ship_info/`).

**Spec:** `docs/superpowers/specs/2026-11-26-sasarok-unified-company-design.md`

## Global Constraints

- CO·CAP·JOB·TYPES·NEWS 데이터와 `koswec.json`·`wage.json` 형식은 바꾸지 않는다. 숫자를 지어내지 않는다.
- 등록 척수를 선단 규모처럼 보이게 하지 않는다. 출처 태그: 선사 자료(기존 태그), 등록 `.ctag.r`, 통계 `.ctag.s`.
- 앱 선종 배정은 선박별 업종(`ships[i][2]`)과 KOSWEC 선종(`ships[i][3]`)을 `TYPE_MAP[id].kos`·`biz`에 대 본다. `KOS_BIZ`로 bizKey↔업종 이름.
- 관리선사로 이은 3곳(`MANAGED_BY`)은 자기 등록 선박 없음으로 본다(척수 '-', 임금은 앱 선종 기준).
- koswec.json은 필요할 때만 불러온다(홈 첫 화면에서는 불러오지 않음).
- 문구: 짧은 평서문, 느낌표·이모지·"한눈에"·"완벽"·"~해보세요" 금지. 사이트 용어 '선단 규모'.
- 다크모드, 주황 바탕 위 글자 `#16181d`, 390px에서 가로 스크롤 없음.
- 버전 v3.0.0: `VERSION`, `#ver-top`, `#ver-foot`, `PATCH_NOTES` 맨 앞을 같은 커밋에서.
- 테스트 서버: worktree 루트를 `python3 -I -m http.server 8766 --bind 127.0.0.1 --directory .`로 띄우고 `SASAROK_BASE=http://127.0.0.1:8766/apps/ship_info/index.html node docs/superpowers/tests/ship_info/run.mjs [번호]`.

## Review Focus

1. 등록 자료만 있는 회사 이름에 `(주)`·괄호·공백이 있어도 `#co-` 주소가 열리고 뒤로 가기가 맞게 동작해야 한다. → Task 2 `co-firm-only-paren`.
2. koswec.json을 못 불러오면 CO 회사 화면은 그대로 보이고(등록·임금 칸만 빠짐), CO에 없는 이름은 "다시 시도" 단추가 나와야 한다. → Task 2 `co-firm-load-fail`.
3. 선종 표에서 이름 검색이 접힌 묶음에만 걸리면 위 표는 빈 결과 안내, 묶음은 자동으로 펼쳐져야 한다. → Task 3 `reg-group-search-opens`.
4. 즐겨찾기에 담은 등록 자료만 있는 회사가 새로 고침 뒤에도 남아 있어야 한다. → Task 1 `fav-keeps-firm-only`.
5. 같은 회사가 선종 표 위·아래에 두 번 나오지 않아야 한다(CO 회사의 KOSWEC 업체는 묶음에서 빠짐). → Task 3 `reg-group-no-dup`.

---

### Task 1: 통합 회사 모델과 즐겨찾기

**Files:**
- Modify: `apps/ship_info/index.html` (`MANAGED_BY` 정의를 TYPE_MAP 근처로 올림, `loadFav()` ~1583)
- Test: `docs/superpowers/tests/ship_info/tests/17-unify.test.mjs`

**Interfaces:**
- Produces:
  - `firmAppTypes(f, k): string[]` — 선박마다 `TYPE_MAP` 대조, 앱 선종 id 중복 없이, `TYPES` 순서.
  - `buildUni(k): Array<Uni>`; `Uni = {n, co: CO항목|null, firm: koswec firm|null, mgr: string|null (관리선사 CO 이름), types: string[], ships: number|null}`. 순서: CO 순서 그대로 53곳 다음, 등록만 332곳(척수 많은 순, 같으면 이름). CO 회사의 `firm`은 `f.app === c.n`인 업체. `types`: CO면 `c.types`, 등록만이면 `firmAppTypes`. `ships`: firm 있으면 `firm.ships.length`, 없으면 null.
  - `UNI_BY: {[n]: Uni}`, `uniReady(): Promise<void>`(loadData('koswec') 후 한 번만 build), `regOnlyFor(typeId): Uni[]`(co 없음 && types 포함, 이 선종 등록 척수 많은 순).
  - `typeShipCount(u, typeId, k): number` — 그 회사 선박 중 이 선종에 해당하는 척수.
  - 즐겨찾기: `loadFav()`는 `cos`에서 CO에 없는 문자열도 남긴다(길이 1~80, 최대 50개). 홈 즐겨찾기 목록은 CO 이름은 바로, 그 밖의 이름은 `uniReady()` 뒤 그린다(UNI에 없으면 표시하지 않되 저장은 유지).

- [ ] **Step 1: 실패 테스트** (`17-unify.test.mjs`, `page.evaluate`로):
  - `uni-count`: `await uniReady(); UNI.length === 385`, `UNI.filter(u=>u.co).length === 53`, `UNI_BY['HMM'].firm.n === '에이치엠엠(주)'`, `UNI_BY['현대글로비스'].mgr === '지마린서비스' && UNI_BY['현대글로비스'].ships === null`.
  - `firm-only-types`: 등록만 회사 중 시멘트선 포함 131, 벌크선 63, LNG 1 (`regOnlyFor`), 앱 선종 없는 등록만 회사 111.
  - `fav-keeps-firm-only`: localStorage `sasarok-fav-v1`에 `{types:[],cos:['씨엠에스마리타임(주)']}` 넣고 열기 → `fav.cos`에 남음, 홈 즐겨찾기에 그 이름 링크(`a[href^="#co-"]`)가 보임(uniReady 대기).
- [ ] **Step 2:** `run.mjs 17` FAIL 확인.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** `run.mjs 17` PASS, 전체 PASS.
- [ ] **Step 5: Commit** `"ship_info: 선사·등록 업체 통합 목록"`

### Task 2: 회사 화면 하나로

**Files:**
- Modify: `apps/ship_info/index.html` — `renderCo()`, `renderCoReg()`(등록 선박 칸으로 확장), `renderFirm()` 제거하고 `#firm-` 라우트는 넘기기, `route()`의 co 분기
- Modify tests: `14-dir.test.mjs`의 `firm-*`를 `#co-` 기준으로, `15-co-search.test.mjs`의 `co-reg-*`
- Test: `docs/superpowers/tests/ship_info/tests/18-co-page.test.mjs`

**Interfaces:**
- Consumes: Task 1 전부, v2의 `wageLine`, `wageHead`, `bindWageToggle`, `wageRowsHtml`, `firmTopTypes`, `KOS_SRC`.
- Produces: `renderCo(name)`(CO 있으면 즉시 본문, 등록·임금 칸은 비동기로 채움; CO 없으면 `dataBox`로 UNI 판정 후 등록만 화면), `coRegHtml(u, k)`, `coWageHtml(u, k, w)`, `firmHref`는 Task 4까지 그대로 둔다(`#firm-` 주소는 이 Task의 넘기기로 회사 화면에 닿음). 새 코드는 `coHref(u.n)`을 쓴다.

내용(spec '회사 화면' 그대로):
- 등록만 회사: 경로 `처음 › 선사 목록 › 이름`, 머리 태그 `등록` + 업종, 별(즐겨찾기) O, 비교 X. 본문: 등록 선박 칸("한국선원복지고용센터에 등록된 배입니다." + 선종별 척수 + 표 `#co-ships`) → 임금 칸 `#co-wage`. 옆 칸: 연락처(전화·팩스·주소, null은 줄 생략), 바로 가기(씨넷, 한국선원복지고용센터, 이 회사 정보 제보).
- CO 회사: 기존 본문 + `#co-reg`(등록 선박 표 `#co-ships` 포함, 첫 줄 기존 문구) + `#co-wage`, 옆 칸에 연락처(firm 있으면).
- 임금 칸 줄: firm 있으면 선박별 (bizKey, 통계 선종) 조합(KOSWEC 선종→통계 이름은 `STAT_TO_KOS` 역변환), 척수 많은 순 최대 6줄, `wage.biz[b].types[s]`가 있고 승선원>0인 것만. firm 없으면 `c.types`마다 `TYPE_MAP[id].biz × stat` 중 첫 줄들(최대 6). 제목 `이 회사 배의 월평균 임금` + `통계` 태그, 아래 한 줄 "업종·선종 평균이며 이 회사 급여가 아닙니다."와 `#wage` 링크.
- `#firm-<id>` 들어오면: UNI에서 `firm.id === id`인 항목을 찾아 `history.replaceState`로 `#co-<이름>`, 그 화면을 그림. 없으면 "찾는 선사가 없습니다…".

- [ ] **Step 1: 실패 테스트** (`18-co-page.test.mjs`):
  - `co-firm-only`: `#co-씨엠에스마리타임(주)` → h1 이름, `#co-ships tbody tr` 109행, `#co-wage tbody tr.wrow` ≥1, `.ctag.r` 있음, `[data-cmpco]` 없음, 별 버튼 있음, 제목 `씨엠에스마리타임(주) | 선사록`.
  - `co-firm-only-paren`: `#co-` + `encodeURIComponent('선진해양(유)')` 열림, 다음 `#home` 갔다가 `history.back()` → 같은 회사 다시 보임.
  - `co-hmm-merged`: `#co-HMM` → `#co-ships` 65행, `#co-reg` 첫 `p`에 `기준이 다릅니다`, `#co-wage`에 `외항선 · 컨테이너` 또는 `해외취업상선 · 컨테이너` 줄, 옆 칸에 `02-464-1245`.
  - `co-managed`: `#co-현대글로비스` → `지마린서비스 이름으로 등록`, `#co-ships` 없음, `#co-wage`에 `자동차` 줄.
  - `firm-redirect`: `#firm-에이치엠엠` → 잠시 뒤 `location.hash === '#co-HMM'`; `#firm-씨엠에스마리타임` → `#co-` + 인코딩 이름.
  - `co-firm-load-fail`: koswec.json abort → `#co-HMM` 개요 보임, `#co-reg` hidden; `#co-씨엠에스마리타임(주)` → `.load-fail button[data-retry]`.
  - `co-missing`: `#co-없는회사` → `찾는 선사가 없습니다`, 오류 0.
  - 기존 14·15의 `firm-*`·`co-reg-*` 테스트는 같은 뜻으로 `#co-` 기준으로 고친다(`firm-hmm` → `co-hmm-merged`에 흡수 가능, `firm-no-mobile` → `#co-소스코리아(주)`, 모바일 가로 스크롤 테스트 대상 `#co-HMM`, `#co-씨엠에스마리타임(주)`).
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** `run.mjs 18`, 14, 15 및 전체 PASS.
- [ ] **Step 5: Commit** `"ship_info: 회사 화면 하나로(선사·등록 선박·임금)"`

### Task 3: 선종 표 아래 '등록 선박만 있는 회사' 묶음

**Files:**
- Modify: `apps/ship_info/index.html` — `#v-type`의 표(`.table-scroll`) 바로 뒤 `<section id="reg-group"></section>`, `renderTable()` 끝에서 `renderRegGroup(typeId)`, `state.more`, `filterQuery()`/`applyQuery()`에 `more=1`, `renderTypeHead()` 회사 수 덧붙임
- Test: `docs/superpowers/tests/ship_info/tests/19-type-reg.test.mjs`

**Interfaces:**
- Consumes: `uniReady`, `regOnlyFor`, `typeShipCount`, `UNI_BY`, `FILTERS`, `state`.
- Produces: `renderRegGroup(typeId): void`; `REG_BLOCK_FILTERS = ['kind','fleet','routes','cadet','reserve']`.

내용: 머리 단추 `<button aria-expanded aria-controls="reg-list">등록 선박만 있는 회사 n곳</button>` + 한 줄 설명 "선사 자료 없이 한국선원복지고용센터 등록 선박만 있는 회사입니다. 이 선종 등록 척수가 많은 순입니다." 펼치면 표 `#reg-list`(회사명 링크, 업종, 이 선종 척수, 전체 등록 척수, 전화). 이름 검색(`state.q`)은 묶음에도 적용, 걸린 게 있고 위 표 결과가 0이거나 `state.q`가 있으면 자동 펼침 + 머리에 `검색어에 맞는 회사 k곳`. `REG_BLOCK_FILTERS` 중 하나라도 켜지면 묶음 대신 `<p class="note">회사 구분·선단 규모·항로·실습·예비역 필터는 선사 자료가 있는 회사에만 적용됩니다.</p>`. 0곳이면 섹션 숨김. 머리 단추 누르면 `state.more` 토글 + `syncHash()`. 휴대폰은 v2 `.wt` 표 + `.table-scroll`. 선종 머리 `p.sub`에 uniReady 뒤 ` · 등록만 n곳`.

- [ ] **Step 1: 실패 테스트**:
  - `reg-group-cement`: `#type-cement` → `#reg-group button[aria-expanded="false"]` 글자에 `131곳`; 클릭 → `#reg-list tbody tr` 131행, 주소에 `more=1`, 첫 줄 이 선종 척수가 최대.
  - `reg-group-search-opens`: `#type-bulk?q=` + 등록만 벌크 회사 이름 일부(테스트에서 `regOnlyFor('bulk')[0].n`의 앞 3글자로) → 묶음 자동 펼침, 그 회사 줄 보임.
  - `reg-group-hidden-by-filter`: `#type-bulk?cadet=1` → `#reg-list` 없음, 안내 문구 보임.
  - `reg-group-no-dup`: `#type-container` 펼침 → 위 표 회사 이름(CO)과 묶음 회사 이름 겹침 0, 묶음 안에 `에이치엠엠(주)` 없음.
  - `reg-group-head-count`: `#type-lng` → `#type-head .sub`에 `등록만 1곳`.
  - `reg-group-mobile`: 390px `#type-cement?more=1` → scrollWidth ≤ 390.
- [ ] **Step 2:** FAIL. **Step 3:** 구현. **Step 4:** `run.mjs 19` 및 전체 PASS.
- [ ] **Step 5: Commit** `"ship_info: 선종 표에 등록 선박만 있는 회사 묶음"`

### Task 4: 선사 목록과 검색 합치기

**Files:**
- Modify: `apps/ship_info/index.html` — `renderDir()`를 UNI 기준으로, 메뉴 글자 `등록 업체` → `선사 목록`, 홈 `.types-more` 링크 글자 `선사 목록 385곳`, `sxOpen()`의 선사·등록 업체 묶음 합치기, 도움말 바로 가기 글자
- Modify tests: `14-dir.test.mjs`(머리 숫자, 첫 줄, 링크 형식), `15-co-search.test.mjs`(`search-firm`), `11-base.test.mjs`(메뉴)
- Test: `docs/superpowers/tests/ship_info/tests/20-dir-merged.test.mjs`

**Interfaces:**
- Consumes: Task 1 `UNI`, `uniReady`, `regionOf`, `firmTopTypes`.
- Produces: `renderDir(qs)`(주소 형식 v2 그대로 + `&co=1`).

내용: 머리 `선사 385곳 · 등록 선박 3,248척`. 줄: 회사명(→`coHref`), 태그(`선사 자료` 또는 `등록`), 업종(firm 있으면 KOSWEC 업체 업종, 없으면 CO kind 글자 선주사/관리선사), 등록 척수(null이면 `-`), 많은 선종 3개(firm 있으면 KOSWEC 선종, 없으면 앱 선종 이름), 전화. 필터: 기존 + `선사 자료 있는 회사만` 체크(`co=1`). 선박명 검색은 firm 선박에. 업종·지역 필터가 켜지면 firm 없는 회사는 빠진다. 선종 칩 필터: firm 있으면 KOSWEC 선종, 없으면 해당 없음(빠짐). 기본 정렬 '선박 많은 순'에서 척수 null은 맨 뒤, 그 안에서 CO 순서. 검색창: '선사' 묶음 하나 — CO 이름·sub·선종 일치 먼저, 그다음 (uniReady 됐으면) 등록만 회사 이름 일치, 합쳐 최대 12개, 오른쪽 `선주사`/`관리선사`/`n척 등록`.

- [ ] **Step 1: 실패 테스트**:
  - `dir-385`: `#dir` → h1에 `385곳`; `#dir?co=1` → 결과 53곳(`#dir-count`).
  - `dir-links-co`: 첫 줄 링크 href가 `#co-`로 시작.
  - `dir-co-only-firmless`: `#dir?q=고려해운` → 한 줄, 등록 척수 `-`, 태그 `선사 자료`.
  - `search-merged`: 검색창 `흥아` → 한 묶음 `선사` 안에 `흥아라인`(CO)과 `흥아마린(주)`(등록만, `13척 등록`), `.sx-sec` 중 `등록 업체` 없음.
  - `nav-dir-label`: `#navlinks a[href="#dir"]` 글자 `선사 목록`.
  - 기존 `dir-default`(첫 줄 포스에스엠 128, 50줄, 더 보기 100), `dir-type-link-filter`, `dir-cement-link`, `dir-ship-search`, `dir-bad-query`, `dir-empty-reset`, `dir-mobile-filters`는 그대로 통과해야 한다(머리 숫자 단언만 385로).
- [ ] **Step 2:** FAIL. **Step 3:** 구현. **Step 4:** `run.mjs 20`, 11, 14, 15 및 전체 PASS.
- [ ] **Step 5: Commit** `"ship_info: 선사 목록·검색을 하나로"`

### Task 5: v3.0.0, 출처·기록, 점검

**Files:**
- Modify: `apps/ship_info/index.html`(VERSION, `#ver-top`, `#ver-foot`, PATCH_NOTES, `#readme` 등록 업체 문장을 통합 설명으로), `apps/ship_info/PRODUCT.md`, 메인 폴더 `apps/ship_info/HANDOFF.md`(git 추적 안 함)
- Test: `16-release.test.mjs`(버전 단언은 VERSION과 일치만 보므로 그대로), `no-ai-tells`에 `#co-씨엠에스마리타임(주)`, `#type-cement?more=1` 추가

- [ ] **Step 1:** `no-ai-tells` 대상 추가 후 실행(새 화면 문구 점검), 실패하면 문구 고침.
- [ ] **Step 2:** 버전·패치노트(3.0.0, 2026-11-26): 회사 화면 하나로(선사 자료·등록 선박·임금), 선종 표 아래 등록 선박만 있는 회사 묶음, 메뉴 '선사 목록' 385곳, 검색 합침, 예전 `#firm-` 주소는 회사 화면으로 연결.
- [ ] **Step 3:** 캡처 `shots.mjs`로 `#co-HMM`, `#co-씨엠에스마리타임(주)`(파일명용 해시 대신 FULL=1로 따로), `#type-cement?more=1`, `#dir` 1440·390 × 라이트·다크, 직접 열어 확인.
- [ ] **Step 4:** PRODUCT.md 화면 목록·자료 설명, HANDOFF.md 버전·라우트·다음 후보(별 누르면 임금 줄 접힘, 화면낭독기 3건, 해운 소식 확장) 고침. 전체 `run.mjs` PASS.
- [ ] **Step 5: Commit** `"ship_info(선사록) v3.0.0: 선사·등록 업체를 한 화면으로"`

### 마무리
- 최종 검토 에이전트(가장 성능 좋은 모델) 1회 → Critical/Important만 TDD로 고침.
- `git status -sb` → `git fetch` → `git rebase origin/main` → `git push origin sasarok-v3:main` → 배포 주소에서 새 테스트(17~20) 실행.
