/* 8-4 접이안 */
const moor = `<svg viewBox="0 0 360 252" role="img" aria-label="부두에 좌현을 댄 배와 여섯 가지 계선줄: Head line, Fore breast line, Fore spring line, After spring line, After breast line, Stern line"><g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M62 84 L252 84 Q302 88 320 104 Q302 120 252 124 L62 124 Q54 104 62 84 Z"/><path d="M0 178 L360 178" stroke-width="2.5"/><path d="M0 184 L360 184" stroke-width="1" opacity=".4"/><path d="M300 128 L350 178" stroke-width="1.3"/><path d="M268 136 L268 178" stroke-width="1.3"/><path d="M240 136 L190 178" stroke-width="1.3"/><path d="M110 136 L160 178" stroke-width="1.3"/><path d="M82 136 L82 178" stroke-width="1.3"/><path d="M60 128 L12 178" stroke-width="1.3"/></g><g fill="currentColor"><rect x="347" y="175" width="6" height="6"/><rect x="265" y="175" width="6" height="6"/><rect x="187" y="175" width="6" height="6"/><rect x="157" y="175" width="6" height="6"/><rect x="79" y="175" width="6" height="6"/><rect x="9" y="175" width="6" height="6"/><circle cx="325" cy="153" r="7.5" fill-opacity=".9"/><text x="325" y="156.6" text-anchor="middle" font-size="10" font-weight="700" fill="var(--surface)">1</text><circle cx="268" cy="157" r="7.5" fill-opacity=".9"/><text x="268" y="160.6" text-anchor="middle" font-size="10" font-weight="700" fill="var(--surface)">2</text><circle cx="215" cy="157" r="7.5" fill-opacity=".9"/><text x="215" y="160.6" text-anchor="middle" font-size="10" font-weight="700" fill="var(--surface)">3</text><circle cx="135" cy="157" r="7.5" fill-opacity=".9"/><text x="135" y="160.6" text-anchor="middle" font-size="10" font-weight="700" fill="var(--surface)">4</text><circle cx="82" cy="157" r="7.5" fill-opacity=".9"/><text x="82" y="160.6" text-anchor="middle" font-size="10" font-weight="700" fill="var(--surface)">5</text><circle cx="36" cy="153" r="7.5" fill-opacity=".9"/><text x="36" y="156.6" text-anchor="middle" font-size="10" font-weight="700" fill="var(--surface)">6</text><text x="322" y="80" font-size="10" opacity=".75">선수</text><text x="30" y="80" font-size="10" opacity=".75">선미</text><text x="180" y="200" text-anchor="middle" font-size="10" opacity=".75">부두</text><text x="8" y="218" font-size="12" font-weight="700">1. Head line</text><text x="128" y="218" font-size="12" font-weight="700">2. Fore breast line</text><text x="248" y="218" font-size="12" font-weight="700">3. Fore spring line</text><text x="8" y="242" font-size="12" font-weight="700">4. After spring line</text><text x="128" y="242" font-size="12" font-weight="700">5. After breast line</text><text x="248" y="242" font-size="12" font-weight="700">6. Stern line</text></g></svg>`;
export default {
  scene: 'berth',
  lede: '부두에 다가갈 때 조선자가 가장 긴장한다. 정지점을 지나치는 오버런과 부두에 세게 닿는 것을 막으려면 전진 타력과 옆으로 움직이는 속력을 미리 다스려야 한다. 계선줄과 앵커는 그 보조 수단이다.',
  blocks: [
    { type: 'h', text: '계선줄의 이름과 구실' },
    { type: 'figure', svg: moor, caption: '좌현을 부두에 댄 배. 숫자는 아래 이름과 같다. 줄은 여건이 되면 길게 잡는다.' },
    { type: 'table', head: ['계선줄', '막는 움직임'], rows: [
      ['Head line', '선체가 뒤로 가는 것, 선수가 부두에서 떨어지는 것'],
      ['Stern line', '선체가 앞으로 가는 것, 선미가 부두에서 떨어지는 것'],
      ['Fore spring line', '선체가 앞으로 가는 것, 선수가 바깥으로 밀리는 것. 앞에 장애물이 있으면 먼저 걸어 전진 타력을 누른다'],
      ['After spring line', '선체가 뒤로 가는 것. 감으면 선수가 부두에서 떨어져 출항 자세 이안에 쓴다'],
      ['Breast line', '옆으로 움직이는 것. 짧아서 배가 크게 흔들리면 끊어질 수 있다']
    ], caption: '보통 Head line·Stern line 각 3개, Spring line 각 2개, Breast line 각 1개면 충분하지만 배의 크기와 상황에 따라 다르다.' },
    { type: 'h', text: 'Spring line과 계선줄의 효과' },
    { type: 'list', items: [
      'Spring line은 접안 때 가장 먼저 내고 이안 때 가장 나중에 푸는 일이 많다.',
      '<b>Back spring</b>을 먼저 걸면 그 장력으로 전진 속력을 누른다. 후진 기관을 못 쓸 때 특히 중요하다.',
      'Back spring을 비트에 건 채 전진 기관을 쓰면 줄의 반력으로 선체가 부두 쪽으로 당겨진다. 쓰러스터가 없는 배에 효과적이다.',
      '이안 때 back spring을 잡고 전진 기관을 쓰면 선미가 부두에서 떨어진다. 타를 부두 쪽으로 쓰면 더 잘 떨어진다. 반대로 after spring line을 잡고 후진하면 선수가 떨어진다.',
      '전진 중 선수나 선미에서 줄을 잡으면 그쪽이 부두로 당겨지며 돌고, 선체 중앙 근처에서 잡으면 돌지 않고 평행하게 당겨진다. 후진 중에도 같다.'
    ] },
    { type: 'h', text: '앵커를 쓰는 접이안' },
    { type: 'p', html: '체인을 수심의 1.5~2배쯤 내어 앵커가 해저를 끌게 하면, 앵커 무게의 약 1.5배인 제동력을 얻는다.' },
    { type: 'table', head: ['쓰임', '내용'], rows: [
      ['전진 속력 제어', '타효를 유지하며 다가갈 때 속력을 누른다. 후진 기관이 안 될 때 마지막 수단'],
      ['후진 중 선수 우회두 억제', '후진 기관을 쓸 때 선수가 우현으로 도는 것을 막아 선수방위를 지킨다'],
      ['좁은 곳에서 선회', '부두 앞에서 180° 돌아 접안할 때, 기관과 타와 함께 써서 작은 반지름으로 돈다'],
      ['표류와 옆 속력 억제', '바람과 조류에 밀리는 것을 막고 부두 쪽 옆 속력을 다스린다'],
      ['이안·비상 정지', '접안 전에 반대현 앵커를 놓아 두면 감아 들여 부두에서 떨어질 수 있다. 비상시 전속 후진에 양현 앵커를 더해 브레이크로 쓴다']
    ], caption: '앵커를 놓으며 전진할 때 선속은 2~3노트를 넘지 않는다. 체인이 해저에 쌓이지 않게 풀어 주고, 다른 배의 체인·어초·라인 보트·예선과 충분히 떨어졌는지, 앵커가 걸린 뒤 선미가 돌 공간이 있는지 확인한다.' },
    { type: 'h', text: '엔진과 타만으로 접안할 때 (우회전 단추진기)' },
    { type: 'compare', cols: [
      { title: '입항 자세 좌현 접안', items: ['배 길이 또는 선폭 4~5배 앞에서 작은 타력으로 부두에 10~20° 각도로 들어간다.', '배 길이만큼 남았을 때 head line과 back spring을 낸다. 앵커를 쓰면 반 배 길이 앞에서 우현 앵커를 놓는다.', '반 배 길이 앞에서 후진하면 배출류와 횡압력으로 선수가 우현으로 돌아 부두와 나란히 선다. 부두와 거리는 선폭의 1~2배.', 'Stern line을 내고 head line과 함께 감아 붙인다.'] },
      { title: '입항 자세 우현 접안', items: ['후진하면 선미가 부두에서 멀어지고 선수가 부두로 다가가 더 어렵다.', '선폭 1~2배 거리를 두고 낮은 타력으로 부두와 나란히 또는 작은 각도로 들어간다.', '반 배 길이 앞에서 좌현 앵커를 놓으면 후진 때 선수가 부두 쪽으로 도는 것을 누를 수 있다.', '후진으로 멈춘 뒤 줄을 내어 감아 붙인다.'] }
    ] },
    { type: 'p', html: '출항 자세로 댈 때는 2~3노트로 부두에서 반~1 배 길이를 두고 나란히 다가가, 접안현 반대쪽 앵커를 놓고 체인을 풀며 나아가다 앵커를 축으로 선미를 돌려 붙인다. 부두에 큰 각도로 다가갈 때도 반대현 앵커의 제동력으로 속력을 줄이고 선미를 돌린다. <b>대형선</b>은 줄과 앵커만으로는 어렵다. 부두에서 선폭의 약 2배 떨어진 곳에 나란히 멈춘 뒤 예선이나 쓰러스터로 옆으로 붙인다.' },
    { type: 'h', text: '전진 타력 제어: 안전 여유' },
    { type: 'formula', lines: ['σ = A ÷ D'], note: 'D 제동(후진)을 건 지점에서 예정 정지점까지 거리, A 실제로 멈춘 곳과 예정 정지점 사이 남은 거리. σ = 1은 후진을 걸자마자 멈춘 것, σ = 0은 정지점에 딱 멈춘 것이다.' },
    { type: 'table', head: ['속력 범위', '뜻'], rows: [
      ['권고', '극미속 후진으로 σ가 0.3~0.6에 드는 속력. 도선사의 3분의 2가 알맞다고 답했다'],
      ['가능', '극미속 후진으로 σ ≥ 0인 범위 전체. 0~0.3은 대담한 쪽, 0.6보다 크면 신중한 쪽'],
      ['황색', '미속·반속·전속 후진으로만 정지점 안에 멈출 수 있는 속력. 후진 기관이 뜻대로 안 될 수 있어 아무도 이 범위를 고르지 않았다'],
      ['적색', '전속 후진으로도 σ가 0보다 작아 오버런하는 속력. 극도로 주의할 범위']
    ], caption: '도선사들은 가능한 한 극미속 후진으로 다스릴 수 있는 속력을 원한다. VLCC를 빼면 LNG선, PCC, 컨테이너선은 비슷한 결과를 보인다.' },
    { type: 'h', text: '옆으로 붙일 때의 속력' },
    { type: 'p', html: '대형선은 부두에서 선폭의 2배쯤 떨어져 나란히 멈춘 뒤 예선으로 밀어 붙인다. 이때 옆 속력이 크면 방충재와 부두 구조물, 선체가 다친다. 충격은 부가 질량, 닿는 점과 무게중심 사이 거리, 닿는 순간의 속력에 따른 운동 에너지로 정해진다. 옆 이동에도 같은 안전 여유(부두까지 거리 D, 예선 제동으로 멈춘 뒤 남은 거리 A)를 쓰며, 도선사 대부분은 예선 두 척을 미속 후진으로 쓸 때 σ 0.3~0.6을 알맞다고 본다. 부두에 다가가는 옆 속력은 초당 15 cm를 넘지 않게 한다.' },
    { type: 'h', text: '장면 속 접안 순서 (입항자세 좌현 접안)' },
    { type: 'list', items: [
      '부두와 나란히, 선폭의 1~2배 떨어져 멈춘다. 예선은 우현 선수 쪽과 선미 쪽에 붙는다.',
      '선수 쪽을 먼저 밀어 좌현 선수가 소각도로 부두에 다가간다.',
      '부두 가까이에서 <b>히빙 라인</b>(끝에 모래주머니 매듭이 달린 가는 줄)을 던져 계선줄을 건넨다. 선수에서 <b>back spring</b>을 가장 먼저, 이어 Head line을 낸다.',
      '예선이 당겨 옆 속력을 0.1 m/s 아래로 줄이고, <b>선수가 먼저</b> 방현재에 닿는다. 선수를 축으로 선미가 따라 붙어 부두와 나란해진다.',
      '선미에서 After spring·Stern line, 가운데에서 Breast line을 내고, Head line과 Stern line을 함께 감아 들여 고정한 뒤 예선을 보낸다.'
    ] },
    { type: 'note', html: '장면의 정지 거리는 5장 타력 모델(전속 후진 추력 1.2 MN, 저항 ∝ 속력²)에 단계별 후진 추력 비(극미속 0.16, 미속 0.30, 반속 0.56, 전속 1.0)와 추력이 걸리는 데 30초를 가정해 계산한 모델 값이다. 지침 곡선도 이 모델로 그렸다.' }
  ],
  sources: [
    '강의 슬라이드 S13 「접이안 및 충돌회피 조선」 5~8쪽',
    '『선박조종학』 Volume 3 [Ⅰ] Chapter 4 「접이안 조선」 (173~182쪽)',
    '『선박조종학』 Volume 3 [Ⅰ] Chapter 5 「전진타력 및 횡이동 제어」 (183~190쪽)',
    '『선박조종학』 Volume 2 [Ⅲ] Chapter 2 「예선에 의한 조선」 소요 예선 추력',
    '『고등학교 선박 운용』 Ⅴ-2 「출·입항 조종과 정박」 계선줄의 종류와 역할, 접안 조종'
  ]
};
