# BYPASS 사이트 — 작업 안내 (Claude용)

이 파일은 이 저장소에서 일하는 Claude(코드 창·앱 어디서든)가 처음에 읽는 안내입니다.
사람이 읽어도 됩니다. **비밀 값(토큰·비밀번호)은 절대 이 파일에 쓰지 마세요.** 이 저장소는 사이트로 그대로 배포됩니다.

## 무엇인가
- 국립목포해양대학교 바이브 코딩 **크루** BYPASS의 사이트: https://teambypass.vercel.app
- 슬로건: "느린 시스템의 실용적 대안 마련국". 학교생활의 불필요한 절차를 AI와 코드로 건너뛴다.
- 저장소: `sojihwanso/bypass` (주인 sojihwanso, 협업자 Kevif). Vercel이 `main`을 자동 배포.
- 정적 HTML + 바닐라 JS (빌드 없음) + Supabase(로그인·데이터베이스·저장소·Edge Function).

## 말투·용어 (중요, 진지하게 지킬 것)
- 사용자와는 **한국어**로, 쉬운 말로. 영어로 답하지 않는다.
- **'동아리' 금지 → '크루'.** 정식 동아리도 행정기관도 아니다. **'부원' 금지 → '국원'.**
- 회원 구분: 일반 회원(general) · 국원(member) · 운영진(staff). `auth.users.app_metadata.bypass_role` 로 정한다.
- 사이트 말투는 관공서 흉내("본 국", "공고", "제0-1호", "심의", "~하십시오"). 진지한 것은 말투뿐.
- 페이지 이름: `/routes/` = **준공 현황** (예전 '개통 노선도'), `/dockets/` = **처리 현황**, `/site/` = **공사장**(회원 구역), `/hq/` = **HQ**(운영진 관리).
- 준공 현황의 분류는 **○○ 허브** (학업 허브, 생활 허브, 과목 자료 허브).
- 안건 상태: 공사 중 / 완료(도도새 직인) / **신설 준공**(인장) / 반려. 안내판 딱지는 **준공**.
- '지름길'은 BYPASS 이름 자체의 비유라 남겨 둔 곳이 있다: 메인 첫 화면 도로 그림, "민원 대신, 지름길을 만듭니다", "지름길 바로가기" 버튼, HQ 안의 항목 이름.
- 아직 정하지 않음: 준공 현황 페이지 각 항목 상태 '개통 / 공사 중'을 '준공 / 공사 중'으로 바꿀지.

## 폴더
- `index.html` 메인 · `routes/` 준공 현황 · `dockets/` 처리 현황 · `site/` 공사장 · `hq/` HQ · `login/` · `join/`
- `wiki/<이름>/` 과목 위키, `apps/<이름>/` 올린 HTML 앱, `tools/alfa-to-zulu/` 음성 알파벳 게임
  - 위키·앱은 HQ에서 HTML 파일로 올리면 Edge Function이 GitHub에 커밋한다 (커밋 작성자 이름이 올린 사람).
  - `vercel.json` 이 `/wiki/`·`/apps/` 를 CSP **sandbox** 로 연다 → 올린 HTML이 사이트 로그인 정보에 접근 못 함. **이 보안 설정을 풀지 말 것.** (대신 그 안에서는 localStorage 못 씀)
- `assets/` 공용: `bypass.css`, `auth.js`(Supabase 클라이언트 `B.sb`), `dockets.js/css`, `route-icons.js`, `routes.json`(준공 현황 예비 목록), `site-status.js`, `site-texts.js`, `track.js`(방문 기록, 개인정보 없음), `vendor/supabase-js-*.js`
- 링크 미리보기 그림: `assets/og-bypass-crew.png`. **카카오는 그림을 주소별로 오래 저장**하므로 그림을 바꿀 땐 파일 이름을 바꾸고, 카카오 공유 디버거에서 각 페이지 주소를 캐시 초기화.

## Supabase
- 프로젝트 ref `itzdjdgjqcpmxdfssfel` (주인 Kevif). 공개 키(publishable)는 `assets/auth.js` 에 있음 — 공개해도 되는 키.
- `supabase/NNN_이름.sql` : 번호 순서대로 **사용자가 SQL Editor에 붙여 넣고 Run** 한다. Claude가 직접 실행하지 않는다.
  - 새 파일은 **다음 번호(022부터)**. 맨 위에 "무엇을 바꾸는지 + 여러 번 실행해도 안전합니다" 주석.
  - 여러 번 실행해도 안전하게 (`if not exists`, `drop policy if exists` …). RLS 켜고, 권한은 `public.bypass_role()` 로 확인.
  - PR 설명에 "머지 후 실행할 SQL"을 꼭 적고, 사용자에게도 알려 준다.
- Edge Functions (`supabase/functions/`): `publish-wiki`(위키·앱 HTML 올리기, `folder` = wiki|apps, 5MB, 운영진만), `publish-meta`(HQ 링크 미리보기 태그 고치기).
  - 사용자가 대시보드 Edge Functions → 함수 → Code 에 `index.ts` 를 붙여 넣고 Deploy 한다. 함수를 고치면 이 안내를 꼭 함께 준다.
  - 비밀 값 `GITHUB_TOKEN` 은 Supabase Secrets 에만. **채팅·카톡·이 저장소에 토큰을 붙여 넣게 하지 말 것.**

## 작업 방식
- `main` 에서 새 브랜치 → 커밋 → push → **PR** → 사용자가 머지. main에 직접 push 하지 않는다.
- 한 PR은 한 주제. 여러 개를 고칠 땐 한 브랜치에 모았다가 PR 하나로 내도 된다.
- 같이 작업하는 사람이 있으니 시작할 때 `git fetch` 로 main을 먼저 받는다. `hq/index.html`·`site/index.html` 은 크고 자주 바뀌어 충돌이 잘 난다.
- 배포는 보통 1~2분, 몰리면 10분 넘게 걸리기도 한다(대기열). 브랜치 미리보기: `https://bypass-git-<브랜치>-oojoo1.vercel.app`
- 화면을 바꾸면 PC(1280px)와 휴대폰(390px) 둘 다 확인. 휴대폰에서 많이 쓴다 (아이폰 홈 바 여백, 글자 잘림).
- 사용자에게 결과를 말할 땐 짧게: 무엇이 바뀌었는지, 머지 후 할 일(SQL·함수 Deploy), 확인한 것.

## 지난 결정 (다시 묻지 않도록)
- 비밀번호: 가입 시 비밀번호 확인 칸 있음. 운영진이 임시 비밀번호를 발급할 수 있음(사용자가 다시 넣어 달라고 함).
- 문의 창구: 카카오톡 오픈채팅 https://open.kakao.com/o/snJ3HuTi
- FAQ 문구: "아닙니다. 행정기관도, 정식 동아리도 아닌 그냥 크루입니다."
- 푸터: "본 사이트는 BYPASS 크루가 운영하며, 국립목포해양대학교 행정 부서 및 정부 기관과 무관합니다."
- 공사장은 탭으로 나뉨(PC 왼쪽, 휴대폰 아래 탭바). 관리 기능은 점점 HQ로 옮기는 중.
