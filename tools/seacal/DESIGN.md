---
name: 바다생활 계산기
description: 해기사가 배 위 휴대폰으로 쓰는 복무완료·ETA 계산기
colors:
  paper: "#F1F7EE"
  surface: "#FBFEF9"
  ink: "#1D2A21"
  muted: "#56705E"
  rule: "#D2E4CE"
  soft: "#E4F0DF"
  pri: "#2D6A4C"
  pri-ink: "#FFFFFF"
  acc: "#2B744F"
  acc-bg: "#DAEFDF"
  sea: "#3F8F68"
  leave: "#8FCBA2"
  edu: "#C6E3AE"
  inj: "#6FB3A0"
  left: "#E8F1E4"
  ok: "#1E7A3C"
  ok-bg: "#E1F3E4"
  bad: "#B3261E"
  bad-bg: "#FBE6E1"
  warn: "#8A5A00"
  warn-bg: "#FCF0D6"
  paper-dark: "#160D13"
  surface-dark: "#20131C"
  ink-dark: "#F7E9F0"
  muted-dark: "#C7A3B6"
  rule-dark: "#3A2432"
  soft-dark: "#2A1924"
  pri-dark: "#F0A5C7"
  pri-ink-dark: "#2A0B1B"
  acc-dark: "#FF8DBE"
  acc-bg-dark: "#3A1A2C"
  sea-dark: "#E68BB5"
  leave-dark: "#B57898"
  edu-dark: "#8C5A76"
  inj-dark: "#D2A0BE"
  left-dark: "#2E1C28"
  ok-dark: "#8EDCA9"
  ok-bg-dark: "#15261C"
  bad-dark: "#FF928A"
  bad-bg-dark: "#34181D"
  warn-dark: "#F0C46A"
  warn-bg-dark: "#2C2416"
typography:
  display:
    fontFamily: "Nanum Gothic, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "clamp(32px, 6vw, 52px)"
    fontWeight: 800
    lineHeight: 1.2
  headline:
    fontFamily: "Nanum Gothic, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "clamp(22px, 4.5vw, 28px)"
    fontWeight: 800
    lineHeight: 1.3
  title:
    fontFamily: "Nanum Gothic, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.35
  body:
    fontFamily: "IBM Plex Sans KR, Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "IBM Plex Sans KR, Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "clamp(30px, 6vw, 40px)"
    fontWeight: 600
    lineHeight: 1.1
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  tag: "6px"
  field: "12px"
  tile: "14px"
  btn: "16px"
  card: "18px"
  btn-big: "20px"
  menu-card: "22px"
  dialog: "24px"
  pill: "999px"
spacing:
  gutter: "16px"
  gap-sm: "8px"
  gap: "12px"
  gap-lg: "14px"
  card-pad: "18px"
  section: "26px"
  container: "880px"
components:
  button-primary:
    backgroundColor: "{colors.pri}"
    textColor: "{colors.pri-ink}"
    rounded: "{rounded.btn}"
    padding: "12px 22px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.btn}"
    padding: "12px 22px"
  button-big:
    backgroundColor: "{colors.pri}"
    textColor: "{colors.pri-ink}"
    rounded: "{rounded.btn-big}"
    padding: "18px 40px"
  button-small:
    rounded: "{rounded.field}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "18px"
  menu-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.menu-card}"
    padding: "18px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "46px"
    padding: "0 12px"
  chip:
    backgroundColor: "{colors.acc-bg}"
    textColor: "{colors.acc}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  stat-tile:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.tile}"
    padding: "10px 12px"
  segmented:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.pill}"
    padding: "4px"
  segmented-on:
    backgroundColor: "{colors.pri}"
    textColor: "{colors.pri-ink}"
    rounded: "{rounded.pill}"
    padding: "9px 12px"
---

# Design System: 바다생활 계산기

## Overview

**Creative North Star: "조용한 선실 도구 (The Quiet Cabin Tool)"**

당직을 마치고 선실에서 휴대폰을 꺼내 쓰는, 손에 익은 도구. 화면은 조용하고 부드럽지만 손에 닿는 부분은 단단하다. 라이트는 초록 파스텔 종이, 다크는 그 보색인 분홍·자주 밤빛이다. 어느 쪽이든 색은 낮은 채도의 바탕 위에 진한 주색 하나가 버튼과 강조를 맡는다.

정보 밀도는 중간이다. 한 화면에 입력 묶음과 결과 묶음이 카드로 나뉘고, 결과 숫자는 고정폭 글꼴로 크게 보여 준다. 장식은 거의 없다. 둥근 모서리, 아래로 2px 떨어지는 버튼 그림자, 꼬리표(chip)와 법령 표기(law) 정도가 성격의 전부다. 디자인 규칙(모서리·버튼·글꼴)은 형제 앱인 해기사 시험 문제 풀이(cbttest)를 따르고, 색만 바꿨다.

**Key Characteristics:**
- 라이트 = 초록 파스텔, 다크 = 분홍·자주 보색. 테마는 시스템 설정을 따르고 상단 버튼으로 바꾸며 기기에 기억한다.
- 숫자·날짜·코드는 모두 IBM Plex Mono, 제목은 Nanum Gothic 800, 본문은 IBM Plex Sans KR.
- 평평한 카드와 1~1.5px 테두리, 그림자는 상태와 떠 있는 층에만.
- 누르는 것은 크고 단단하다: 46px 입력칸, 2px 아래 그림자가 있는 주 버튼, 누르면 1px 내려간다.

## Colors

낮은 채도의 종이색 바탕 위에 진한 주색 하나, 그리고 뜻이 정해진 상태색 세 쌍.

### Primary
- **선실 소나무 초록 / 밤 벚꽃 분홍** (`pri` / `pri-dark`): 주 버튼, 메뉴 카드 아이콘 칸, 켜진 세그먼트. 화면에서 가장 무거운 색이라 한 묶음에 하나만 쓴다.
- **잎새 초록 / 형광 분홍** (`acc` / `acc-dark`): 링크, 포커스 테두리, 섹션 제목 아이콘, 꼬리표 글자, 제목 강조(`em`). `acc-bg`는 그 옅은 바탕(꼬리표, 선택된 장소, 단계 번호).

### Neutral
- **파스텔 종이** (`paper`): 페이지 바탕, 입력칸 바탕, 카드 안 줄(vrow·pjc) 바탕.
- **흰 갑판** (`surface`): 카드·상단 막대·창 바탕.
- **먹** (`ink`) / **흐린 먹** (`muted`): 본문 / 라벨·보조 설명.
- **선** (`rule`): 모든 테두리와 구분선. **옅은 칸** (`soft`): 결과 칸(kv), 범례, 표 머리, 닫기 버튼.

### 자료 색 (복무 막대·범례 전용)
- `sea` 승선, `leave` 휴가, `edu` 군사교육소집, `inj` 업무상 휴직, `left` 남은 기간. 복무 결과 막대와 범례에서만 쓰고, 다른 뜻으로 빌려 쓰지 않는다.

### 상태 색
- `ok`/`ok-bg` 완료·연결됨, `bad`/`bad-bg` 오류·삭제, `warn`/`warn-bg` 주의·오프라인. 다크에서도 상태색은 초록·빨강·노랑 그대로 남는다(분홍으로 바꾸지 않는다).

### Named Rules
**The Complement Rule.** 다크 테마는 라이트의 보색이다. 새 색을 넣을 때는 라이트 초록 계열 값과 다크 분홍·자주 계열 값을 반드시 한 쌍으로 정의한다. 한쪽만 있는 색은 없다.

**The Fixed Meaning Rule.** 상태색(ok·bad·warn)과 자료 색(sea·leave·edu·inj)은 뜻이 고정이다. 장식이나 브랜드 강조에 쓰지 않는다.

## Typography

**Display Font:** Nanum Gothic 700/800 (Apple SD Gothic Neo, Malgun Gothic 대체)
**Body Font:** IBM Plex Sans KR 400–700 (system-ui 대체)
**Label/Mono Font:** IBM Plex Mono 400–600 (Menlo, Consolas 대체)

**Character:** 둥글고 두꺼운 나눔고딕 제목이 친근함을 맡고, 고정폭 Plex Mono가 숫자의 신뢰를 맡는다. 한국어 줄바꿈은 `word-break: keep-all`로 단어를 끊지 않는다.

### Hierarchy
- **Display** (800, clamp 32–52px, 1.2): 처음 화면 앱 이름 한 곳.
- **Headline** (800, clamp 22–28px): 계산기 화면 제목.
- **Title** (800, 19–20px): 섹션 제목(sec-t), 메뉴 카드 제목.
- **Body** (400, 15.5px, 1.65): 설명·도움말. 보조 문단은 14px muted.
- **Label** (600, 13px, muted): 입력칸 위 라벨, 결과 칸 이름(12.5px).
- **Figure** (Mono 600, clamp 30–40px, 1.1): 핵심 결과 숫자(남은 날, ETA). 단위는 16px muted `small`.
- **Data** (Mono 500–600, 15–22px): 입력값, 날짜, 결과 칸 값, 표 칸, 복구 코드.

### Named Rules
**The Numbers Are Mono Rule.** 사용자가 읽고 옮겨 적을 수 있는 모든 숫자·날짜·시각·코드는 IBM Plex Mono로 쓴다. 입력칸도 숫자를 받으면 Mono, 글(지명 검색·선택)을 받으면 본문 글꼴.

**The No Eyebrow Rule.** 제목 위에 작은 대문자 꼬리 글을 달지 않는다. 제목이 스스로 무게를 갖는다(2.3.3에서 `SEA SERVICE`를 뺐다).

## Layout

한 단 세로 흐름. 내용 폭 최대 880px, 좌우 여백 16px. 상단 막대는 56px 높이로 고정(sticky)되고 반투명 흐림 바탕에 safe-area를 더한다. 화면 주소는 해시(`#/`, `#/calc`, `#/eta`)로 바뀌고, 각 계산기는 [뒤로] 버튼과 제목, 입력 카드들, 결과 카드들, 도움말, 바닥글 순서다.

입력은 2열 그리드(gap 12px), 380px 이하에서 1열. 결과 칸(kv)과 범례는 2열, 560px 이하에서 범례 1열. 620px 이하에서 결과 링과 숫자가 세로로 가운데 정렬되고 카드 안쪽 여백이 15px로 줄며 연결 상태 글자가 점만 남는다. 520px 이하에서 상단 버전 표시가 숨고 바닥 가운데 버전만 남는다. 섹션 간격 26px, 카드 간격 14px. 인쇄할 때는 상단 막대·바닥글·편집 버튼·백업 카드를 숨긴다.

## Elevation & Depth

평평함이 기본이다. 카드·입력칸·줄은 1~1.5px `rule` 테두리와 `paper`/`surface`/`soft` 바탕 차이로만 층을 나눈다. 그림자는 상태나 떠 있는 층에서만 나타난다.

### Shadow Vocabulary
- **떠오름** (`--shadow`, 라이트 `0 1px 2px rgba(30,70,40,.06), 0 10px 28px rgba(30,70,40,.10)` / 다크 더 진한 검정): 메뉴 카드 호버, 창(dlg), 시간대 목록, 토스트.
- **누름 턱** (`0 2px 0 color-mix(in srgb, var(--pri) 55%, #000)`): 주 버튼, 메뉴 아이콘 칸, 켜진 세그먼트. 그림자가 아니라 버튼의 두께다.
- **흐린 막** (`--scrim` + `backdrop-filter: blur(3px)`): 창 뒤 배경.

### Named Rules
**The Flat-By-Default Rule.** 평소에 떠 있는 카드는 없다. `--shadow`는 호버·창·목록·토스트에만 쓴다.

## Shapes

모든 모서리가 둥글고, 크기가 클수록 반지름도 커진다: 법령 꼬리 6px → 입력칸·작은 버튼 12px → 결과 칸 14px → 버튼·줄 16px → 카드 18px → 큰 버튼 20px → 메뉴 카드 22px → 창 24px. 꼬리표·연결 상태·세그먼트·단계 번호는 완전한 알약형(999px). 각진 모서리는 쓰지 않는다. 테두리는 정보 카드 1px, 누르거나 입력하는 것 1.5px. 점선은 '준비 중' 카드와 접는 영역 구분선에만 쓴다.

## Components

손에 닿는 것은 크고 단단하게, 나머지는 조용하게.

### Buttons
- **Shape:** 둥근 사각(16px), 큰 버튼 20px, 작은 버튼 12px.
- **Primary:** `pri` 바탕, `pri-ink` 글자, 600, 12px 22px. 아래 2px 누름 턱.
- **Hover / Focus / Active:** 호버 밝기 1.1, 누르면 1px 내려감(.15s). 포커스는 2px `acc` 외곽선, 2px 띄움.
- **Ghost:** `surface` 바탕, 1.5px 진한 테두리, 호버 시 테두리 `ink`·바탕 `soft`.
- **Icon button:** 38px 정사각, 12px 모서리, 테두리 있음. 줄 삭제(xbtn)는 36px, 호버 시 `bad` 색.

### Chips
- **Style:** 알약형, 12.5px 600, `acc-bg`/`acc`. 상태 변형 `ok`·`bad`·`warn`은 각 bg/글자 쌍.
- **법령 꼬리(law):** 6px 모서리, Mono 12.5px, `acc-bg`/`acc`. 선원법·병역법 조문을 본문 안에 표시.

### Cards / Containers
- **Corner Style:** 18px.
- **Background:** `surface`, 안쪽 줄(vrow·pjc·pitem)은 `paper`.
- **Shadow Strategy:** 없음(Flat-By-Default).
- **Border:** 1px `rule`, 안쪽 줄은 1.5px.
- **Internal Padding:** 18px(휴대폰 15px).
- **알림(note):** 14px 모서리, 왼쪽 4px 상태색 띠, 옅은 상태 바탕. 기본 warn, `okn`·`badn` 변형.

### Inputs / Fields
- **Style:** 높이 46px, 1.5px `rule`, 12px 모서리, `paper` 바탕, Mono 15px.
- **Focus:** 테두리 `acc`, 바탕 `surface`로 밝아짐. 외곽선은 그리지 않는다.
- **Error:** 테두리 `bad`, 바탕 `bad-bg`, 아래 13.5px `bad` 600 문구.

### Navigation
- **상단 막대:** 왼쪽 배 아이콘(28px, `acc`)+앱 이름(Nanum 800 17px), 오른쪽에 연결 상태 알약(초록 점/오프라인 노랑 점), 테마 버튼, 버전(Mono 알약), bypass 로고(30px). 버전은 bypass 로고 왼쪽.
- **화면 이동:** 처음 화면 메뉴 카드 → 계산기, 계산기 안 [뒤로] 알약 버튼.
- **바닥글:** 주의 문구 13px muted, 가운데 Mono 버전. 버전을 5번 누르면 이스터에그.

### Menu Card (signature)
처음 화면의 큰 선택지. 22px 모서리, 1.5px 테두리, 56px `pri` 아이콘 칸(16px 모서리, 누름 턱), 제목 20px + muted 설명, 오른쪽 화살표. 호버 시 테두리 `acc`+떠오름 그림자. 준비 중 카드는 점선·흐림 0.6·아이콘 회색.

### Result Figure (signature)
복무 결과: 150px 진행 링(가운데 Mono 퍼센트) + 큰 Mono 숫자 + 2열 결과 칸(`soft`, 14px). 그 아래 16px 알약 막대를 자료 색으로 나누고 범례를 붙인다. 완료되면 `ok-bg` 띠에 체크 아이콘. ETA 결과는 `soft` 바탕 큰 칸(eta-big)에 Figure 숫자.

### Segmented Switch
`soft` 알약 트랙 안 두 버튼, 켜진 쪽은 `pri` 바탕+누름 턱. ETA의 출항 기준 / 현재 선박 시간 전환.

### Easter Egg
테마와 상관없이 흰 카드(#FFFFFF), 14px 모서리, 튀어나오는 애니메이션(.35s, reduced-motion에서 끔). 패치노트(초록 #2D6A4C)·공휴일 보기(분홍 #B8517A) 두 버튼. 형제 앱 cbttest와 같은 모양.

## Do's and Don'ts

### Do:
- **Do** 새 색은 라이트 초록·다크 분홍 한 쌍으로 `:root`와 `:root[data-theme="dark"]`에 함께 정의한다.
- **Do** 사용자가 읽고 옮기는 숫자·날짜·시각·코드는 IBM Plex Mono로 쓴다.
- **Do** 누르는 것은 크게: 입력칸 46px, 아이콘 버튼 36~38px 이상, 상단 알약 34px 이상, [처음] 버튼 40px, 주 버튼에는 2px 누름 턱.
- **Do** 글자 대비는 두 테마 모두 4.5:1 이상. 라이트 `acc`는 `acc-bg` 위에서도 4.5:1을 넘도록 #2B744F로 맞췄다. 입력칸 안내 글자는 `muted`.
- **Do** 입력칸에는 반드시 연결된 `<label for>`나 `aria-label`을 붙이고, 잠깐 뜨는 알림은 `#srLive` 상태 영역으로도 읽힌다.
- **Do** 기존 클래스(`.btn`, `.card`, `.inp`, `.chip`, `.note`, `.kv`, `.seg2`)를 다시 쓴다. 새 계산기도 복무완료 계산기와 같은 부품으로 만든다.
- **Do** 법령·규정 근거는 `law` 꼬리로, 한계·가정은 `note`로 화면에 보여 준다.
- **Do** 640px 이하 휴대폰과 safe-area(노치, 홈 막대)를 기준으로 먼저 확인한다.

### Don't:
- **Don't** 카드에 평소 그림자를 주지 않는다. 그림자는 호버·창·목록·토스트뿐이다.
- **Don't** 각진 모서리나 1px보다 얇은 테두리를 쓰지 않는다.
- **Don't** 상태색·자료 색을 장식이나 강조에 빌려 쓰지 않는다.
- **Don't** 다크 테마 상태색(초록·빨강·노랑)을 분홍 계열로 바꾸지 않는다.
- **Don't** 이스터에그 카드에 테마 색을 적용하지 않는다. 흰 카드로 고정이다.
