# 선사록 임금 통계·KOSWEC 등록 업체 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선사록(v1.0.2)에 「2026 한국선원통계연보」 임금 통계와 KOSWEC 3척 이상 등록 업체 371곳을 넣어 v2.0.0으로 낸다.

**Architecture:** PDF → JSON 변환 스크립트 2개(파이썬, pdfplumber)가 `apps/ship_info/data/`에 `wage.json`, `koswec.json`을 만든다. `index.html`은 해당 화면에 처음 들어갈 때 `fetch`로 불러와 메모리에 둔다. 새 화면 `#wage`, `#dir`, `#firm-<이름>`을 기존 해시 라우터 `route()`에 붙이고, 선종 화면·선사 상세·검색·홈에 진입점을 단다.

**Tech Stack:** 단일 정적 HTML(바닐라 JS), Python 3 + pdfplumber(빌드 전용), Node + playwright-core 테스트(`docs/superpowers/tests/ship_info/`).

**Spec:** `docs/superpowers/specs/2026-11-26-sasarok-wage-and-koswec-design.md` (먼저 읽을 것)

## Global Constraints

- 원본 PDF: `선사록 자료/압축해제)-(최종)_261126_105218 (1).pdf`(임금, 72쪽), `선사록 자료/KOSWEC_업체_선박정보_2026-11-26.pdf`(283쪽). 폴더는 git 제외. 파이썬은 `python3 -I`로 돌리고 PDF 경로는 인자로 넘긴다.
- 기존 데이터(CO, TYPES, CAP, JOB, NEWS) 내용은 바꾸지 않는다. 숫자를 지어내지 않는다. 원본 '-'는 `null`.
- 대표자 이름은 어디에도 넣지 않는다. 휴대폰 번호(`^01[016789]`)인 전화·팩스는 뺀다.
- 등록 업체는 상세 선박 목록 기준 3척 이상만(371곳, 3,248척). 이름이 `개인선주(`·`연근해어선(`로 시작하는 지역 묶음 25개는 뺀다. `동원해사랑(주)` 두 항목(원양어선 4 + 연근해어선 5, 연락처 같음)은 한 업체 9척으로 합친다. `태양해운(양희정)`은 `태양해운`으로 쓴다. `태진해운(주)` 두 항목(1+3척)도 합친다. 선박이 모두 어선(원양어선·연근해어선·해외취업어선)인 회사는 뺀다(40곳). 섞인 `가나마린(주)`는 남긴다.
- 앱 선종 옆에는 항상 `앱 이름 (KOSWEC·통계 이름)` 형식. 예: `벌크선 (잡화)`.
- 금액 표시는 만 원(천 원 ÷ 10 반올림, 천 단위 쉼표). 천 원 원값은 펼침에만.
- 신뢰 표시: 임금 `통계`, 등록 업체 `등록` (기존 `.ctag` 모양을 따르되 새 클래스 `.ctag s`, `.ctag r`).
- 문구: 짧은 평서문, 이모지·느낌표·"한눈에"·"완벽"·"~해보세요!" 금지. 새 장식·그라데이션·큰 숫자 배너 금지. 숫자 칸은 `font-variant-numeric: tabular-nums`, 오른쪽 맞춤.
- 다크모드 유지, 주황 바탕 위 글자는 `#16181d`.
- 버전 v2.0.0: `VERSION`, `#ver-top`, `#ver-foot` 문구, `PATCH_NOTES` 맨 앞 항목을 같은 커밋에서.
- 커밋 전 `git status -sb`. `apps/ship_handling/` 등 다른 세션 변경 파일은 add하지 않는다. 푸시 전 `git fetch` 후 rebase.
- 테스트 서버: `cd /Users/turo/Downloads/Claude/bypass && python3 -I -m http.server 8765 --bind 127.0.0.1 --directory .` (백그라운드로 켜 둠).

## Review Focus

1. 자료 없는 칸(통계 '-', 승선원 0명): `-`로 보여야 하고 0이나 NaN, `undefined`가 나오면 안 된다. → Task 3 테스트 `type-wage-dash-not-zero`(내항선 LNG 2척 표).
2. JSON 불러오기 실패(오프라인, 404): 화면이 비거나 멈추지 않고 "자료를 불러오지 못했습니다. 다시 시도" 단추가 나와야 한다. → Task 2 테스트 `load-fail-shows-retry`.
3. 주소창에 이상한 값(`#dir?type=없는선종`, `#firm-없는회사`, 잘못된 `%` 인코딩): 빈 목록 안내나 "찾는 업체가 없습니다"가 나오고 오류가 없어야 한다. → Task 5 테스트 `dir-bad-query`, `firm-missing`.
4. 휴대폰(390px)에서 새 표가 화면을 옆으로 밀지 않아야 한다(표 안에서만 가로 스크롤). → Task 4·5 테스트 `wage-mobile-no-hscroll`, `dir-mobile-no-hscroll`.
5. 등록 선박 수가 선대 규모로 읽히는 일: 선사 상세 칸 첫 줄에 기준 차이 문구가 반드시 있어야 한다. → Task 6 테스트 `co-reg-panel-hmm`.

---

### Task 1: PDF → JSON 변환 스크립트와 데이터

**Files:**
- Create: `docs/superpowers/tools/ship_info/build_wage.py`
- Create: `docs/superpowers/tools/ship_info/build_koswec.py`
- Create: `docs/superpowers/tools/ship_info/check_data.py`
- Create(생성물): `apps/ship_info/data/wage.json`, `apps/ship_info/data/koswec.json`

**Interfaces:**
- Produces `wage.json`:
  ```
  {source:{title:'2026년 한국선원통계연보 3. 임금현황', pages:'227~297쪽', unit:'천원',
           note:'월평균 임금은 업종별 총승선원의 평균값'},
   ranks:[[key,label]×21],            // 아래 순서 고정
   overall:{vessels:6687, rows:[[n,total,basic,ot,bonus,other]×21]},
   biz:{<bizKey>:{name, vessels, rows:[…21], types:{<통계선종>:{vessels, rows:[…21], note?}}}}}
  ```
  - bizKey/name: `ocean`외항선, `coastal`내항선, `deepsea`원양어선, `nearsea`연근해어선, `fmerchant`해외취업상선, `ffish`해외취업어선.
  - ranks 순서와 key: total 합계, off 해기사 계, master 선장, co 1항사, o2 2항사, o3 3항사, ce 기관장, e1 1기사, e2 2기사, e3 3기사, ro 통신장, rat 부원 계, bsn 갑판장, abs 갑판수, os 갑판원, olr 조기장, oiler 조기수, wiper 조기원, ccook 조리장, cook 조리수, boy 조리원.
  - 통계 선종 이름(공백 제거): 잡화, 컨테이너, 유조, LPG, LNG, 케미컬, 급유, 자동차, 냉동, 여객, 예인, 기타, 유·도선(`유․도선`도 이것으로), 예선(이접안용), 도선선 / 어선: 선망, 트롤, 연승, 채낚기, 봉수망, 저인망, 유자망, 안강망, 통발, 수산물운반선, 기선권현망.
  - 쪽 배정(0부터 아님, PDF 1부터): 1~2 overall(2쪽이 직책별 21줄), 4 ocean 직책별, 5~15 ocean 선종, 17 coastal 직책별, 18~29 coastal 선종, 31 deepsea 직책별, 32~36 deepsea 조업형태, 37~39 건너뜀(최저보장임금), 41 nearsea 직책별, 42~52 nearsea, 54 fmerchant 직책별, 55~65 fmerchant, 67 ffish 직책별, 68~71 ffish.
  - 65쪽(해외취업상선 기타)은 제목 줄이 주석으로 시작한다: `types['기타'].note = '승선원 전원 외국인선원으로 임금자료 없음'`.
- Produces `koswec.json`:
  ```
  {source:{site:'koswec.or.kr 정보마당 › 업체조회', collected:'2026-11-26',
           totals:{summaryFirms:907, summaryShips:6753, detailFirms:907, detailShips:6753}},
   bizNames:['외항상선','해외취업상선','내항상선','원양어선','해외취업어선','연근해어선'],
   typeNames:[KOSWEC 선종 26개, 많은 순],
   firms:[{id, n, b:<bizNames 인덱스>, tel, fax, addr, app:<앱 CO 이름|null>,
           ships:[[name, gt:number|null, b:<인덱스>, t:<typeNames 인덱스>, flag, owner]]}]}
  ```
  - `id`: 이름에서 `(주)`·`㈜`·공백 뺀 것. 371개 모두 달라야 한다.
  - `b`(업체 업종): 상세 구역의 `■ 해외취업상선 (44곳)` 같은 줄로 바뀐다. 첫 구역은 외항상선. 병합한 업체는 선박이 많은 쪽 업종.
  - 정보 줄 `대표 … · 전화 … · 팩스 … · 주소`를 ` · `로 나눠 `전화 `, `팩스 ` 접두로 고르고 나머지 마지막 조각을 주소로. `대표` 조각은 버린다. 값이 `-`/`--`면 `null`.
  - 선박 줄 꼬리 `선종 선박국적 선주국적`: 알려진 선종 이름으로 앞을 떼고, 남은 부분을 나라 이름 두 개로 나눈다. 나라 목록은 같은 쪽의 `extract_tables()` 6·7번째 열에서 모은 집합(띄어쓴 나라 `마샬 제도` 등 포함). 나눌 수 없으면 스크립트가 실패한다.
  - `app` 고정 목록(39곳): spec '화면 5' 대응표 그대로 `build_koswec.py` 안에 `APP_NAME = {'에이치엠엠':'HMM', …}` 형태로.

- [ ] **Step 1: `check_data.py` 작성(실패 확인용)** — `python3 -I check_data.py <data폴더>`가 다음을 assert:
  - wage: `overall.vessels==6687`; `overall.rows[0]==[25188,6549,3455,2461,92,541]`; `biz.ocean.rows[0]==[6583,8848,4382,3012,None,1454]`; `biz.ocean.types.LNG.rows[0]==[718,10023,4691,3518,None,1814]`, `vessels==64`; `biz.ocean.types['자동차'].rows[2]==[79,15797,7188,5797,None,2812]`; `biz.deepsea.rows[2][1]==25950`; `biz.coastal.types.LNG.vessels==2`; 모든 `rows` 길이 21, 값은 int 또는 None; ocean 선종 11개, coastal 12개, fmerchant 11개; `fmerchant.types['기타'].note` 존재.
  - koswec: firms 371개, 선박 합 3248, 이름이 `개인선주`·`연근해어선`으로 시작하는 firm 없음, 어선만 가진 firm 없음, `동원해사랑(주)` 없음, `가나마린(주)` 14척, `태진해운(주)` 1개·4척, 어떤 이름·id에도 `양희정` 없음, 모든 firm `len(ships)>=3`, id 중복 없음, `app`이 null 아닌 firm 39개이고 `{f.app}`에 'HMM','K-LNG','훼어선박' 포함, 어떤 firm에도 '대표' 문자열 없음, tel/fax가 `01`로 시작하는 값 없음, 모든 ship의 flag·owner가 비어 있지 않음, `'에이치엠엠(주)'`의 선박 65척.
- [ ] **Step 2:** 데이터 없이 실행 → FileNotFoundError로 실패 확인.
- [ ] **Step 3:** `build_wage.py <pdf> <out.json>`, `build_koswec.py <pdf> <out.json>` 구현. 줄 정규식 참고: 직책 행은 `^(.*?)\s*([\d,]+|-)(\s+([\d,]+|-)){5}$`, 쪽마다 정확히 21줄이 나와야 하고 아니면 실패. 척수는 `\(([\d,]+)척\)`. 업체 머리 `^(.+?) (\d[\d,]*)척$`, 선박 행 `^(\d+) (.+) (\d[\d,.]*T|-) (업종6개) (.+)$`. 지역 묶음 25개 제외 → 같은 이름 항목 병합(선박 목록 이어 붙임, 업체 `b`는 선박이 많은 쪽) → `태양해운(양희정)` 이름 바꿈 → 3척 미만 빼기 → 선박이 모두 어선인 업체 빼고 저장. JSON은 `separators=(',',':')`, `ensure_ascii=False`.
- [ ] **Step 4:** 두 빌드 실행 후 `check_data.py` 통과 확인. `ls -l apps/ship_info/data` 로 koswec.json 크기 확인(400KB 넘으면 선박 필드 압축을 다시 본다).
- [ ] **Step 5: Commit** — `git add docs/superpowers/tools/ship_info apps/ship_info/data docs/superpowers/specs/2026-11-26-sasarok-wage-and-koswec-design.md docs/superpowers/plans/2026-11-26-sasarok-wage-and-koswec.md && git commit -m "ship_info: 임금 통계·KOSWEC 등록 업체 데이터 변환"`

### Task 2: 공통 기반(불러오기, 선종 대응표, 라우팅, 메뉴)

**Files:**
- Modify: `apps/ship_info/index.html` — 데이터 상수 뒤(`CO_BY` 근처, ~1109줄)에 새 블록, `route()`(~1703줄), 상단 메뉴 `#navlinks`(~539줄), 뷰 컨테이너(~677줄 근처에 `#v-wage`, `#v-dir`, `#v-firm` 추가), CSS(`.ctag` 정의 근처)
- Test: `docs/superpowers/tests/ship_info/tests/11-base.test.mjs`

**Interfaces:**
- Produces (전역, 이후 Task가 씀):
  - `loadData(name: 'wage'|'koswec'): Promise<object>` — 한 번만 fetch(`data/<name>.json`), 결과 캐시, 실패 시 캐시 비우고 reject.
  - `dataBox(el: Element, name, render: (data)=>void): void` — el에 "불러오는 중" → 성공 시 `render(data)`, 실패 시 `<p class="load-fail">자료를 불러오지 못했습니다. <button type="button" class="linkbtn" data-retry>다시 시도</button></p>` (버튼 누르면 다시 `dataBox`).
  - `TYPE_MAP: {[typeId]: {label: string, stat: string[], kos: string[], biz?: string[], shared?: string}}` — spec 표 그대로. `biz` 기본값 `['ocean','fmerchant','coastal']`, cement만 `['coastal']`. shared 문구:
    - crude: `석유제품선/케미컬선과 함께 '유조'로 집계됩니다.`
    - product: `'유조'는 원유운반선과 함께 집계됩니다.`
    - bulk: `시멘트선/연안선과 함께 '잡화'로 집계됩니다.`
    - cement: `'잡화'는 벌크선, '기타'는 중량물선/특수선과 함께 집계됩니다.`
    - heavy: `시멘트선/연안선과 함께 '기타'로 집계됩니다.`
  - `STAT_TO_KOS = {'급유':'급유선','냉동':'냉동냉장'}` (나머지는 같은 이름).
  - `typeLabel(id): string` → `TYPE_BY_ID[id].name + ' (' + TYPE_MAP[id].label + ')'`.
  - `man(k: number|null): string` → null이면 `'-'`, 아니면 `Math.round(k/10).toLocaleString('ko-KR')`.
  - `BIZ_KEYS = ['ocean','coastal','deepsea','nearsea','fmerchant','ffish']`, `KOS_BIZ = {ocean:'외항상선', coastal:'내항상선', deepsea:'원양어선', nearsea:'연근해어선', fmerchant:'해외취업상선', ffish:'해외취업어선'}`.
  - 라우트: `#wage[?biz=&sort=]` → `renderWage(qs)`, `#dir[?…]` → `renderDir(qs)`, `#firm-<encodeURIComponent(id)>` → `renderFirm(id)`. 이 Task에서는 세 함수를 "불러오는 중" 틀만 그리는 빈 구현으로 두고 Task 4·5가 채운다. `ids` 배열에 'wage','dir','firm' 추가, 제목 `임금 | 선사록`, `등록 업체 | 선사록`, `<업체명> | 선사록`.
  - 메뉴: `#navlinks`에 `<a href="#wage">임금</a><a href="#dir">등록 업체</a>`를 '해운 소식' 앞에.
  - CSS: `.ctag.s`(통계), `.ctag.r`(등록) — 기존 `.ctag.p` 모양에서 색만 다르게, 라이트·다크 대비 4.5:1 이상.

- [ ] **Step 1: 실패 테스트 작성** (`11-base.test.mjs`):
  - `nav-has-wage-dir`: `#home`에서 `#navlinks a[href="#wage"]`, `a[href="#dir"]` 존재.
  - `routes-open-views`: `#wage`에서 `#v-wage` 보임, 제목 `임금 | 선사록`; `#dir`에서 `#v-dir` 보임; 오류 0.
  - `load-fail-shows-retry`: `page.route('**/data/wage.json', r => r.abort())` 후 `#wage` → `.load-fail button[data-retry]` 보임. 라우트 해제 후 버튼 클릭 → `.load-fail` 사라짐.
  - `type-label-format`: `page.evaluate(() => [typeLabel('bulk'), typeLabel('product'), man(10023), man(null)])` → `['벌크선 (잡화)','석유제품선/케미컬선 (유조·케미컬)','1,002','-']`.
- [ ] **Step 2:** `node docs/superpowers/tests/ship_info/run.mjs 11` → FAIL 확인.
- [ ] **Step 3:** 위 Interfaces 구현.
- [ ] **Step 4:** `run.mjs 11` PASS, 전체 `run.mjs`도 기존 65개 통과.
- [ ] **Step 5: Commit** — `git add apps/ship_info/index.html docs/superpowers/tests/ship_info/tests/11-base.test.mjs && git commit -m "ship_info: 임금·등록 업체 화면 기반"`

### Task 3: 선종 화면 '월평균 임금' 칸

**Files:**
- Modify: `apps/ship_info/index.html` — `#v-type` 안 `#sort-note` 다음, `#type-pc` 앞에 `<section class="sheet blk" id="type-wage"></section>`; `route()`의 type 분기에서 `renderTypeWage(next)` 호출
- Test: `docs/superpowers/tests/ship_info/tests/12-type-wage.test.mjs`

**Interfaces:**
- Consumes: `loadData`, `dataBox`, `TYPE_MAP`, `typeLabel`, `man`, `STAT_TO_KOS`, `KOS_BIZ` (Task 2)
- Produces: `renderTypeWage(typeId): void`, `wageRowsHtml(row21: Array, cols: string[]): string`(Task 4가 재사용), `WAGE_COLS = ['total','master','co','o3','ce','e1','e3']`, `smallSample(vessels, n): boolean` → `vessels < 10 || n < 10`.

내용: 제목 `월평균 임금 · ${typeLabel(id)}` + `통계` 태그. 표 열: 업종, 전체 평균, 선장, 1항사, 3항사, 기관장, 1기사, 3기사, 척수(머리에 "(만 원)"). 줄 = TYPE_MAP[id].biz × stat 중 `biz[b].types[stat]`가 있고 합계 승선원 > 0인 것. 업종 칸 글자: `외항선 · 잡화`처럼 업종 + 통계 선종(stat이 하나면 선종 생략 가능하지만 항상 붙이는 것으로 통일). 줄 버튼(`aria-expanded`)으로 펼치면 21직책 표(승선원, 계, 기본임금, 시간외수당, 상여금, 기타, 단위 천 원 원값). 표본 적음이면 업종 칸에 `<span class="note">표본 적음</span>`. 표 아래: shared 문구(있으면), 출처 한 줄 `2026년 한국선원통계연보 임금현황. 월평균 임금은 업종별 총승선원의 평균값이며 회사별 급여가 아닙니다.`, 링크 `<a href="#wage?biz=ocean">임금 화면에서 다른 선종과 비교</a>`, `<a href="#dir?type=${kos들 STAT_TO_KOS 변환, 쉼표}${cement면 '&biz=내항상선'}">이 선종 배를 등록한 업체 보기</a>`.

- [ ] **Step 1: 실패 테스트**:
  - `type-wage-lng`: `#type-lng` → `#type-wage` 제목에 `LNG선 (LNG)`; 외항선 줄 전체 평균 칸 `1,002`; 링크 `a[href="#dir?type=LNG"]` 있음.
  - `type-wage-product-two-stats`: `#type-product` → 외항선 줄이 `유조`, `케미컬` 두 개; shared 문구 `원유운반선과 함께` 포함.
  - `type-wage-cement-coastal-only`: `#type-cement` → 모든 줄 업종이 `내항선`; 링크 href에 `biz=` 포함.
  - `type-wage-dash-not-zero`: `#type-lng` 내항선 LNG 줄에 `표본 적음`; 펼친 표에 `NaN`, `undefined`, `null` 문자열 없음.
  - `type-wage-expand`: 외항선 LNG 줄 버튼 클릭 → 21행 표 보임, `aria-expanded="true"`, 선장 행 계 칸 원값(천 원)이 PDF 값과 같음(외항 LNG 선장 값은 `wage.json`에서 읽어 비교).
  - `type-wage-above-pc`: `#type-wage`의 top < `#type-pc`의 top.
- [ ] **Step 2:** `run.mjs 12` FAIL 확인.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** `run.mjs 12` PASS, 전체 통과.
- [ ] **Step 5: Commit** — `"ship_info: 선종 화면 월평균 임금"`

### Task 4: 임금 화면 `#wage`

**Files:**
- Modify: `apps/ship_info/index.html` — `renderWage(qs)` 채우기
- Test: `docs/superpowers/tests/ship_info/tests/13-wage.test.mjs`

**Interfaces:**
- Consumes: Task 2·3의 `loadData`, `dataBox`, `man`, `wageRowsHtml`, `WAGE_COLS`, `smallSample`, `TYPE_MAP`, `typeLabel`
- Produces: `renderWage(qs: string): void`; 주소 형식 `#wage?biz=<bizKey>&sort=<rankKey|vessels>`(기본 `biz=ocean`, `sort=total`, 내림차순). 잘못된 값은 기본값으로.

내용: 맨 위 짧은 총괄 표(업종 6줄: 업종, 척수, 승선원, 전체 평균 만 원). 업종 단추 6개(`.seg`, `aria-pressed`). 본표 줄 = 선택 업종의 통계 선종, 이름은 그 선종을 쓰는 앱 선종이 있으면 `앱 이름 (통계 이름)`(여러 개면 `벌크선·시멘트선/연안선 (잡화)`처럼 앱 이름을 `·`로), 없으면 통계 이름만. 열 머리 단추로 정렬(`aria-sort`). 줄 펼침은 Task 3과 같은 21직책 표. 휴대폰은 기존 모바일 표 방식(표를 감싼 상자 안 가로 스크롤). 아래 출처 줄.

- [ ] **Step 1: 실패 테스트**:
  - `wage-default-ocean`: `#wage` → `[aria-pressed="true"]` 단추 글자 `외항선`; 본표 첫 줄이 전체 평균 최고(외항선은 자동차 `1,053`).
  - `wage-switch-coastal-url`: `내항선` 단추 클릭 → `location.hash`가 `#wage?biz=coastal`로 시작, 줄 수 12.
  - `wage-sort-master`: `#wage?biz=ocean&sort=master` → 첫 줄 선장 칸 값이 열에서 가장 큼, 해당 `th`의 `aria-sort="descending"`.
  - `wage-bad-query`: `#wage?biz=xx&sort=yy` → 외항선 기본으로 보이고 오류 0.
  - `wage-names-paren`: 외항선 표에 `벌크선·시멘트선/연안선 (잡화)` 또는 spec 규칙대로 만든 이름이 있음; `냉동` 줄은 괄호 없음.
  - `wage-mobile-no-hscroll`: 390×844, 라이트·다크 → `documentElement.scrollWidth <= 390`.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** `run.mjs 13` 및 전체 PASS.
- [ ] **Step 5: Commit** — `"ship_info: 임금 화면"`

### Task 5: 등록 업체 `#dir`와 업체 상세 `#firm-`

**Files:**
- Modify: `apps/ship_info/index.html` — `renderDir(qs)`, `renderFirm(id)`
- Test: `docs/superpowers/tests/ship_info/tests/14-dir.test.mjs`

**Interfaces:**
- Consumes: `loadData('koswec')`, `dataBox`, `TYPE_MAP`, `coHref`(기존)
- Produces: `renderDir(qs)`, `renderFirm(id)`, `firmHref(id): string` → `'#firm-'+encodeURIComponent(id)`, `regionOf(addr): string`(주소 첫 단어에서 `특별시|광역시|특별자치시|특별자치도|도` 접미 제거, 예 `부산광역시`→`부산`, `경기도`→`경기`, 없으면 `기타`), `firmTopTypes(f, k=3): string[]`.
- 주소 형식: `#dir?q=&biz=<업종이름>&type=<KOSWEC선종,쉼표>&r=<지역>&sort=ships|name`. 모르는 값은 무시(빈 결과가 아니라 필터 해제).

`#dir` 내용: 머리 한 줄 `KOSWEC 등록 업체 371곳 · 선박 3,248척` + `등록` 태그, 출처 문단(spec 문구 그대로 + "선박 3척 이상인 회사만 실었습니다. 개인선주·연근해어선 지역 묶음은 회사가 아니어서 뺐습니다. 어선만 운용하는 회사도 뺐습니다."). 필터: 검색(회사명·선박명), 업종 select, 선종 칩(다중), 지역 select, 정렬 select. 결과 줄: 회사명(링크 `firmHref`), 업종, 선박 수, 많은 선종 3개, 전화. `app` 있으면 `선사록에 있음` 링크(`coHref(app)`). 처음 50곳, `더 보기` 단추로 50씩. 결과 0이면 `조건에 맞는 업체가 없습니다. 필터를 줄여 보시기 바랍니다.` + 필터 초기화 단추. 선박명 검색으로 찾았으면 줄 아래 `선박: <이름>` 한 줄.

`#firm-` 내용: 경로 `처음 › 등록 업체 › 이름`, 업종, 전화·팩스·주소(null이면 줄 생략), 선종별 척수, 선박 표(#, 선박명, 총톤수(`toLocaleString`+'톤', null은 '-'), 업종, 선종, 선박 국적, 선주 국적 — 원본 순서), 출처. `app` 있으면 `선사록 선사 정보 보기` 링크. 없는 id면 `찾는 업체가 없습니다. 등록 업체 목록에서 다시 찾아보시기 바랍니다.` + `#dir` 링크.

- [ ] **Step 1: 실패 테스트**:
  - `dir-default`: `#dir` → 결과 줄 50개, 첫 줄 선박 수가 최대(포스에스엠(주) 128), `더 보기` 클릭 후 100개.
  - `dir-type-link-filter`: `#dir?type=LNG` → 모든 줄에 LNG 선박 보유(첫 줄 `케이엘엔지(주)` 또는 LNG 척수 기준이 아닌 선박 수 정렬이면 LNG 보유 업체 중 최대), 줄 수 ≤ 26.
  - `dir-cement-link`: `#dir?type=잡화,기타&biz=내항상선` → 모든 줄 업종 `내항상선`.
  - `dir-ship-search`: 검색창에 `프리즘 다이버시티` 입력 → `케이엘엔지(주)` 한 줄 + `선박: 프리즘 다이버시티`.
  - `dir-bad-query`: `#dir?type=없는선종&r=%E0%A4` → 오류 0, 줄 50개(필터 무시).
  - `firm-hmm`: `#firm-에이치엠엠` → 선박 표 65행, `선사록 선사 정보 보기` href `#co-HMM`, 본문에 `대표` 글자 없음.
  - `firm-missing`: `#firm-없는회사` → `찾는 업체가 없습니다` 문구, 오류 0.
  - `firm-no-mobile`: `koswec.json`에서 `소스코리아` 업체 상세 → `010` 같은 휴대폰 번호 없음.
  - `dir-mobile-no-hscroll`: 390px 라이트·다크, `#dir`와 `#firm-에이치엠엠` 둘 다 `scrollWidth <= 390`.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** `run.mjs 14` 및 전체 PASS.
- [ ] **Step 5: Commit** — `"ship_info: 등록 업체 목록과 상세"`

### Task 6: 선사 상세 칸, 검색, 홈 링크

**Files:**
- Modify: `apps/ship_info/index.html` — `renderCo()`의 '기본 정보' 섹션 뒤에 `<section class="sheet blk" id="co-reg" hidden></section>`(내용은 비동기 채움); `sxOpen()`; 홈 선종 카드(`#v-home .types`) 끝; 검색창 첫 `input`에서 `loadData('koswec')` 시작
- Test: `docs/superpowers/tests/ship_info/tests/15-co-search.test.mjs`

**Interfaces:**
- Consumes: `loadData`, `firmHref`, `firmTopTypes` (Task 5)
- Produces: `MANAGED_BY = {'현대글로비스':'지마린서비스','우진선박':'오션제이드쉬핑','우양상선':'코리아쉽메니져스'}`(값은 CO 이름, 등록 업체는 `firms.find(f => f.app === 값)`), `renderCoReg(name): void`.

선사 상세 칸:
- `app === name`인 업체가 있으면: 제목 `KOSWEC 등록 선박 n척` + `등록` 태그, 첫 줄 `선대 규모(위 숫자)와 기준이 다릅니다. 한국선원복지고용센터에 등록된 배만 셉니다.`, 선종별 척수 한 줄, `<a href="firmHref">등록 선박 목록 보기</a>`.
- `MANAGED_BY[name]`이면: 제목 `KOSWEC 등록 선박`, `이 회사 배는 관리선사 ${관리선사} 이름으로 등록돼 있습니다.` + 그 업체 링크(척수는 쓰지 않음).
- 둘 다 아니면 `hidden` 유지. 불러오기 실패 시도 칸을 숨긴 채 둔다(선사 화면 본문을 막지 않음).

검색: 데이터가 이미 불러와졌을 때만 결과에 `등록 업체` 묶음(회사명 포함, `app`이 있는 업체는 선사 묶음과 겹치므로 제외, 최대 8개, 오른쪽에 `n척`). 바로 가기(도움말 모드)에 `<a class="sx-item" href="#wage">선종별 월평균 임금</a><a class="sx-item" href="#dir">KOSWEC 등록 업체</a>` 추가.

홈: 선종 카드 맨 아래 `<p class="types-more"><a href="#wage">선종별 월평균 임금</a><span aria-hidden="true"> · </span><a href="#dir">KOSWEC 등록 업체 371곳</a></p>`. 다른 홈 배치는 그대로.

- [ ] **Step 1: 실패 테스트**:
  - `co-reg-panel-hmm`: `#co-HMM` → `#co-reg` 보임, 제목에 `65척`, `기준이 다릅니다` 포함, 링크 `#firm-에이치엠엠`.
  - `co-reg-managed`: `#co-현대글로비스` → `지마린서비스 이름으로 등록` 포함, 척수 숫자 없음.
  - `co-reg-hidden`: `#co-팬오션`, `#co-동주해운` → `#co-reg` hidden.
  - `co-reg-count-39`: `loadData('koswec')` 결과에서 `app` 있는 업체 39개, 각 `#co-<app>`에서 `#co-reg` 보임(반복, 오류 0).
  - `search-firm`: 검색창에 `흥아마린` 입력(데이터 로드 대기) → `.sx-item[href^="#firm-"]` 있음.
  - `home-links`: `#home` → `.types-more a[href="#wage"]`, `a[href="#dir"]`.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** `run.mjs 15` 및 전체 PASS.
- [ ] **Step 5: Commit** — `"ship_info: 선사 상세 등록 선박, 검색, 홈 링크"`

### Task 7: 문구·디자인 점검, 버전 2.0.0, 기록

**Files:**
- Modify: `apps/ship_info/index.html`(읽기 전에 `#readme`에 자료 출처 두 줄, `VERSION`, `#ver-top`, `#ver-foot`, `PATCH_NOTES`), `apps/ship_info/HANDOFF.md`, `apps/ship_info/PRODUCT.md`
- Test: `docs/superpowers/tests/ship_info/tests/16-release.test.mjs`

- [ ] **Step 1: 실패 테스트**:
  - `version-2`: `#ver-top`, `#ver-foot` 글자에 `2.0.0`; 이스터에그 패치노트 첫 항목 `2.0.0`.
  - `readme-sources`: `#readme`에 `한국선원통계연보`, `koswec.or.kr` 포함.
  - `no-ai-tells`: `#wage`, `#dir`, `#type-bulk`, `#co-HMM`의 새 영역 글자에 `!`, `한눈에`, `완벽`, `해보세요`, 이모지(`\p{Extended_Pictographic}`) 없음.
- [ ] **Step 2:** FAIL 확인 후 구현. 패치노트 2.0.0(2026-11-26) 항목은 사용자가 읽을 문장으로: 선종 화면 월평균 임금, 임금 화면, KOSWEC 등록 업체 371곳 목록·상세, 선사 상세 등록 선박 칸, 검색·메뉴 추가.
- [ ] **Step 3: 화면 점검** — `node docs/superpowers/tests/ship_info/shots.mjs <scratchpad>/shots '#wage' '#dir' '#firm-에이치엠엠' '#type-bulk' '#co-HMM'`로 1440·390 × 라이트·다크 캡처를 직접 열어 확인. `ui-ux-pro-max` 체크리스트(대비, 터치 영역 44px, 표 정렬, 포커스 표시)로 보고 고친다. `/impeccable critique apps/ship_info/index.html` 점수가 기록(30/40)보다 낮아지지 않게.
- [ ] **Step 4: 문구 점검** — 새로 넣은 한국어 문구를 모아 `humanize-korean`(필요하면 `humanize-scan` 먼저)으로 점검하고 반영. 뜻이 바뀌는 수정은 하지 않는다.
- [ ] **Step 5:** `HANDOFF.md`(현재 버전, 새 화면·라우트, 데이터 파일과 다시 만드는 명령, 새 테스트 수), `PRODUCT.md`(자료 출처, 화면 목록) 고침. 전체 `run.mjs` PASS(기존 65 + 새 테스트).
- [ ] **Step 6: Commit** — `"ship_info(선사록) v2.0.0: 선원 임금 통계, KOSWEC 등록 업체"`

### 마무리 (Task 7 뒤)

- `superpowers:verification-before-completion`: 전체 테스트 출력과 캡처를 증거로 남긴다.
- `superpowers:finishing-a-development-branch`: `git status -sb` → 내 파일만 들어갔는지 확인 → `git fetch` → `git rebase origin/main` → 푸시. 배포 뒤 `https://teambypass.vercel.app/apps/ship_info/data/wage.json`이 열리고 `#wage`, `#dir`가 실제 주소에서 동작하는지 확인(CSP 헤더 포함).
