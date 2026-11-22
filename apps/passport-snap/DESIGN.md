---
name: 여권스냅
description: 매일 20분 여행 언어 루틴이 그대로 현지 회화 치트시트가 되는 학습 도구
colors:
  paper: "#f8f7f4"
  surface: "#ffffff"
  surface-sunk: "#f2f0eb"
  ink: "#2d3436"
  ink-muted: "#5f6663"
  rule: "#e6e2da"
  rule-strong: "#d4cfc4"
  sage: "#7fb685"
  sage-dark: "#3e7046"
  sage-soft: "#e6f4e8"
  sage-border: "#b8dec0"
  sky: "#74b3d8"
  sky-dark: "#36698a"
  sky-soft: "#ebf5fb"
  sky-border: "#c5e2f3"
  sky-hover: "#dceefa"
  apricot: "#e8a86b"
  apricot-dark: "#8a5a2b"
  apricot-soft: "#fdf3e7"
  apricot-border: "#f3d9b8"
  rose: "#df7b7b"
  rose-dark: "#8f3c3c"
  rose-soft: "#fae5e5"
  rose-border: "#ebbaba"
  lavender: "#a393c9"
  lavender-dark: "#5f4f8c"
  lavender-soft: "#f3f0fa"
  lavender-border: "#d9d1ec"
  cta: "#4a8051"
  cta-hover: "#42744a"
  cta-edge: "#2f5a35"
  danger: "#b04f4f"
  danger-hover: "#a14646"
  danger-edge: "#853535"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif"
    fontSize: "clamp(22px, 2.5vw, 27px)"
    fontWeight: 800
    lineHeight: 1.32
    letterSpacing: "-0.02em"
  showcard:
    fontFamily: "Hiragino Sans, Yu Gothic, Noto Sans JP, PingFang SC, Noto Sans SC, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.22
    letterSpacing: "-0.01em"
  headline:
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.35
  target:
    fontFamily: "Hiragino Sans, Yu Gothic, Noto Sans JP, PingFang SC, Noto Sans SC, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.35
  glyph-xl:
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 1.2
  glyph-lg:
    fontSize: "38px"
    fontWeight: 800
    lineHeight: 1.25
  glyph:
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.2
  title:
    fontSize: "17.5px"
    fontWeight: 800
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontSize: "12.5px"
    fontWeight: 700
  micro:
    fontSize: "11.5px"
    fontWeight: 700
rounded:
  micro: "6px"
  tag: "7px"
  thumb: "8px"
  mark: "9px"
  control-sm: "10px"
  tab: "11px"
  control: "12px"
  field: "13px"
  panel: "14px"
  item: "15px"
  card-sm: "16px"
  card: "18px"
  dialog: "22px"
  pill: "999px"
spacing:
  gutter-mobile: "16px"
  gutter: "24px"
  gap-tight: "6px"
  gap: "12px"
  gap-loose: "22px"
  card-pad: "16px"
  card-pad-lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.cta-hover}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-outline-hover:
    backgroundColor: "{colors.surface-sunk}"
  button-soft-sky:
    backgroundColor: "{colors.sky-soft}"
    textColor: "{colors.sky-dark}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  chip:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "7px 13px"
    typography: "{typography.label}"
  chip-active:
    backgroundColor: "{colors.sky-soft}"
    textColor: "{colors.sky-dark}"
  nav-tab-active:
    backgroundColor: "{colors.sky-soft}"
    textColor: "{colors.sky-dark}"
    rounded: "11px"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "20px"
  phrase-item:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.item}"
    padding: "15px 16px"
  search-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "13px"
    padding: "10px 15px"
  badge-sage:
    backgroundColor: "{colors.sage-soft}"
    textColor: "{colors.sage-dark}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
    typography: "{typography.micro}"
---

# Design System: 여권스냅

## Overview

**Creative North Star: "The Travel Notebook"**

여권스냅은 여행자가 매일 펼쳐 보는 개인 수첩이다. 따뜻한 미색 종이(paper) 위에 흰 페이지 카드가 놓이고, 다섯 가지 파스텔 색이 수첩의 인덱스 탭처럼 섹션과 상태를 나눈다. 출발 전에는 하루치 공부를 적어 둔 노트가 되고, 현지에서는 같은 페이지를 상대에게 내밀어 보여 주는 도구가 된다. 화면이 조용하고 정돈되어 있어야 원문 문장이 가장 크게 보인다.

밀도는 중간이다. 넓은 화면에서는 본문 칸과 316px 오른쪽 칸(타이머·현지 제원·오늘의 한마디·통계)이 나란히 놓이고, 휴대폰에서는 한 칸으로 쌓이고 아래 탭 바로 이동한다. 부품은 말랑하고 만지고 싶은 느낌이다. 모서리는 두툼하게 둥글고, 주요 버튼은 아래쪽 진한 테두리 덕분에 실제로 눌리는 느낌이 난다.

**Key Characteristics:**
- 따뜻한 미색 종이 바탕 + 흰 카드 + 1.5px 연한 테두리
- 파스텔 다섯 색은 각각 soft(배경)·border(테두리)·base(채움)·dark(글자) 네 단계로만 쓴다
- 원문(일본어·중국어)은 언제나 화면에서 가장 크고 굵은 글자
- 그림자는 거의 없고, 입체감은 누를 수 있는 것에만 준다
- 웹폰트 없이 OS 기본 한글·일본어·중국어 글꼴을 `:lang()`으로 나눠 쓴다

## Colors

따뜻한 종이색 중립 위에 채도를 낮춘 파스텔 다섯 색이 인덱스 탭처럼 의미를 나눈다.

### Primary
- **Notebook Green** (cta): 하루 학습 시작·학습 시작처럼 "지금 할 일" 하나에만 쓰는 채운 버튼 색. 흰 글자와 대비가 충분하도록 세이지보다 진하다. 눌림 테두리는 cta-edge.
- **Sage** (sage 계열): 완료·정답·진행. 진행 막대, 켜진 토글, 완료한 강의 카드, 선택된 문자 칸, 모바일 탭 바의 현재 탭.

### Secondary
- **Sky** (sky 계열): 탐색과 학습 정보. 현재 상단 탭, 선택된 칩, DAY 태그, 입력창 포커스, 한글 발음 줄(`--pron-ink` = sky-dark), 포커스 링.

### Tertiary
- **Apricot** (apricot 계열): 현지 제원 노트·팁 카드처럼 "알아 두면 좋은 정보".
- **Rose** (rose 계열): 오답·오답노트 개수·틀림 표시. 위험 동작 버튼은 더 진한 danger를 쓴다.
- **Lavender** (lavender 계열): 도움말과 문자 익히기의 하위 탭, 퀴즈의 상황 설명 상자.

### Neutral
- **Notebook Paper** (paper): 페이지 바탕. 상단 바·하단 탭 바는 이 색을 95~97% 불투명도로 깔고 흐림을 준다.
- **Page White** (surface): 카드·목록 항목·입력창·대화상자.
- **Sunk Paper** (surface-sunk): 토글 바탕, 팁 상자, 연락처 줄처럼 카드 안에 한 단계 들어간 면.
- **Graphite Ink** (ink): 본문과 제목 글자.
- **Pencil Gray** (ink-muted, `--text-muted`): 설명문·가나/병음·로마자·꺼진 탭 글자. 종이·들어간 면·파스텔 soft 어느 바탕에서도 4.5:1 이상.
- **Pencil Rule** (rule) / **Strong Rule** (rule-strong): 기본 테두리와 hover·꺼진 토글 테두리.

### Named Rules
**The Four-Step Tab Rule.** 파스텔 색은 soft·border·base·dark 네 단계로만 쓴다. 배경은 soft, 테두리는 border, 채움 막대·점은 base, 그 위의 글자는 dark. 파스텔 base 위에 흰 글자를 올리지 않는다.

**The One Green Button Rule.** 채운 초록(cta) 버튼은 그 화면에서 "다음에 할 일"에만 쓴다. 보조 동작은 outline이나 soft 버튼이다.

**The Pencil Gray Rule.** 보조 글자는 Pencil Gray 한 가지만 쓴다. 더 흐린 회색을 만들지 않는다. 연한 rule·rule-strong 바탕 위에는 보조 글자를 올리지 않는다(대비 부족).

## Typography

**Display Font:** 시스템 한글 글꼴 (Apple SD Gothic Neo / Malgun Gothic / Noto Sans KR)
**Body Font:** 같은 시스템 한글 글꼴
**Target-language Font:** 일본어는 Hiragino Sans·Yu Gothic·Noto Sans JP, 중국어는 PingFang SC·Microsoft YaHei·Noto Sans SC (`:lang(ja)`, `:lang(zh)`로 자동 전환)

**Character:** 웹폰트 없이 각 OS의 기본 글꼴을 쓴다. 굵기 차이(400 / 700 / 800)로 위계를 세우고, 원문은 언제나 800 굵기다.

### Hierarchy
- **Showcard** (800, 44px 기본·`--sc-size`로 조절, 1.22): "크게 보기"에서 상대에게 보여 주는 원문. 화면에서 가장 큰 글자.
- **Display** (800, clamp(22px, 2.5vw, 27px), 1.32, -0.02em): 홈의 "오늘 학습" 제목.
- **Headline / Target** (800, 21px, 1.35): 화면·섹션 제목, 목록 속 원문 문장.
- **Title** (800, 17.5px): 카드와 항목 제목, 브랜드 이름.
- **Body** (400~700, 16px, 1.65): 뜻·본문. 뜻은 700으로 강조한다.
- **Small** (400~700, 14px, 1.6): 보조 설명, 버튼, 한글 발음(700, sky-dark).
- **Glyph** (800, 28px / 38px / 56px — `--fs-glyph`, `--fs-glyph-lg`, `--fs-glyph-xl`): 타이머 숫자·가나 칸·한자 카드(28), 문자 상세·학습 카드 원문 상한(38), 문자 퀴즈 문제(56). 이 세 단계 밖의 큰 글자를 새로 만들지 않는다.
- **Label** (700, 12.5px): 칩·작은 버튼·필드 라벨.
- **Micro** (700~800, 11.5px): 배지, 개수, 로마자.

### Named Rules
**The Source-First Rule.** 원문이 위, 그 아래 가나/병음(muted), 한글 발음(sky-dark 700), 뜻(700) 순서로 쌓는다. 이 순서와 크기 차이를 바꾸지 않는다.

**The Keep-All Rule.** 한국어는 `word-break: keep-all`로 어절 단위로 줄을 바꾼다. 크게 보기와 학습 카드의 일본어·중국어 원문은 `segmentedHTML()`(Intl.Segmenter)로 단어 사이에 `<wbr>`를 넣고 `word-break: keep-all; line-break: strict`로 둬서 단어 중간에서 끊기지 않게 한다. 목록 원문은 `word-break: normal; line-break: strict`. 제목은 `text-wrap: balance`, 문단은 `pretty`.

## Layout

최대 폭 1180px 컨테이너, 좌우 여백 24px(640px 이하 16px). 홈은 본문 + 316px 사이드 칸 두 열(간격 22px)이고, 사이드 칸은 상단 바 아래 76px에 붙어 따라온다. 960px 이하에서 한 열로 바뀌고 사이드 칸은 2열 그리드, 640px 이하에서 1열이 된다. 강의 카드는 2열(600px 이하 1열), 문자표는 5열 고정, 한자 카드는 최소 215px 자동 채움이다.

640px 이하에서는 상단 탭과 XP 표시가 사라지고 아래에 다섯 칸 탭 바가 고정된다(안전 영역 여백 포함). 이때 본문 아래 여백은 100px + 안전 영역이다. 터치 기기(`pointer: coarse`)에서는 모든 누르는 요소가 최소 44px이다. 간격은 6 / 8 / 10 / 12 / 14 / 16 / 20 / 22px를 쓴다.

## Elevation & Depth

평평한 종이 수첩이다. 면은 1.5px 테두리와 바탕 단계(paper → surface → surface-sunk)로 나누고, 그림자는 카드에 거의 보이지 않는 한 겹(`0 4px 16px rgba(45,52,54,0.04)`)만 쓴다. 입체감은 누를 수 있는 것에만 준다. 주요 버튼과 위험 버튼은 아래쪽에 3px 진한 테두리(`box-shadow: 0 3px 0`)가 있다가 누르면 2px 내려가며 1px로 줄고, 퀴즈 답 버튼은 2px rule 테두리를 깐다.

### Shadow Vocabulary
- **Paper Lift** (`0 4px 16px rgba(45, 52, 54, 0.04)`): 카드·hero·hover한 강의 카드.
- **Press Edge** (`0 3px 0 var(--cta-edge)` / `var(--danger-edge)`): 채운 버튼의 눌림 받침. 누르면 `0 1px 0`.
- **Toggle Thumb** (`0 1px 3px rgba(45, 52, 54, 0.08)`): 세그먼트 토글에서 선택된 칸.
- **Dropdown** (`0 12px 28px rgba(45, 52, 54, 0.12)`): 언어 선택 메뉴.
- **Dialog** (`0 20px 50px rgba(45, 52, 54, 0.18)`): 크게 보기·도움말·확인 대화상자.

### Named Rules
**The Press-Only Depth Rule.** 진한 받침 테두리는 누를 수 있는 채운 버튼에만 붙인다. 카드나 정보 상자에는 쓰지 않는다.

## Shapes

모서리는 두툼하게 둥글다. 크기가 커질수록 반경도 커진다: 태그 6~7px, 작은 조작 요소 8~11px, 버튼·입력 12~13px, 목록 항목 15px, 작은 카드 16px, 큰 카드 18px, 대화상자 22px. 배지·칩·진행 막대·토글은 완전히 둥근 알약(999px)이다. 테두리는 기본 1.5px, 배지와 안쪽 상자는 1px, 퀴즈 결과 표시는 2px이다. 모바일의 크게 보기는 모서리 없이 화면 전체를 채운다.

## Components

### Buttons
말랑하고 눌러 보고 싶은 버튼.
- **Shape:** 둥근 모서리(12px), 작은 버튼 10px, 아이콘 버튼 34px 정사각(터치 44px).
- **Primary:** Notebook Green 채움, 흰 글자 700, 16px, 아래 Press Edge. hover에서 cta-hover.
- **Danger (btn-rose):** danger 채움, 흰 글자, 같은 눌림 받침. 진도·데이터를 버리는 확인에만 쓴다.
- **Outline:** 흰 바탕, 1.5px rule 테두리, hover에서 surface-sunk.
- **Soft Sky (btn-blue):** sky-soft 바탕, sky-dark 글자, sky-border 테두리. 퀴즈·보조 학습 동작.
- **Active:** 2px 아래로 이동. 동작 줄이기 설정에서는 이동하지 않는다. 비활성은 45% 불투명도.
- **Focus:** 2px sky-dark 외곽선, 2px 띄움.

### Chips & Badges
- **Chip:** 흰 바탕 알약, 1.5px 테두리, 12.5px 700. 선택되면 sky-soft·sky-dark·sky 테두리. 가로로 스크롤되는 한 줄.
- **Badge:** 알약, 11.5px 700, 파스텔 soft 바탕 + dark 글자 + border 1px. 색은 의미대로(green 완료, blue 정보, amber 팁, rose 오답, purple 도움, gray 중립).

### Cards / Containers
- **Corner Style:** 16~18px.
- **Background:** surface. 완료한 강의 카드는 sage-border 테두리와 아주 연한 초록 흰색(#fafdfb), 팁 카드는 apricot-soft.
- **Shadow Strategy:** Paper Lift 한 겹, 또는 없음.
- **Border:** 1.5px rule. hover 가능한 카드는 sky 테두리로 바뀌며 2px 떠오른다(터치 기기와 동작 줄이기에서는 떠오르지 않음).
- **Internal Padding:** 15~16px, 큰 카드 20~24px.

### Inputs / Fields
- **Style:** 흰 바탕, 1.5px rule 테두리, 13px 모서리, 16px 글자(휴대폰 자동 확대 방지).
- **Focus:** 테두리 sky, 바깥에 3px sky-soft 링.

### Navigation
- **Top bar:** paper 95% + 흐림, 아래 1.5px 테두리, 위에 붙어 있음. 왼쪽 브랜드(여 글자 마크 + 여권스냅), 가운데 텍스트 탭, 오른쪽 도움말·XP·언어 선택.
- **Tabs:** 14px 700 글자. 현재 탭은 sky-soft 바탕 + sky-dark 글자.
- **Mobile tab bar:** 다섯 칸, 아이콘 위 11.5px 라벨. 현재 탭은 아이콘 뒤에 sage-soft 알약과 sage-dark 아이콘. 오답 개수는 rose-dark 동그라미.

### Segmented Toggle
코스(7일/14일), 타이머(20분/스톱워치), 목소리 선택에 쓴다. surface-sunk 홈 안에서 선택된 칸만 흰색 + Toggle Thumb 그림자로 올라온다.

### Phrase Item (signature)
치트시트 문장 한 줄. 흰 카드(15px) 안에 Source-First 순서로 원문 21px → 가나/병음 → 한글 발음 → 뜻 → surface-sunk 팁 상자. 오른쪽에 듣기·크게 보기·복사 아이콘 버튼. 640px 이하에서 버튼이 아래로 내려간다.

### Showcard (signature)
현지에서 상대에게 보여 주는 크게 보기. 데스크톱은 22px 모서리 대화상자(최대 760px), 휴대폰은 화면 전체. 원문이 가운데 가장 크게, 그 아래 가나/병음. 아래쪽 surface-sunk 상자에 "내가 보는 정보"(한글 발음·뜻·팁), 그 아래 54px 높이의 두 동작 버튼과 46px 보조 버튼 두 개.

### Quiz Footer
퀴즈 화면 아래 판정 띠. 맞으면 sage-soft 바탕 + 2.5px sage 윗선, 틀리면 rose-soft + rose 윗선. 답 버튼은 맞음 sage-dark 2px, 틀림 rose-dark 2px 테두리.

## Do's and Don'ts

### Do:
- **Do** 파스텔 색을 Four-Step Tab Rule(soft·border·base·dark)대로만 쓴다.
- **Do** 원문을 그 화면에서 가장 크고 굵게(800) 두고, 그 아래 한글 발음을 sky-dark 700으로 둔다.
- **Do** 터치 기기에서 누르는 요소를 최소 44px로 만든다.
- **Do** 동작 줄이기 설정에서는 이동을 빼고 색과 투명도 변화만 남긴다.
- **Do** 새 언어를 넣을 때는 `:lang()` 글꼴 스택을 추가하고, 원문 줄바꿈은 `line-break: strict`로 둔다.

### Don't:
- **Don't** 채운 초록 버튼을 한 화면에 여러 의미로 쓰지 않는다. "지금 할 일" 하나만 채운다.
- **Don't** 카드나 정보 상자에 눌림 받침(Press Edge)이나 진한 그림자를 주지 않는다.
- **Don't** 파스텔 base 색 위에 흰 글자를 올리지 않는다. 흰 글자는 cta와 danger 위에만 쓴다.
- **Don't** Pencil Gray보다 흐린 회색 글자를 새로 만들지 않는다.
- **Don't** 화면 확대를 막지 않는다(`user-scalable=no`, `maximum-scale` 금지).
