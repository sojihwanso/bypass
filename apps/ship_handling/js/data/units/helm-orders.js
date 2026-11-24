/* 3-4 조타 명령 */
export default {
  lede: '수동 조타에서는 조선자가 명령하고, 조타수가 복창한 뒤 타를 돌리고, 결과를 보고한다. 명령이 하나라도 잘못 전해지면 큰 사고로 이어지므로 정해진 말을 쓰고 반드시 되묻고 확인한다.',
  blocks: [
    { type: 'h', text: '명령이 오가는 순서' },
    { type: 'steps', items: [
      ['명령', '조선자(선장 또는 당직 항해사)가 조타 명령을 낸다. 손으로 방향을 함께 가리키면 더 확실하다.'],
      ['복창', '조타수가 명령을 그대로 되풀이한다.'],
      ['조타', '조타수가 조타륜을 돌리고, 타각 지시기가 명령한 각을 가리키면 보고한다.'],
      ['확인', '조선자는 타가 명령대로 움직였는지 확인하고, 보고를 받았다고 대답한다.']
    ] },
    { type: 'p', html: '모든 조타 명령은 다음 명령이 나올 때까지 유지한다. 타를 써도 배가 반응하지 않으면 조타수는 곧바로 보고한다. 당직 사관은 의심스러우면 "지금 선수 방위가 몇 도인가?"처럼 바로 묻는다.' },
    { type: 'h', text: '표준 조타 명령' },
    { type: 'p', html: '국제해사기구(IMO)의 표준 해사 통신 용어(SMCP)에 있는 명령이다. 예부터 써 온 관용 명령보다 뜻이 분명하다.' },
    { type: 'table', head: ['명령', '뜻'], rows: [
      ['Midships', '타를 중앙(0°)으로 하라'],
      ['Port / Starboard five', '좌현(우현) 타각 5°'],
      ['Port / Starboard ten', '좌현(우현) 타각 10°'],
      ['Port / Starboard fifteen', '좌현(우현) 타각 15°'],
      ['Port / Starboard twenty', '좌현(우현) 타각 20°'],
      ['Port / Starboard twenty-five', '좌현(우현) 타각 25°'],
      ['Hard-a-port / Hard-a-starboard', '좌현(우현)으로 끝까지 돌려라(전타)'],
      ['Nothing to port / starboard', '명령한 침로에서 좌현(우현) 쪽으로 벗어나지 마라'],
      ['Meet her', '돌고 있는 선수를 반대 타로 견제하라'],
      ['Steady', '선수의 회두를 가능한 한 빨리 줄여라'],
      ['Ease to five / ten / fifteen / twenty', '타각을 5°·10°·15°·20°로 줄여 유지하라'],
      ['Steady as she goes', '명령할 때 컴퍼스가 가리키는 방위로 정침하라. 조타수는 그 방위를 읽어 복창하고, 정침하면 "Steady on ○○○"로 보고한다'],
      ['Keep the buoy / mark on port (starboard) side', '부표·표지를 좌현(우현)에 두고 가라'],
      ['Report if she does not answer the wheel', '타효가 없으면 보고하라'],
      ['Finished with wheel / No more steering', '조타를 마친다'],
      ['Port / Starboard, steer one eight two', '좌현(우현)으로 돌려 182°에 맞춰라']
    ] },
    { type: 'note', html: '방위는 숫자를 하나씩 끊어 읽는다. 182°는 "one eight two", 082°는 "zero eight two"처럼 0도 빼지 않는다.' },
    { type: 'h', text: '자주 헷갈리는 것' },
    { type: 'compare', cols: [
      { title: 'Steady', items: ['회두를 빨리 멈추게 하는 명령이다.', '어느 방위에 맞출지는 정하지 않는다.'] },
      { title: 'Steady as she goes', items: ['명령한 순간의 선수 방위로 정침한다.', '조타수가 그 방위를 소리 내어 말한다.'] },
      { title: 'Steer ○○○', items: ['지정한 방위에 맞춘다.', '어느 현으로 돌릴지도 함께 말한다.'] }
    ] }
  ],
  sources: [
    '『고등학교 선박 운용』 Ⅴ-1 「선박 조종」 조타 명령 (표준 조타 명령)',
    'IMO 표준 해사 통신 용어(SMCP) 조타 명령'
  ]
};
