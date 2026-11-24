/* 5-3 추진력과 슬립: 프로펠러는 한 바퀴에 피치만큼 나아가려 하지만 실제로는 덜 나아간다 */
import { SH, KN } from '../physics/ship.js';
import { PROP, apparentSlip } from '../physics/propeller.js';
import { Arrow, Line, V3, setLine } from '../engine/draw.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const WAKE = 0.25; /* 반류 비율(가정): 프로펠러 위치의 물이 배를 따라오는 정도 */
export default {
  id: 'thrust', dur: 24, scale: 1, flowVis: 2.4, life: 2.2, noHull: true,
  controls: [
    { k: 'rpm', label: '프로펠러 회전수', type: 'range', min: 30, max: 110, step: 5, val: 80, fmt: v => v + ' RPM' },
    { k: 'U', label: '선속', type: 'range', min: 0, max: 24, step: 1, val: 18, fmt: v => v + ' kn' }
  ],
  cam: { r: 70, th: 1.85, ph: 1.45, target: () => V3(PROP.x + 8, -9, 0) }, water: { alpha: 0.15, amp: 0 }, parts: ['propeller'],
  legend: [['amber', '이론상 나아감 (피치 × 회전)'], ['deck', '실제 선속'], ['info', '물에 대한 프로펠러 속도'], ['bad', '슬립']],
  chartTitle: '선속에 따른 겉보기 슬립비 (이 회전수에서)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P; ctx.ship.pose(0, 0, 0); ctx.ship.setOpacity(0.55);
    const n = p.rpm / 60, Pn = PROP.P * n, V = p.U * KN, Vp = V * (1 - WAKE);
    this.k = { n, Pn, V, Vp, sA: apparentSlip(PROP.P, p.rpm, V), sR: Pn > 0 ? 1 - Vp / Pn : null };
    this.steps = [
      { t: 0, h: '피치', p: `이 프로펠러의 피치는 ${fmt(PROP.P, 1)} m다. 물이 단단한 너트라면 한 바퀴 돌 때 나사처럼 피치만큼 나아간다(모델 값).` },
      { t: 6, h: '이론상 속도 P·n', p: `분당 ${p.rpm}번 돌면 이론상 초당 ${fmt(Pn, 2)} m(약 ${fmt(Pn / KN, 1)}노트) 나아가야 한다. 주황 화살표가 이 길이다.` },
      { t: 12, h: '겉보기 슬립', p: `실제 선속 V는 이보다 작다. 그 차이 P·n − V가 겉보기 슬립이고, 비율 1 − V/(P·n)이 겉보기 슬립비다. 지금은 ${this.k.sA == null ? '—' : fmt(this.k.sA * 100, 0) + '%'}다.` },
      { t: 18, h: '반류와 실제 슬립', p: `배 주변의 물은 배에 끌려 같은 방향으로 따라온다(반류, wake). 그래서 물에 대한 프로펠러의 속도는 V − 반류 속도로 더 작고, 이것으로 잰 실제 슬립비는 겉보기 슬립비보다 크다. 이 장면은 반류를 선속의 ${WAKE * 100}%로 가정했다.` }
    ];
    const y = -SH.T + PROP.y - PROP.R - 3, z = 12;
    this.aT = Arrow(P.amber, 0.45, { top: true }); this.aV = Arrow(P.deck, 0.45, { top: true }); this.aP = Arrow(P.info, 0.45, { top: true }); ctx.fxY.add(this.aT, this.aV, this.aP);
    this.slip = Line([V3(), V3(1, 0, 0)], P.bad, { top: true }); ctx.fxY.add(this.slip);
    this.base = V3(PROP.x, y, z); this.sc = 2.4; /* 1 m/s = 2.4 m로 그림 */
    this.lT = ctx.label('', 'dim', o => o.copy(this.pT || V3())); this.lV = ctx.label('', 'dim', o => o.copy(this.pV || V3())); this.lS = ctx.label('', 'dim', o => o.copy(this.pS || V3()));
    this.st = { u: V, v: 0, r: 0, n: p.rpm, cref: Math.max(V, 2), jref: 7 };
  },
  apply(t) {
    const k = this.k, ship = this.ctx.ship, b = this.base, s = this.sc, W = v => { ship.yaw.updateMatrixWorld(); return v.applyMatrix4(ship.yaw.matrixWorld); };
    ship.prop.rotation.x = -t * 2 * Math.PI * Math.min(1.5, k.n);
    const show = t >= 6;
    this.aT.set(b.clone().add(V3(0, 4, 0)), V3(1, 0, 0), show ? k.Pn * s : 0.01);
    this.aV.set(b.clone(), V3(1, 0, 0), t >= 12 ? Math.max(0.06, k.V * s) : 0.01);
    this.aP.set(b.clone().add(V3(0, -4, 0)), V3(1, 0, 0), t >= 18 ? Math.max(0.06, k.Vp * s) : 0.01);
    const x0 = b.x + (t >= 12 ? k.V * s : 0), x1 = b.x + k.Pn * s; setLine(this.slip, [V3(x0, b.y + 2, b.z), V3(x1, b.y + 2, b.z)]); this.slip.visible = t >= 12 && x1 > x0 + 0.1;
    this.pT = W(V3(b.x + k.Pn * s / 2, b.y + 7, b.z)); this.lT.set(show ? `<b style="color:var(--amber)">P·n ${fmt(k.Pn / KN, 1)} kn</b>` : '');
    this.pV = W(V3(b.x + k.V * s / 2, b.y - 1.5, b.z)); this.lV.set(t >= 12 ? `<b style="color:var(--deck)">선속 V ${fmt(this.p.U, 0)} kn</b>` : '');
    this.pS = W(V3((x0 + x1) / 2, b.y + 4, b.z)); this.lS.set(t >= 12 && this.slip.visible ? `<b style="color:var(--bad)">슬립</b>` : '');
  },
  read() {
    const k = this.k;
    return [['피치 P', fmt(PROP.P, 1) + ' m (모델 값)'], ['회전수', this.p.rpm + ' RPM (' + fmt(k.n, 2) + ' rps)'], ['이론상 속도 P·n', fmt(k.Pn, 2) + ' m/s (' + fmt(k.Pn / KN, 1) + ' kn)'], ['선속 V', fmt(this.p.U, 0) + ' kn'],
      ['겉보기 슬립비', k.sA == null ? '—' : fmt(k.sA * 100, 0) + '%', k.sA != null && k.sA < 0 ? 'warn' : ''], ['물에 대한 프로펠러 속도', fmt(k.Vp / KN, 1) + ' kn (반류 ' + WAKE * 100 + '% 가정)'], ['실제 슬립비', k.sR == null ? '—' : fmt(k.sR * 100, 0) + '%']];
  },
  chart(cv, P, { lineChart }) {
    const a = []; for (let u = 0; u <= 24; u += 0.5) { const s = apparentSlip(PROP.P, this.p.rpm, u * KN); if (s != null) a.push([u, s * 100]); }
    lineChart(cv, P, { x0: 0, x1: 24, xt: [[0, '0'], [12, '12 kn'], [24, '24 kn']], series: [{ data: a, color: P.bad, min: -20, max: 100, yt: [0, 50, 100], hlines: [0], label: '겉보기 슬립비 %', mark: [this.p.U, (this.k.sA ?? 0) * 100] }] });
  }
};
