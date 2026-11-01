# SMCP 무전 교신 훈련소

주소: `/tools/smcp/`

| 주소 | 파일 | 내용 |
|---|---|---|
| `/tools/smcp/` | `index.html` | 입구: 연습실과 실전 교신 중 고르기 |
| `/tools/smcp/practice/` | `practice/index.html` | **연습실**: 문장을 보고·듣고·따라 말하기. 힌트(빈칸/전체), 바로 채점표 |
| `/tools/smcp/radio/` | `radio/index.html` | **실전 교신**: 무전기(전원·채널·송화기)로 교신, 끝나면 무선 일지로 평가 |
| | `scenarios.js` | 문제(시나리오) 전부. **연습실과 실전 교신이 같이 씀. 문제를 고칠 때는 이것만** |
| | `engine.js` | 공통 엔진: 채점, 읽어 주기·무전 잡음, 음성인식, 기록 저장 |
| | `fonts/` | 무전기 LCD 글꼴 DSEG (OFL-1.1) |

`?s=시나리오id`를 붙이면 그 시나리오로 바로 열려요. 예: `/tools/smcp/radio/?s=s-arrival`

## 실전 교신 규칙

- 무전기는 CH 16에서 켜져요. 지시서의 채널로 직접 맞춰야 상대가 들어요. 다른 채널로 송신하면 응답이 없고, 1번마다 5점이 깎여요(최대 20점).
- CH 70은 DSC 전용이라 음성 송신이 막혀 있어요.
- 70점이 안 되면 상대가 `retry` 문장으로 되물어요. 3번까지 기회가 있어요.
- 상대 말을 못 알아들었으면 "Say again"이라고 송신하면 감점 없이 다시 말해 줘요.
- 받은 말은 기본으로 가려져 있어요. "받은 말 글자로 보기"를 켜면 보여요.
- 상대가 `All stations`인 시나리오(SECURITE)는 방송이라 답이 오지 않아요.

## 상대 목소리 (녹음)

상대(VTS·도선사·선박) 말과 연습실의 표준 예시는 **미리 녹음한 고품질 음성 파일**로 나와요(`voice/audio/`).
어느 기기에서든 같은 발음이 나오고, 무전기 음질이 입혀져 있어요.

- 상대마다 목소리가 달라요. `scenarios.js` 위쪽 `voices`에서 바꿀 수 있어요.
- **대사를 고치거나 새 시나리오를 넣으면 녹음을 다시 만들어야 해요.** 안 만들어도 동작은 하고, 그 대사만 브라우저 기본 목소리로 읽어요.
- 녹음 만들기: `python3 tools/smcp/voice/build.py` (준비 방법은 `voice/build.py` 맨 위에 있어요. 이미 있는 녹음은 건너뛰어서 금방 끝나요.)
- 녹음 엔진: Kokoro TTS (Apache-2.0, 컴퓨터에서 직접 돌림, 비용 없음)

## 섹터

| 섹터 | 이름 | 내용 |
|---|---|---|
| 1 | 기초 훈련 | Alfa to Zulu(`/tools/alfa-to-zulu/`)로 연결만 함 |
| 2 | 표준 절차 | 한 문장짜리 교신 (턴 1개) |
| 3 | 상황 교신 | 여러 턴이 이어지는 교신 |
| 4 | 비상 교신 | 3과 같은 구조 + `timeLimit`(초) |

## 시나리오 추가하는 법

`scenarios.js`의 `scenarios: [ ... ]` 안에 아래 덩어리를 하나 복사해서 붙이고 내용을 바꾸면 끝이에요.
목록 화면에는 자동으로 나타나요.

```js
{
  id: "s-anchor",                 // 겹치지 않는 영어 이름 (점수 저장에 씀, 한번 정하면 바꾸지 않기)
  sector: 3,                      // 2, 3, 4 중 하나
  title: "묘박 완료 보고",          // 목록에 보일 제목
  brief: "Alfa 묘박지에 투묘를 마쳤습니다. VTS에 보고하세요.",   // 학생이 보는 상황 설명 (한국어)
  station: "Mokpo VTS",           // 상대 이름. {station} 자리에 들어감
  channel: 12,
  // timeLimit: 45,               // 비상 교신처럼 시간 제한이 필요하면 (초)
  turns: [
    {
      them: null,                 // 상대가 먼저 하는 말. 내가 먼저 부르면 null
      model: "Mokpo VTS, this is BYPASS ONE. INFORMATION. I am anchored in anchorage Alfa. Over.",
      check: [
        "callStation",            // 자주 쓰는 항목은 이름만
        "shipName",
        { label: "마커 INFORMATION", say: ["information"], tip: "보고는 INFORMATION." },
        { label: "묘박지 이름", say: ["anchorage alfa"], tip: "어디에 투묘했는지." },
        "over"
      ],
      retry: "BYPASS ONE, Mokpo VTS. Say again. Over."   // 70점 미만일 때 상대가 되묻는 말 (없으면 기본 문장)
    }
  ]
}
```

## 채점 항목 쓰는 법

- `{ label, say: [...], tip }` : `say` 안의 표현 중 **하나라도** 말하면 통과
- `times: 2` : 그 표현을 2번 이상 말해야 통과 (선명 2회, MAYDAY 3회 등)
- `not: [...]` : 이 표현을 말하면 실패 (예: `"over and out"`)
- `pts: 2` : 이 항목만 점수 2배 (기본은 모든 항목 같은 점수)
- 이름만 써도 되는 항목: `callStation`, `shipName`, `shipTwice`, `thisIs`, `over`, `out`, `noOverAndOut`
  (`scenarios.js` 위쪽 `presets`에서 고치거나 새로 만들 수 있어요)

## 숫자와 음성인식

- `"zero-niner-zero"`, `"0 9 0"`, `"090"`은 모두 같은 것으로 처리돼요. 편한 쪽으로 쓰면 돼요.
- `"ninety"`처럼 묶어 읽으면 틀린 것으로 처리돼요.
- 발음 자체(NINER인지 nine인지)는 채점하지 않아요. 음성인식이 둘 다 "9"로 적기 때문이에요.
- 음성인식이 자주 잘못 적는 말은 `aliases`에 추가하면 돼요.
  예: 학생이 "BYPASS"라고 했는데 "by pass"로 찍히면 → `"bypass": ["by pass", ...]`
- 숫자를 묶어 읽었는데 음성인식이 숫자로 바꿔 적는 경우(예: "twelve" → "12")는 구분하지 못해요.

## 지금 상태와 다음 할 일

- [x] 섹터 2·3·4 큰 틀, 시나리오 12개
- [x] 읽어 주기(TTS) + 무전 잡음, 누르고 말하기(PTT, 스페이스바), 타자 답하기
- [x] 채점·피드백, 70점 미만이면 상대가 되묻기, 힌트(없음/뼈대/전체), 자막 끄기
- [x] 연습실 / 실전 교신 분리, 무전기 화면과 무선 일지
- [x] 최고 점수 저장 (지금은 브라우저에만 저장, 연습실·실전 따로)
- [ ] 점수·진행 기록을 Supabase에 저장 (로그인 계정 연결)
- [ ] 단계 잠금·계급, 최종 평가, 수료증
- [ ] 사이트 메뉴에 링크 걸기 (지금은 주소로만 들어갈 수 있음, 검색 노출 막아 둠)
