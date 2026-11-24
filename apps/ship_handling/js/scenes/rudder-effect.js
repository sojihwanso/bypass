/* 3-3 타의 영향: 조타 직후 초기 타력 모멘트, 선회가 진행되며 편각이 생기고 타의 유효입사각이 줄어드는 과정 */
import { SH, DEG, KN } from '../physics/ship.js';
import { maneuver } from '../physics/maneuver.js';
import { RUD } from '../engine/ship.js';
import { Arrow, Ribbon, V3, Line, setLine } from '../engine/draw.js';
import { maneuverField, maneuverSpawn, MBOX } from './zigzag.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const XR = RUD.x - 1.5, STRAIGHTEN = 0.6; /* 프로펠러 배출류가 타 앞 흐름을 곧게 펴 주는 정도(가정) */
export default {
  id: 'rudder-effect', dur: 30, flowVis: 7, life: 2.6, box: MBOX, field: maneuverField, spawn: maneuverSpawn,
  controls: [
    { k: 'del', label: '타각', type: 'seg', opts: [[15, '15°'], [25, '25°'], [35, '35°']], val: 35 },
    { k: 'U', label: '처음 속력', type: 'range', min: 8, max: 20, step: 1, val: 16, fmt: v => v + ' kn' }
  ],
  cam: { r: 560, th: 2.3, ph: 0.48, follow: true }, water: { alpha: 0.55, amp: 0.25 }, parts: ['rudder'],
  legend: [['ink', '선수 방향'], ['amber', '실제로 나아가는 방향'], ['info', '타로 들어오는 물'], ['bad', '타의 직압력'], ['deck', '항적']],
  chartTitle: '타각, 편각, 유효입사각 (모델 값)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, U0 = p.U * KN, del = +p.del;
    const A = maneuver({ U0, dur: 170, K0: 1.6, Tp: 1.3, cY: 0.12, loss: 0.35, cmd: st => st.t < 6 ? 0 : del });
    this.A = A; this.scale = A.dur / this.dur; this.del = del;
    const S = s => s / this.scale;
    const M0 = 14.7 * SH.L * RUD.area * U0 * U0 * Math.sin(2 * del * DEG) / 1000;
    this.M0 = M0;
    this.steps = [
      { t: 0, h: '직진 중', p: `${p.U}노트로 곧게 나아간다. 타는 중앙이고, 선수 방향과 나아가는 방향이 같다.` },
      { t: S(6), h: '조타 직후 초기 타력 모멘트', p: `타를 ${del}° 돌리면 타판에 직압력 N이 생기고, 이 힘이 무게중심을 축으로 배를 돌리는 모멘트가 된다. 초기 타력 모멘트는 M = 14.7·L·A·V²·sin2δ로, 이 조건에서 약 ${fmt(M0, 0)} tf·m다(모델 값). 식으로는 타각 45°에서 가장 크지만 상선은 최대 35°로 제한한다.` },
      { t: S(25), h: '배가 비스듬히 나아간다', p: '선회가 시작되면 선수는 안쪽, 선미는 바깥쪽으로 밀려 배가 비스듬히 나아간다. 선수 방향과 실제로 나아가는 방향 사이의 각이 편각이다. 선체 바깥쪽으로 물이 비스듬히 부딪히는데, 무게중심 뒤쪽 면적이 앞쪽보다 커서 이 수압이 타의 모멘트를 깎는다.' },
      { t: S(55), h: '유효입사각이 줄어든다', p: '선미가 바깥으로 돌며 타로 들어오는 물의 방향도 비스듬해진다. 그래서 물이 타에 닿는 실제 각, 곧 유효입사각은 타각보다 작아지고 타효가 준다. 유효입사각은 대략 타각에서 편각을 뺀 값이지만, 프로펠러 배출류 덕분에 전타 선회에서는 실제 타각의 2/3 정도가 유효하다.' },
      { t: S(110), h: '정상 선회', p: '타의 모멘트와 선체가 받는 저항 모멘트가 맞서 선회율이 일정해진다. 속력도 선회 저항으로 줄어든다. 위에서 타각과 속력을 바꿔 비교해 보자.' }
    ];
    this.rib = Ribbon((() => { const g = []; for (let i = 0; i < A.n; i += 4) g.push([A.X[i], A.Z[i]]); return g; })(), 6, P.deck, 0.6, 0.85); ctx.fxW.add(this.rib);
    this.aH = Arrow(P.ink, 2.4, { top: true }); this.aV = Arrow(P.amber, 2.4, { top: true }); this.aF = Arrow(P.info, 1.6, { top: true }); this.aN = Arrow(P.bad, 1.8, { top: true });
    ctx.fxY.add(this.aH, this.aV, this.aF, this.aN);
    this.arc = Line([V3(), V3(1, 0, 0)], P.amber, { top: true }); ctx.fxY.add(this.arc);
    this.lB = ctx.label('', 'dim', o => o.copy(this.pB || V3())); this.lE = ctx.label('', 'dim', o => o.copy(this.pE || V3()));
    this.st = { u: U0, v: 0, r: 0, n: 60, cref: U0 };
  },
  ang(i) {
    const A = this.A, u = Math.max(0.5, A.u[i]), v = A.v[i], r = A.r[i];
    const beta = Math.atan2(-v, u) / DEG;                    /* 무게중심의 편각(+ 바깥쪽) */
    const betaR = Math.atan2(-(v + r * XR), u) / DEG;        /* 타 위치에서 흐름이 비스듬한 각 */
    const d = A.del[i] / DEG, eff = Math.max(0, d - STRAIGHTEN * betaR);
    return { beta, betaR, d, eff };
  },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))), ship = this.ctx.ship;
    ship.pose(A.X[i], A.Z[i], A.psi[i], A.phi[i]); ship.rudder.rotation.y = A.del[i];
    this.rib.setCount(i / 4); this.i = i; this.ts = ts;
    const a = this.ang(i); this.cur = a;
    const W = v => { ship.yaw.updateMatrixWorld(); return v.applyMatrix4(ship.yaw.matrixWorld); };
    const y = 30, b = a.beta * DEG;
    this.aH.set(V3(0, y, 0), V3(1, 0, 0), 150); this.aV.set(V3(0, y, 0), V3(Math.cos(b), 0, -Math.sin(b)), 150);
    const pts = []; for (let k = 0; k <= 16; k++) { const q = -b * k / 16; pts.push(V3(90 * Math.cos(q), y, 90 * Math.sin(q))); } setLine(this.arc, pts); this.arc.visible = a.beta > 0.3;
    this.pB = W(V3(110, y + 6, -40 * Math.sign(b || 1))); this.lB.set(a.beta > 0.3 ? `<b style="color:var(--amber)">편각 ${fmt(a.beta, 1)}°</b>` : '');
    const fb = a.betaR * DEG, fdir = V3(-Math.cos(fb), 0, Math.sin(fb)), Rp = V3(XR, -6, 0);
    this.aF.set(Rp.clone().addScaledVector(fdir, -42), fdir, 38);
    const dr = A.del[i], N = Math.sin(a.eff * DEG);
    this.aN.set(Rp, V3(-Math.sin(dr), 0, -Math.cos(dr)), Math.max(0.1, N * 80));
    this.pE = W(V3(XR - 30, 6, 20)); this.lE.set(a.d > 0.5 ? `<b style="color:var(--info)">유효입사각 ${fmt(a.eff, 0)}°</b><i>타각 ${fmt(a.d, 0)}°</i>` : '');
    Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i] });
  },
  read() {
    const A = this.A, i = this.i, a = this.cur, u = A.u[i];
    const M = 14.7 * SH.L * RUD.area * u * u * Math.sin(2 * a.eff * DEG) / 1000;
    return [['경과 시간', realTime(this.ts)], ['타각', fmt(a.d, 1) + '°'], ['편각 (무게중심)', fmt(a.beta, 1) + '°'], ['타 앞 흐름의 기울기', fmt(a.betaR, 1) + '°'], ['유효입사각', fmt(a.eff, 1) + '°' + (a.d > 1 ? ` (타각의 ${fmt(a.eff / a.d * 100, 0)}%)` : '')], ['선속', fmt(u / KN, 1) + ' kn'], ['선회율', fmt(A.r[i] / DEG * 60, 0) + '°/분'], ['타 모멘트 (근사)', fmt(M, 0) + ' tf·m', M < this.M0 * 0.7 ? 'warn' : '']];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, d = [], b = [], e = []; for (let i = 0; i < A.n; i += 6) { const a = this.ang(i); d.push([i * A.dt, a.d]); b.push([i * A.dt, a.beta]); e.push([i * A.dt, a.eff]); }
    lineChart(cv, P, { x0: 0, x1: A.dur, upto: this.ts, cursor: this.ts, xt: [[0, '0'], [60, '1분'], [120, '2분']], series: [{ data: d, color: P.bad, min: 0, max: 40, yt: [0, 20, 35], label: '타각 °' }, { data: e, color: P.info, min: 0, max: 40, label: '유효입사각 °' }, { data: b, color: P.amber, min: 0, max: 40, label: '편각 °', width: 1.5 }] });
  }
};
