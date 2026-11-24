/* 5-3 추진력과 슬립 */
const fig = `<svg viewBox="0 0 360 150" role="img" aria-label="이론상 프로펠러 이동 속도, 선속, 반류, 물에 대한 프로펠러 속도, 겉보기 슬립과 실제 슬립의 관계"><g fill="none" stroke="currentColor" stroke-width="1.6">
<path d="M20 30 L330 30"/><path d="M322 25 l9 5 -9 5"/><path d="M20 66 L250 66"/><path d="M242 61 l9 5 -9 5"/><path d="M20 102 L190 102"/><path d="M182 97 l9 5 -9 5"/>
<path d="M250 70 L330 70" stroke-dasharray="4 3"/><path d="M190 106 L330 106" stroke-dasharray="4 3"/><path d="M190 120 L250 120" stroke-width="1"/></g>
<g fill="currentColor" font-size="11"><text x="20" y="22">이론상 프로펠러 이동 속도 P·n</text><text x="20" y="58">선속 Vs</text><text x="20" y="94">물에 대한 프로펠러 속도 Vp = Vs − Vw</text>
<text x="258" y="84">겉보기 슬립</text><text x="258" y="122">실제 슬립</text><text x="196" y="134">반류 Vw</text></g></svg>`;
export default {
  scene: 'thrust',
  lede: '프로펠러는 물을 뒤로 밀어 그 반작용으로 배를 민다. 이론상으로는 한 바퀴에 피치만큼 나아가지만 물은 단단하지 않아 실제로는 덜 나아간다. 그 모자란 몫이 슬립이다.',
  blocks: [
    { type: 'h', text: '전진 추력과 후진 추력' },
    { type: 'p', html: '대부분의 상선은 선미에서 보아 전진할 때 시계 방향으로 도는 <b>우회전 프로펠러</b>를 단다. 날개 면에 생기는 물의 반작용 가운데 앞뒤 성분이 <b>전진 추력</b>, 옆 성분이 선미를 옆으로 미는 <b>횡압력</b>이다. 반대로 돌리면 앞뒤 성분이 <b>후진 추력</b>이 되고, 횡압력은 전진 때와 반대로 작용한다.' },
    { type: 'formula', lines: ['T = K<sub>T</sub> · ρ · n² · D⁴'], note: 'K<sub>T</sub>: 추력 계수(모형 시험으로 구한다), ρ: 물의 밀도, n: 초당 회전수, D: 프로펠러 지름. 같은 프로펠러라도 슬립비가 클수록 K<sub>T</sub>가 커진다. 배가 멈춘 채 돌리는 부스팅 상태(슬립비 1.0)에서 K<sub>T</sub>는 0.4~0.5다.' },
    { type: 'h', text: '피치와 슬립' },
    { type: 'p', html: '피치가 P m인 프로펠러는 한 바퀴에 P m, 분당 n번 돌면 분당 P·n m 나아가야 한다. 실제 선속 V는 이보다 작고, 그 차이 <b>P·n − V</b>가 <b>겉보기 슬립(apparent slip)</b>이다.' },
    { type: 'formula', lines: ['겉보기 슬립비 s<sub>a</sub> = 1 − V / (P·n)', '실제 슬립비 s<sub>r</sub> = 1 − V<sub>p</sub> / (P·n),   V<sub>p</sub> = V − V<sub>w</sub>'], note: '배 주변의 물은 배에 끌려 같은 방향으로 따라온다. 이것이 반류(wake), 그 속도가 V<sub>w</sub>다. 물에 대한 프로펠러의 속도 V<sub>p</sub>는 반류만큼 작아 실제 슬립이 겉보기 슬립보다 크다.' },
    { type: 'figure', svg: fig, caption: '화살표 길이는 크기 관계만 나타낸 모식이다.' },
    { type: 'note', html: '장면의 피치 8.6 m, 반류 25%는 모델의 가정값이다. 선속이 P·n보다 빠르면(예: 기관을 줄였는데 배가 관성으로 빠를 때) 겉보기 슬립비는 음수가 된다.' }
  ],
  sources: [
    '강의 슬라이드 S8 「주기관과 프로펠러」 9쪽',
    '『선박조종학』 Volume 2 [Ⅱ] Chapter 2 「Propeller」 3. 프로펠러의 추진력 (81~83쪽), Chapter 3 「선속과 타력」 1.1 추력 (92~93쪽)'
  ]
};
