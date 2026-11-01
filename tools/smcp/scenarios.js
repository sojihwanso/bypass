/* ═══════════════════════════════════════════════════════════════════
   SMCP 무전 교신 훈련소 · 시나리오 데이터
   ───────────────────────────────────────────────────────────────────
   이 파일만 고치면 문제를 추가하거나 수정할 수 있어요. 화면 코드는 건드리지 않아도 됩니다.
   자세한 작성법은 같은 폴더의 README.md 를 보세요.

   ▸ 시나리오 하나 = { id, sector, title, brief, station, channel, turns: [...] }
   ▸ 턴 하나        = { them, model, check: [...] }
       them  : 상대(VTS·선박)가 먼저 하는 말. 내가 먼저 부르는 턴이면 null
       model : 표준 답안 (채점 후 "표준 예시"로 보여 줌, 힌트 뼈대도 여기서 자동으로 만듦)
       check : 채점 항목. 항목마다 점수는 똑같이 나눠 가짐 (pts 로 바꿀 수 있음)

   ▸ 채점 항목 쓰는 법
       { label: "화면에 보일 이름", say: ["이 중", "하나라도", "말하면 통과"], tip: "놓쳤을 때 보여 줄 설명" }
       { label: "...", say: ["{ship}"], times: 2 }      → 2번 이상 말해야 통과
       { label: "...", not: ["over and out"] }         → 이 말을 하면 감점
       "over" / "out" / "callStation" / "shipName" / "shipTwice" / "noOverAndOut"
                                                       → 자주 쓰는 항목은 이름만 써도 됨 (아래 presets)
   ▸ 숫자는 "zero-niner-zero", "0 9 0", "090" 어느 쪽으로 써도 똑같이 처리돼요.
     "ninety" 처럼 묶어 읽으면 틀린 것으로 처리돼요.
   ▸ {ship} 은 자선명, {station} 은 상대 이름으로 바뀌어요.
   ═══════════════════════════════════════════════════════════════════ */

window.SMCP = {

  /* 기본 자선. 시나리오에서 ship: { ... } 으로 바꿀 수 있어요. */
  ship: { name: "BYPASS ONE", callsign: "D9EJ", callsignSpoken: "Delta Niner Echo Juliet", pob: 15 },

  /* 상대 목소리 (녹음 파일을 만들 때 씀). 바꾸거나 대사를 고치면 voice/build.py 를 다시 돌려야 녹음에 반영돼요.
     녹음이 없는 대사는 브라우저 기본 목소리로 읽어요.
     목소리 이름: 영국 남성 bm_george · bm_lewis · bm_fable · bm_daniel / 영국 여성 bf_emma · bf_isabella
                  미국 남성 am_michael · am_onyx · am_adam / 미국 여성 af_heart · af_bella */
  voices: {
    default: "bm_george",                 // 따로 정하지 않은 상대는 이 목소리
    model: "bf_emma",                     // 연습실 '표준 예시 듣기'
    "Mokpo Pilot Station": "am_michael",
    "Ocean Star": "bm_lewis"
  },

  /* 통과 점수 (100점 만점). 이보다 낮으면 상대가 되묻고 다시 하게 해요. */
  passScore: 70,

  /* 음성인식이 잘못 알아듣는 말 → 원래 말로 바꿔서 채점
     왼쪽: 원래 말 / 오른쪽: 음성인식이 자주 적는 틀린 표기들 */
  aliases: {
    "bypass":   ["by pass", "bye pass", "buy pass", "by-pass", "biopass"],
    "mokpo":    ["mok po", "mock po", "moppo", "mogpo", "mok-po"],
    "vts":      ["v t s", "vts's", "btf", "v.t.s"],
    "mayday":   ["may day", "mayde", "m'aidez"],
    "pan pan":  ["pan-pan", "panpan", "pam pam", "pan pin"],
    "securite": ["security", "securitay", "say cure e tay", "securitee", "sécurité"],
    "juliet":   ["juliette", "julie"],
    "starboard":["star board", "starbird"],
    "anchorage":["anchor age"],
    "pilot":    ["pilate", "pirate"],
    "alfa":     ["alpha"],
    "whisky":   ["whiskey"]
  },

  /* 이름만 써도 되는 채점 항목 */
  presets: {
    callStation:  { label: "상대 호출", say: ["{station}"], tip: "교신은 항상 부르는 상대 이름으로 시작해요." },
    shipName:     { label: "자선명 밝히기", say: ["{ship}"], tip: "this is 다음에 내 선명을 말해요." },
    shipTwice:    { label: "자선명 2회", say: ["{ship}"], times: 2, tip: "처음 호출할 때는 선명을 두 번 말해요. (this is BYPASS ONE, BYPASS ONE)" },
    thisIs:       { label: "this is", say: ["this is"], tip: "상대 이름 다음에 'this is' + 내 선명." },
    over:         { label: "끝맺음 Over", say: ["over"], tip: "답을 기다릴 때는 Over로 끝내요." },
    out:          { label: "끝맺음 Out", say: ["out"], tip: "교신을 마칠 때는 Out으로 끝내요." },
    noOverAndOut: { label: "'Over and out' 쓰지 않기", not: ["over and out"], tip: "Over(응답 대기)와 Out(교신 종료)은 뜻이 반대라 같이 쓰지 않아요." }
  },

  /* 섹터(단계). 1단계 기초는 Alfa to Zulu 로 연결돼요. */
  sectors: [
    { no: 1, title: "기초 훈련", rank: "실습생", desc: "발음 알파벳과 숫자. Alfa to Zulu에서 연습해요.", link: "/tools/alfa-to-zulu/" },
    { no: 2, title: "표준 절차", rank: "3항사", desc: "한 문장 교신. 호출·응답, 채널 변경, 복창, 정정, Say again, 메시지 마커." },
    { no: 3, title: "상황 교신", rank: "2항사", desc: "여러 턴이 이어지는 교신. 입항 보고, 도선사 요청, 선박 간 피항." },
    { no: 4, title: "비상 교신", rank: "1항사", desc: "SECURITE · PAN-PAN · MAYDAY. 제한 시간 안에 필수 정보를 빠짐없이." }
  ],

  /* ───────────────────────── 시나리오 ───────────────────────── */
  scenarios: [

    /* ════════ 2단계 · 표준 절차 ════════ */
    {
      id: "p-call",
      sector: 2,
      title: "VTS 처음 호출하기",
      brief: "목포항에 접근 중입니다. VHF로 Mokpo VTS를 처음 불러 보세요. 아직 용건은 말하지 않고, 상대가 응답하도록 호출만 합니다.",
      station: "Mokpo VTS",
      channel: 12,
      turns: [
        {
          them: null,
          model: "Mokpo VTS, Mokpo VTS. This is BYPASS ONE, BYPASS ONE. Over.",
          check: [
            { label: "상대 이름 2회", say: ["{station}"], times: 2, tip: "처음 부를 때는 상대 이름도 두 번 말해요." },
            "thisIs",
            "shipTwice",
            "over"
          ]
        }
      ]
    },

    {
      id: "p-channel",
      sector: 2,
      title: "채널 변경 지시에 답하기",
      brief: "Mokpo VTS가 작업 채널을 바꾸라고 합니다. 지시받은 채널 번호를 그대로 말하며 따르겠다고 답하세요.",
      station: "Mokpo VTS",
      channel: 16,
      turns: [
        {
          them: "BYPASS ONE, this is Mokpo VTS. Change to channel one-two. Over.",
          model: "Mokpo VTS, this is BYPASS ONE. Changing to channel one-two. Over.",
          check: [
            "callStation",
            "shipName",
            { label: "채널 번호 한 자리씩", say: ["channel one-two"], tip: "채널 12는 'twelve'가 아니라 'one-two'로 읽어요." },
            { label: "따르겠다는 표현", say: ["changing", "change to", "switching", "going to channel"], tip: "Changing to channel ~ 처럼 따르겠다고 말해요." },
            "over"
          ],
          retry: "BYPASS ONE, Mokpo VTS. Say again. Over."
        }
      ]
    },

    {
      id: "p-readback",
      sector: 2,
      title: "지시 복창하기",
      brief: "VTS가 침로를 바꾸라고 지시합니다. 'Roger'나 'OK'만으로는 복창이 아니에요. 지시받은 침로 숫자를 그대로 되말하세요.",
      station: "Mokpo VTS",
      channel: 12,
      turns: [
        {
          them: "BYPASS ONE, Mokpo VTS. INSTRUCTION. Alter course to zero-four-five degrees. Over.",
          model: "Mokpo VTS, BYPASS ONE. Altering course to zero-four-five degrees. Over.",
          check: [
            "callStation",
            "shipName",
            { label: "침로 복창 (045)", say: ["zero-four-five"], tip: "지시받은 숫자를 한 자리씩 그대로: zero-four-five." },
            { label: "변침 동작", say: ["altering course", "alter course", "course to"], tip: "Altering course to ~ 로 무엇을 하는지도 말해요." },
            "over"
          ],
          retry: "BYPASS ONE, Mokpo VTS. Read back my instruction. Over."
        }
      ]
    },

    {
      id: "p-sayagain",
      sector: 2,
      title: "못 들었을 때 Say again",
      brief: "VTS 교신 중간이 잡음에 묻혀 숫자를 못 들었습니다. 추측해서 답하지 말고 다시 말해 달라고 하세요.",
      station: "Mokpo VTS",
      channel: 12,
      turns: [
        {
          them: "BYPASS ONE, Mokpo VTS. INSTRUCTION. Reduce speed to ... ... knots. Over.",
          model: "Mokpo VTS, BYPASS ONE. Say again your speed. Over.",
          check: [
            "callStation",
            "shipName",
            { label: "Say again", say: ["say again"], tip: "못 들었으면 추측하지 말고 'Say again'." },
            "over"
          ]
        }
      ]
    },

    {
      id: "p-correction",
      sector: 2,
      title: "잘못 말한 것 정정하기",
      brief: "방금 도착 예정 시각(ETA)을 '1530'이라고 잘못 보고했습니다. 실제로는 1630 UTC예요. 정정하세요.",
      station: "Mokpo VTS",
      channel: 12,
      turns: [
        {
          them: "BYPASS ONE, Mokpo VTS. Your ETA one-five-three-zero UTC, noted. Over.",
          model: "Mokpo VTS, BYPASS ONE. Correction. My ETA is one-six-three-zero UTC. Over.",
          check: [
            "callStation",
            "shipName",
            { label: "Correction", say: ["correction"], tip: "잘못 말한 것을 고칠 때는 'Correction'으로 시작해요." },
            { label: "고친 시각 (1630)", say: ["one-six-three-zero"], tip: "시각도 한 자리씩: one-six-three-zero." },
            "over"
          ]
        }
      ]
    },

    {
      id: "p-marker",
      sector: 2,
      title: "메시지 마커 붙이기",
      brief: "앞쪽 어선을 피하려고 우현으로 변침할 생각입니다. 내 '의도'를 알리는 메시지 마커를 붙여서 VTS에 알리세요.",
      station: "Mokpo VTS",
      channel: 12,
      turns: [
        {
          them: "BYPASS ONE, Mokpo VTS. Fishing vessels ahead of you. What are your intentions? Over.",
          model: "Mokpo VTS, BYPASS ONE. INTENTION. I will alter course to starboard. Over.",
          check: [
            "callStation",
            "shipName",
            { label: "마커 INTENTION", say: ["intention"], tip: "내가 앞으로 할 행동(I will ~) 앞에는 INTENTION." },
            { label: "I will ~", say: ["i will"], tip: "의도는 'I will ~' 형태로 말해요." },
            { label: "우현 변침", say: ["starboard"], tip: "어느 쪽으로 피하는지: starboard." },
            "over"
          ]
        }
      ]
    },

    /* ════════ 3단계 · 상황 교신 ════════ */
    {
      id: "s-arrival",
      sector: 3,
      title: "목포항 입항 보고",
      brief: "BYPASS ONE이 목포항에 입항합니다. 지금 위치는 3번 부이 남쪽 1마일, 침로 090, 속력 10노트, 도착 예정 1430입니다. VTS를 부르고, 보고하고, 지시를 복창하세요.",
      station: "Mokpo VTS",
      channel: 12,
      turns: [
        {
          them: null,
          model: "Mokpo VTS, Mokpo VTS. This is BYPASS ONE, BYPASS ONE. Over.",
          check: ["callStation", "thisIs", "shipTwice", "over"]
        },
        {
          them: "BYPASS ONE, this is Mokpo VTS. Go ahead. Over.",
          model: "Mokpo VTS, BYPASS ONE. INFORMATION. My position is one mile south of buoy number tree. My course is zero-niner-zero degrees, speed one-zero knots. My ETA is one-four-tree-zero. Over.",
          check: [
            "callStation",
            "shipName",
            { label: "마커 INFORMATION", say: ["information"], tip: "사실을 보고할 때는 INFORMATION." },
            { label: "위치 (3번 부이)", say: ["buoy number tree", "buoy tree", "number tree buoy"], tip: "위치: one mile south of buoy number tree." },
            { label: "침로 090", say: ["zero-niner-zero"], tip: "침로는 세 자리로 한 자리씩: zero-niner-zero." },
            { label: "속력 10노트", say: ["one-zero knots", "one-zero"], tip: "속력도 한 자리씩: one-zero knots." },
            { label: "ETA 1430", say: ["one-four-tree-zero"], tip: "시각: one-four-tree-zero." },
            "over"
          ],
          retry: "BYPASS ONE, Mokpo VTS. Say again your position, course and ETA. Over."
        },
        {
          them: "BYPASS ONE, Mokpo VTS. INSTRUCTION. Proceed to anchorage Alfa and report when anchored. Over.",
          model: "Mokpo VTS, BYPASS ONE. Proceeding to anchorage Alfa. I will report when anchored. Out.",
          check: [
            "callStation",
            "shipName",
            { label: "묘박지 복창", say: ["anchorage alfa"], tip: "지시받은 묘박지 이름을 그대로: anchorage Alfa." },
            { label: "보고하겠다는 복창", say: ["report"], tip: "'report when anchored'까지 되말해요." },
            "out",
            "noOverAndOut"
          ],
          retry: "BYPASS ONE, Mokpo VTS. Read back my instruction. Over."
        }
      ]
    },

    {
      id: "s-pilot",
      sector: 3,
      title: "도선사 승선 요청",
      brief: "도선사가 필요합니다. 도선 지점 도착 예정은 0800, 현재 흘수는 9.5미터(niner decimal five metres)입니다. Mokpo Pilot Station에 요청하고 지시를 복창하세요.",
      station: "Mokpo Pilot Station",
      channel: 14,
      turns: [
        {
          them: null,
          model: "Mokpo Pilot Station, this is BYPASS ONE, BYPASS ONE. REQUEST. I require a pilot. My ETA at the pilot boarding place is zero-eight-zero-zero. Over.",
          check: [
            "callStation",
            "shipTwice",
            { label: "마커 REQUEST", say: ["request"], tip: "무언가를 요청할 때는 REQUEST." },
            { label: "도선사 요청", say: ["require a pilot", "request a pilot", "require pilot", "need a pilot"], tip: "I require a pilot." },
            { label: "도착 예정 0800", say: ["zero-eight-zero-zero"], tip: "zero-eight-zero-zero." },
            "over"
          ]
        },
        {
          them: "BYPASS ONE, Mokpo Pilot Station. QUESTION. What is your present draft? Over.",
          model: "Mokpo Pilot Station, BYPASS ONE. ANSWER. My present draft is niner decimal five metres. Over.",
          check: [
            "callStation",
            "shipName",
            { label: "마커 ANSWER", say: ["answer"], tip: "질문에 답할 때는 ANSWER." },
            { label: "흘수 9.5m", say: ["niner decimal five", "niner point five"], tip: "소수점은 decimal: niner decimal five metres." },
            "over"
          ]
        },
        {
          them: "BYPASS ONE, Mokpo Pilot Station. Pilot will board at zero-eight-zero-zero. Rig pilot ladder on starboard side, one metre above water. Over.",
          model: "Mokpo Pilot Station, BYPASS ONE. Pilot boarding at zero-eight-zero-zero. Rigging pilot ladder on starboard side, one metre above water. Out.",
          check: [
            "callStation",
            "shipName",
            { label: "승선 시각 복창", say: ["zero-eight-zero-zero"], tip: "zero-eight-zero-zero." },
            { label: "사다리 위치 복창", say: ["starboard"], tip: "어느 현에 사다리를 다는지: starboard side." },
            { label: "높이 복창", say: ["one metre", "one meter"], tip: "one metre above water." },
            "out"
          ],
          retry: "BYPASS ONE, Mokpo Pilot Station. Read back. Over."
        }
      ]
    },

    {
      id: "s-crossing",
      sector: 3,
      title: "선박 간 피항 의도 교환",
      brief: "좌현 선수 방향에서 화물선 OCEAN STAR가 접근합니다. 상대가 먼저 의도를 묻습니다. 우현으로 변침해서 좌현 대 좌현(port to port)으로 지나가겠다고 알리세요.",
      station: "Ocean Star",
      channel: 13,
      turns: [
        {
          them: "BYPASS ONE, BYPASS ONE. This is OCEAN STAR, OCEAN STAR. QUESTION. What are your intentions? Over.",
          model: "OCEAN STAR, this is BYPASS ONE. INTENTION. I will alter course to starboard. I will pass port to port. Over.",
          check: [
            "callStation",
            "shipName",
            { label: "마커 INTENTION", say: ["intention"], tip: "내 행동 계획은 INTENTION." },
            { label: "우현 변침", say: ["starboard"], tip: "alter course to starboard." },
            { label: "통과 방법", say: ["port to port"], tip: "어떻게 지나갈지: port to port." },
            "over"
          ]
        },
        {
          them: "BYPASS ONE, OCEAN STAR. Agreed. I will keep my course and speed. Over.",
          model: "OCEAN STAR, BYPASS ONE. Understood. You will keep your course and speed. Out.",
          check: [
            "callStation",
            "shipName",
            { label: "상대 의도 확인", say: ["course and speed", "keep your course"], tip: "상대가 무엇을 하겠다고 했는지 되말해 확인해요." },
            "out",
            "noOverAndOut"
          ]
        }
      ]
    },

    /* ════════ 4단계 · 비상 교신 ════════ */
    {
      id: "e-securite",
      sector: 4,
      title: "SECURITE · 표류 컨테이너 경보",
      brief: "항로에 표류 중인 컨테이너를 발견했습니다. 위치는 3번 부이 북쪽 2마일. 모든 선박에 안전 경보를 보내세요.",
      station: "All stations",
      channel: 16,
      timeLimit: 45,
      turns: [
        {
          them: null,
          model: "SECURITE, SECURITE, SECURITE. All stations, all stations, all stations. This is BYPASS ONE, BYPASS ONE, BYPASS ONE. WARNING. Container adrift in position two miles north of buoy number tree. All vessels keep sharp lookout. Out.",
          check: [
            { label: "SECURITE 3회", say: ["securite"], times: 3, tip: "안전 신호는 SECURITE를 세 번." },
            { label: "All stations", say: ["all stations"], tip: "모든 선박에게: All stations." },
            "shipName",
            { label: "마커 WARNING", say: ["warning"], tip: "위험을 알릴 때는 WARNING." },
            { label: "위험 내용", say: ["container"], tip: "무엇이 위험한지: container adrift." },
            { label: "위치", say: ["buoy number tree", "buoy tree"], tip: "위치: two miles north of buoy number tree." },
            "out"
          ]
        }
      ]
    },

    {
      id: "e-panpan",
      sector: 4,
      title: "PAN-PAN · 주기관 고장",
      brief: "주기관이 멈춰 표류 중입니다. 당장 생명이 위험하진 않지만 예인선 지원이 필요합니다. 위치는 3번 부이 남쪽 1마일. 긴급 통신을 보내세요.",
      station: "Mokpo VTS",
      channel: 16,
      timeLimit: 45,
      turns: [
        {
          them: null,
          model: "PAN-PAN, PAN-PAN, PAN-PAN. All stations, all stations, all stations. This is BYPASS ONE, BYPASS ONE, BYPASS ONE. Call sign Delta Niner Echo Juliet. My position is one mile south of buoy number tree. I have main engine failure. I am drifting. I require tug assistance. Over.",
          check: [
            { label: "PAN-PAN 3회", say: ["pan pan"], times: 3, tip: "긴급 신호는 PAN-PAN을 세 번." },
            "shipName",
            { label: "호출부호", say: ["delta niner echo juliet"], tip: "호출부호: Delta Niner Echo Juliet." },
            { label: "위치", say: ["buoy number tree", "buoy tree"], tip: "위치를 꼭 말해요." },
            { label: "상황 (기관 고장)", say: ["engine failure", "engine breakdown", "engine problem"], tip: "무슨 일인지: main engine failure." },
            { label: "필요한 지원", say: ["tug"], tip: "무엇이 필요한지: tug assistance." },
            "over"
          ]
        },
        {
          them: "BYPASS ONE, this is Mokpo VTS. Received PAN-PAN. Do you require immediate assistance? Over.",
          model: "Mokpo VTS, BYPASS ONE. ANSWER. Negative. I require tug assistance within two hours. Over.",
          check: [
            "callStation",
            "shipName",
            { label: "Negative", say: ["negative"], tip: "'No' 대신 SMCP는 'Negative'." },
            { label: "필요한 지원 다시", say: ["tug"], tip: "다시 한번 tug assistance." },
            "over"
          ]
        }
      ]
    },

    {
      id: "e-mayday",
      sector: 4,
      title: "MAYDAY · 기관실 화재",
      brief: "기관실에 화재가 났습니다. 승선 인원 15명, 위치는 3번 부이 남쪽 1마일. 소화 지원이 필요합니다. 조난 통신을 보내세요.",
      station: "Mokpo VTS",
      channel: 16,
      timeLimit: 50,
      turns: [
        {
          them: null,
          model: "MAYDAY, MAYDAY, MAYDAY. This is BYPASS ONE, BYPASS ONE, BYPASS ONE. Call sign Delta Niner Echo Juliet. MAYDAY BYPASS ONE. My position is one mile south of buoy number tree. I am on fire in the engine room. I require fire fighting assistance. One-five persons on board. Over.",
          check: [
            { label: "MAYDAY 3회 이상", say: ["mayday"], times: 3, tip: "조난 신호는 MAYDAY를 세 번 (선명 뒤에 한 번 더)." },
            { label: "자선명 3회", say: ["{ship}"], times: 3, tip: "조난 호출에서는 선명을 세 번." },
            { label: "호출부호", say: ["delta niner echo juliet"], tip: "Delta Niner Echo Juliet." },
            { label: "위치", say: ["buoy number tree", "buoy tree"], tip: "위치가 없으면 구조가 시작되지 않아요." },
            { label: "상황 (화재)", say: ["on fire", "fire"], tip: "I am on fire." },
            { label: "필요한 지원", say: ["assistance"], tip: "I require fire fighting assistance." },
            { label: "승선 인원 15명", say: ["one-five persons", "one-five"], tip: "인원도 한 자리씩: one-five persons on board." },
            "over"
          ]
        },
        {
          them: "BYPASS ONE, this is Mokpo VTS. Received MAYDAY. QUESTION. Do you intend to abandon vessel? Over.",
          model: "Mokpo VTS, BYPASS ONE. ANSWER. Negative. I do not intend to abandon vessel. Fighting fire. Over.",
          check: [
            "callStation",
            "shipName",
            { label: "Negative", say: ["negative"], tip: "SMCP 응답은 Yes/No 대신 Affirmative/Negative." },
            { label: "현재 조치", say: ["fighting fire", "fighting the fire", "fire fighting"], tip: "지금 하고 있는 일: fighting fire." },
            "over"
          ]
        }
      ]
    }
  ]
};
