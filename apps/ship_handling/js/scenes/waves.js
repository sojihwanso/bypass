/* 7-6 파랑: 조우 주기와 자유 횡요 주기가 같아지면 롤링이 커진다(동조 횡요). 파랑 속 위험 현상들 */
import { SH, DEG, KN } from '../physics/ship.js';
import { Arrow, V3 } from '../engine/draw.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const GM = 1.8, TR = 0.8 * SH.B / Math.sqrt(GM), ZETA = 0.08; /* 자유 횡요 주기 T_R = 0.8B/√GM, 감쇠비(가정) */
/* λ = 1.56·Tw², 파속 Vw = 1.25·√λ, 조우 주기 Te = λ / |Vw − V·cosχ| (χ: 파도 진행 방향과 침로 사이 각, 0 = 추종파) */
export function encounter(Tw, Vkn, chi) { const lam = 1.56 * Tw * Tw, Vw = 1.25 * Math.sqrt(lam), V = Vkn * KN, rel = Vw - V * Math.cos(chi * DEG); return { lam, Vw, Te: Math.abs(rel) < 0.05 ? 999 : lam / Math.abs(rel) }; }
const amp = r => 1 / Math.sqrt((1 - r * r) ** 2 + (2 * ZETA * r) ** 2);
export default {
  id: 'waves', dur: 30, scale: 1,
  controls: [
    { k: 'chi', label: '파도를 받는 방향', type: 'seg', opts: [[180, '선수파'], [90, '횡파'], [45, '선미 사파'], [0, '추종파']], val: 45 },
    { k: 'Tw', label: '파도 주기', type: 'range', min: 6, max: 16, step: 1, val: 6, fmt: v => v + ' 초' },
    { k: 'V', label: '선속', type: 'range', min: 4, max: 20, step: 2, val: 20, fmt: v => v + ' kn' }
  ],
  cam: { r: 560, th: 2.4, ph: 1.2 }, water: { alpha: 0.7, amp: 2.2 }, parts: ['hull', 'propeller'],
  legend: [['info', '파도 진행 방향'], ['amber', '롤링 증폭']],
  chartTitle: '조우 주기 / 자유 횡요 주기에 따른 롤링 증폭 (모델 값)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, e = encounter(p.Tw, p.V, p.chi); this.e = e; this.ratio = TR / e.Te; this.A = Math.min(12, 2.2 * amp(this.ratio));
    this.aW = Arrow(P.info, 4, { top: true }); ctx.fxW.add(this.aW); const c = p.chi * DEG; this.aW.set(V3(-260 * Math.cos(c), 30, -260 * Math.sin(c)), V3(Math.cos(c), 0, Math.sin(c)), 160);
    this.steps = [
      { t: 0, h: '파도가 주는 충격', p: '바닷물 덩어리가 선체에 주는 충격은 1 m²에 1톤이 넘는다. 배가 작을수록 영향이 크다. 거친 바다에서는 롤링, 피칭, 히빙, 요잉이 크게 일어난다.' },
      { t: 5, h: '파도 방향별 위험', p: '선수파에서 큰 피칭은 프로펠러를 물 밖으로 들어 공회전(racing)시키고, 선수 선저가 수면을 때리는 슬래밍과 선수가 파도에 얻어맞는 팬팅을 부른다. 추종파가 선미를 덮치면 푸핑다운, 횡파는 과도한 롤링을 부른다.' },
      { t: 11, h: '추종파에서', p: '파도를 따라 내려갈 때 요잉으로 선수방위가 갑자기 흔들려 파도와 나란히 놓이는 브로칭이 일어날 수 있다. 배와 파도의 속도 차가 작을 때 잘 생긴다. 작고 가벼운 배는 선수가 앞 파도 뒷면에 박혀 재주넘듯 뒤집히는 피치 폴링도 있다.' },
      { t: 18, h: '동조 횡요', p: `배가 만나는 파도의 주기(조우 주기 Te)가 자유 횡요 주기 T<sub>R</sub>(= 0.8B/√GM, 대상선 약 ${fmt(TR, 0)}초)와 같아지면 롤링이 크게 불어난다. 지금 Te는 약 ${fmt(Math.min(e.Te, 99), 1)}초, 비율 T<sub>R</sub>/Te = ${fmt(this.ratio, 2)}다. 갑자기 크게 기우는 lurch는 전복으로 이어질 수 있다.` },
      { t: 25, h: '피하는 법', p: '침로나 속력을 바꿔 조우 주기를 자유 횡요 주기에서 떼어 놓는다. 선수파에서 피칭 주기와 조우 주기가 같아지는 속력(동조 종요)도 슬래밍이 심해지므로 피한다.' }
    ];
  },
  apply(t) {
    const ship = this.ctx.ship, Te = Math.min(this.e.Te, 60), w = 2 * Math.PI / Te, p = this.p;
    const roll = this.A * Math.sin(w * t) * Math.max(0.5, Math.abs(Math.sin(p.chi * DEG)));
    const pitch = 1.2 * Math.cos(w * t) * Math.abs(Math.cos(p.chi * DEG)), heave = 1.0 * Math.sin(w * t + 0.6);
    ship.pose(0, 0, 0, roll * DEG, pitch * DEG, heave); this.roll = roll; this.ctx.ship.prop.rotation.x = -t * 6;
  },
  read() {
    const e = this.e;
    return [['파장 λ = 1.56·Tw²', fmt(e.lam, 0) + ' m'], ['파속 Vw = 1.25·√λ', fmt(e.Vw, 1) + ' m/s'], ['조우 주기 Te', e.Te > 99 ? '아주 김(파도와 같이 감)' : fmt(e.Te, 1) + ' 초'], ['자유 횡요 주기 T_R', fmt(TR, 1) + ' 초 (GM ' + GM + ' m)'], ['T_R / Te', fmt(this.ratio, 2), Math.abs(this.ratio - 1) < 0.15 ? 'bad' : Math.abs(this.ratio - 1) < 0.35 ? 'warn' : 'ok'], ['롤링 (그림)', fmt(Math.abs(this.roll || 0), 1) + '° (모델 값)']];
  },
  chart(cv, P, { lineChart }) {
    const a = []; for (let r = 0.2; r <= 2.4; r += 0.02) a.push([r, amp(r)]);
    lineChart(cv, P, { x0: 0.2, x1: 2.4, xt: [[0.5, '0.5'], [1, '1 (동조)'], [2, '2']], series: [{ data: a, color: P.amber, min: 0, max: 7, yt: [0, 2, 4, 6], label: '증폭 배율', mark: [Math.min(2.4, Math.max(0.2, this.ratio)), amp(Math.min(2.4, Math.max(0.2, this.ratio)))] }] });
  }
};
