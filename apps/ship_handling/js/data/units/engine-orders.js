/* 5-6 기관 명령 */
export default {
  lede: '선장이 선교에서 기관 명령을 내리면 텔레그래프 담당자가 복창하고 손잡이를 옮긴다. 기관실이 응답하면 회전수와 속력으로 실행을 확인해 보고한다. 조타 명령처럼 정해진 말과 되묻기가 생명이다.',
  blocks: [
    { type: 'h', text: '명령이 오가는 순서' },
    { type: 'steps', items: [
      ['명령', '선장(또는 당직 사관)이 기관 명령을 낸다.'],
      ['복창·조작', '텔레그래프 담당자가 복창하고 손잡이를 명령한 위치로 옮긴다.'],
      ['응답', '기관실이 응답 지시침을 같은 위치로 맞추고 곧바로 기관을 조작한다.'],
      ['확인·보고', '선교에서 RPM 지시기와 속력계로 실행 상태를 확인해 선장에게 보고한다.']
    ] },
    { type: 'h', text: '표준 기관 명령' },
    { type: 'table', head: ['명령', '뜻'], rows: [
      ['(Port / Starboard engine) full ahead / astern', '(좌현·우현 기관) 전진 전속 / 후진 전속'],
      ['(Port / Starboard engine) half ahead / astern', '전진 반속 / 후진 반속'],
      ['(Port / Starboard engine) slow ahead / astern', '전진 미속 / 후진 미속'],
      ['(Port / Starboard engine) dead slow ahead / astern', '전진 극미속 / 후진 극미속'],
      ['Stop (port / starboard) engine', '기관 정지'],
      ['Emergency full ahead / astern', '비상 전진 전속 / 비상 후진 전속'],
      ['Stand by engine', '기관 준비. 기관실은 바로 운전할 수 있게 사람과 장비를 갖춘다'],
      ['Finished with engine / No more maneuvering', '기관 사용 끝']
    ] },
    { type: 'note', html: '쌍축선에서 두 기관을 함께 쓸 때는 모든 명령에 "양현"을 붙인다(예: 양현 전진 전속). 따로 쓸 때는 "우현 전진 전속, 좌현 후진 반속"처럼 현을 밝힌다. "모든 기관 정지"는 예외다.' },
    { type: 'h', text: '쓰러스터 명령' },
    { type: 'table', head: ['명령', '뜻'], rows: [
      ['Bow thruster full / half to port (starboard)', '선수 쓰러스터 전속·반속으로 좌현(우현) 쪽으로'],
      ['Stern thruster full / half to port (starboard)', '선미 쓰러스터 전속·반속으로 좌현(우현) 쪽으로'],
      ['Bow / Stern thruster stop', '쓰러스터 정지']
    ] },
    { type: 'p', html: '현장에서는 thruster를 빼고 "bow" 다음에 현과 출력을 붙여 짧게 부르기도 한다.' },
    { type: 'table', head: ['짧은 구령', '뜻'], rows: [
      ['Bow starboard half / full', '선수를 우현 쪽으로 반속 / 전속으로 밀어라'],
      ['Bow port half / full', '선수를 좌현 쪽으로 반속 / 전속으로 밀어라'],
      ['Bow stop (midship)', '선수 쓰러스터를 멈춰라']
    ] },
    { type: 'h', text: '조종 속력으로 바꿀 때' },
    { type: 'p', html: '협수로 통과나 입항을 앞두면 정상 항해 속력에서 조종 속력으로 낮추고 기관을 스탠바이 상태로 둔다. 재래 디젤선은 연료를 벙커 C에서 벙커 A로 바꾸는 데 전속 전진에서 1~2시간이 걸리므로 기관실에 넉넉히 미리 알린다.' }
  ],
  sources: [
    '『고등학교 선박 운용』 Ⅴ-1 「선박 조종」 표준 기관 명령, 선수·선미 스러스터 명령, 기관 조종',
    '『고등학교 선박 운용』 Ⅴ-2 「출·입항 조종과 정박」 선수 스러스터 사용 구령',
    'IMO 표준 해사 통신 용어(SMCP) 기관·스러스터 명령'
  ]
};
