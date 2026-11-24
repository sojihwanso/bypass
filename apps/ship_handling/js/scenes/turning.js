/* 4-3 선회권: 전타 선회의 무게중심 항적과 종거·횡거·선회경·최종 선회경·킥 */
import { SH, DEG, KN } from '../physics/ship.js';
import { maneuver } from '../physics/maneuver.js';
import { Ribbon, Line, Dot, V3 } from '../engine/draw.js';
import { maneuverField, maneuverSpawn, MBOX } from './zigzag.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const TURN = { K0: 1.85, Tp: 1.74, cY: 0.33, loss: 0.71, tauU: 200, drift: 0.09, nonlin: true };   /* 『선박조종학』 4권 표 4.1.4(16.6노트, 35° 종거 3.26L·횡거 1.70L·선회경 3.85L, 15° 선회경 6.36L)에 맞춘 모델 값 */
export function turnRun(U0, del, dur = 1100) {
  return maneuver({ U0, dur, ...TURN, cmd: st => st.t < 5 ? 0 : del, stop: st => st.psi > 372 * DEG });
}
export function turnMeasures(A) {
  const at = deg => { for (let i = 0; i < A.n; i++) if (A.psi[i] >= deg * DEG) return i; return A.n - 1; };
  const i0 = Math.round(5 / A.dt), X0 = A.X[i0], i90 = at(90), i180 = at(180), e = A.n - 1;
  let ik = i0, kick = 0, mxA = 0, mxT = 0; for (let i = i0; i < at(45); i++) if (A.Z[i] < kick) { kick = A.Z[i]; ik = i; }
  let sk = 0, isk = i0; for (let i = i0; i < at(12); i++) { const zs = A.Z[i] - Math.sin(A.psi[i]) * SH.L / 2; if (zs < sk) { sk = zs; isk = i; } }
  for (let i = i0; i < A.n; i++) { mxA = Math.max(mxA, A.X[i] - X0); mxT = Math.max(mxT, A.Z[i]); }
  return { i0, X0, i90, i180, e, ifd: at(300), adv: A.X[i90] - X0, tr: A.Z[i90], td: A.Z[i180], fd: 2 * A.u[e] / Math.max(1e-4, A.r[e]), kick: -kick, ik, sk: -sk, isk, mxA, mxT };
}
export default {
  id: 'turning', dur: 36, flowVis: 9, life: 2.6, box: MBOX, field: maneuverField, spawn: maneuverSpawn,
  controls: [
    { k: 'del', label: '타각', type: 'seg', opts: [[15, '15°'], [25, '25°'], [35, '35°']], val: 35 },
    { k: 'U', label: '처음 속력', type: 'range', min: 8, max: 20, step: 1, val: 16, fmt: v => v + ' kn' }
  ],
  get cam() { return { r: this.camR || 2400, th: 2.2, ph: 0.3, target: () => this.center.clone() }; },
  water: { alpha: 0.6, amp: 0.25 }, parts: ['rudder'],
  legend: [['deck', '무게중심 항적'], ['muted', '원침로'], ['amber', '종거·횡거'], ['info', '선회경'], ['bad', '킥']],
  chartTitle: '선수방위 변화와 선속 (시간)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, U0 = p.U * KN, del = +p.del;
    const A = turnRun(U0, del); this.A = A; const m = turnMeasures(A); this.m = m; this.scale = A.dur / this.dur;
    const S = s => s / this.scale, tAt = i => i * A.dt;
    this.steps = [
      { t: 0, h: '직진', p: `${p.U}노트로 곧게 나아간다. 점선이 원침로다.` },
      { t: S(5), h: `${del}° 전타`, p: '타를 쓴 지점에서 선수가 돌기 시작한다. 선회권은 이때부터 배의 무게중심이 그리는 항적이다.' },
      { t: S(tAt(m.ik)), h: `킥 ${fmt(m.kick, 0)} m`, p: '타의 힘이 선미를 바깥으로 밀어 무게중심도 원침로 바깥쪽으로 잠깐 밀린다. 이 거리가 킥이다. 보통 배 길이의 2~4%다.' },
      { t: S(tAt(m.i90)), h: '90° 회두: 종거와 횡거', p: `선수가 90° 돌았을 때 원침로 방향으로 나아간 거리가 종거(Advance) ${fmt(m.adv / SH.L, 1)}L, 옆으로 옮겨 간 거리가 횡거(Transfer) ${fmt(m.tr / SH.L, 1)}L이다(모델 값).` },
      { t: S(tAt(m.i180)), h: '180° 회두: 선회경', p: `선수가 180° 돌았을 때 원침로에서 옆으로 떨어진 거리가 선회경(Tactical diameter) ${fmt(m.td / SH.L, 1)}L이다. 비대한 배는 약 3L, 날씬한 배는 4.5L 안팎이다.` },
      { t: S(tAt(m.ifd)), h: '정상 선회', p: `선회율과 속력이 일정해지면 지름이 일정한 원을 돈다. 이 원의 지름이 최종 선회경(Final diameter) ${fmt(m.fd / SH.L, 1)}L이다. 타각, 선형, 적재 상태, 수심, 트림이 선회권 크기를 바꾼다.` }
    ];
    this.rib = Ribbon((() => { const g = []; for (let i = 0; i < A.n; i += 4) g.push([A.X[i], A.Z[i]]); return g; })(), 16, P.deck, 0.6, 0.9); ctx.fxW.add(this.rib);
    const X0 = m.X0, y = 1.2;
    ctx.fxW.add(Line([V3(X0 - 600, 0.7, 0), V3(X0 + m.mxA + 500, 0.7, 0)], P.muted, { dash: 30 }));
    const dim = (a, b, c) => { const l = Line([a, b], c, { top: true }); ctx.fxW.add(l); return l; };
    const X90 = A.X[m.i90], Z90 = A.Z[m.i90], Z180 = A.Z[m.i180], X180 = A.X[m.i180];
    this.dAdv = dim(V3(X0, y, -60), V3(X90, y, -60), P.amber); this.dAdv2 = dim(V3(X90, y, -80), V3(X90, y, Z90), P.amber);
    this.dTr = dim(V3(X90 + 40, y, 0), V3(X90 + 40, y, Z90), P.amber);
    this.dTd = dim(V3(X180, y, 0), V3(X180, y, Z180), P.info);
    const c = V3(A.X[m.e] - Math.sin(A.psi[m.e]) * m.fd / 2, y, A.Z[m.e] + Math.cos(A.psi[m.e]) * m.fd / 2), cp = []; for (let k = 0; k <= 72; k++) { const a = k / 72 * 2 * Math.PI; cp.push(V3(c.x + m.fd / 2 * Math.cos(a), y, c.z + m.fd / 2 * Math.sin(a))); }
    this.fdC = Line(cp, P.info, { dash: 16, opacity: 0.8 }); ctx.fxW.add(this.fdC);
    this.kDot = Dot(P.bad, 12); this.kDot.position.set(A.X[m.ik], y, A.Z[m.ik]); ctx.fxW.add(this.kDot); this.wo = Dot(P.amber, 12); this.wo.position.set(X0, y, 0); ctx.fxW.add(this.wo);
    const L = (txt, fn) => ctx.label(txt, 'dim', fn);
    this.lAdv = L('', o => o.set((X0 + X90) / 2, 20, -110)); this.lTr = L('', o => o.set(X90 + 120, 20, Z90 / 2)); this.lTd = L('', o => o.set(X180 - 90, 20, Z180 / 2)); this.lFd = L('', o => o.set(c.x, 20, c.z)); this.lK = L('', o => o.set(A.X[m.ik], 20, A.Z[m.ik] - 70));
    L('<b style="color:var(--amber)">타를 쓴 곳</b>', o => o.set(X0, 20, -40));
    let mx = X0, Mx = X0, mz = -50, Mz = 0; for (let i = 0; i < A.n; i++) { mx = Math.min(mx, A.X[i]); Mx = Math.max(Mx, A.X[i]); mz = Math.min(mz, A.Z[i]); Mz = Math.max(Mz, A.Z[i]); }
    this.center = V3((mx + Mx) / 2, 0, (mz + Mz) / 2); this.camR = Math.max(Mx - mx, Mz - mz) * 1.45 + 300;
    this.st = { u: U0, v: 0, r: 0, n: 60, cref: U0 };
  },
  apply(t) {
    const A = this.A, m = this.m, ts = t * this.scale, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))), ship = this.ctx.ship;
    ship.pose(A.X[i], A.Z[i], A.psi[i], A.phi[i]); ship.rudder.rotation.y = A.del[i];
    this.rib.setCount(i / 4); this.i = i; this.ts = ts;
    const sh = (o, on) => { o.visible = on; };
    sh(this.dAdv, i >= m.i90); sh(this.dAdv2, i >= m.i90); sh(this.dTr, i >= m.i90); sh(this.dTd, i >= m.i180); sh(this.fdC, i >= m.ifd); sh(this.kDot, i >= m.ik);
    this.lAdv.set(i >= m.i90 ? `<b style="color:var(--amber)">종거 ${fmt(m.adv, 0)} m</b>` : ''); this.lTr.set(i >= m.i90 ? `<b style="color:var(--amber)">횡거 ${fmt(m.tr, 0)} m</b>` : '');
    this.lTd.set(i >= m.i180 ? `<b style="color:var(--info)">선회경 ${fmt(m.td, 0)} m</b>` : ''); this.lFd.set(i >= m.ifd ? `<b style="color:var(--info)">최종 선회경 ${fmt(m.fd, 0)} m</b>` : ''); this.lK.set(i >= m.ik ? `<b style="color:var(--bad)">킥 ${fmt(m.kick, 0)} m</b>` : '');
    Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i] });
  },
  read() {
    const A = this.A, m = this.m, i = this.i, L = v => fmt(v, 0) + ' m (' + fmt(v / SH.L, 2) + 'L)';
    return [['경과 시간', realTime(this.ts)], ['선수방위 변화', fmt(A.psi[i] / DEG, 0) + '°'], ['선속', fmt(A.u[i] / KN, 1) + ' kn (처음의 ' + fmt(A.u[i] / A.u[0] * 100, 0) + '%)'],
      ['킥', i >= m.ik ? L(m.kick) : '—'], ['종거 Advance', i >= m.i90 ? L(m.adv) : '—'], ['횡거 Transfer', i >= m.i90 ? L(m.tr) : '—'], ['선회경 Tactical diameter', i >= m.i180 ? L(m.td) : '—'], ['최종 선회경 Final diameter', i >= m.ifd ? L(m.fd) : '—'], ['최대 종거 / 최대 횡거', i >= m.ifd ? fmt(m.mxA, 0) + ' / ' + fmt(m.mxT, 0) + ' m' : '—']];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, h = [], s = []; for (let i = 0; i < A.n; i += 6) { h.push([i * A.dt, A.psi[i] / DEG]); s.push([i * A.dt, A.u[i] / KN]); }
    lineChart(cv, P, { x0: 0, x1: A.dur, upto: this.ts, cursor: this.ts, right: true, xt: [[0, '0'], [120, '2분'], [240, '4분'], [360, '6분']].filter(x => x[0] <= A.dur), series: [{ data: h, color: P.deck, min: 0, max: 380, yt: [0, 90, 180, 360], hlines: [90, 180], label: '선수방위 변화 °' }, { data: s, color: P.info, min: 0, max: 22, yt: [0, 10, 20], axis: true, label: '선속 kn' }] });
  }
};
