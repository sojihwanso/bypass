/* 8-2 변침과 조타 계획: 신침로 거리로 조타 개시 시점(Wheel over point)을 잡고, 반대타로 정침 */
import { SH, DEG, KN } from '../physics/ship.js';
import { maneuver } from '../physics/maneuver.js';
import { Ribbon, Line, Dot, V3, arcPts } from '../engine/draw.js';
import { maneuverField, maneuverSpawn, MBOX } from './zigzag.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const Tp = 1.2, Kp = 1.5;
export function newCourseDistance(U, psiDeg, delDeg) {
  const T = Tp * SH.L / U, K = Kp * U / SH.L, t0 = delDeg / 2.32, R = U / (K * delDeg * DEG);
  return { AB: U * (T + t0 / 2), BC: R * Math.tan(psiDeg * DEG / 2), T, K, R, t0 };
}
export default {
  id: 'alter', dur: 36, flowVis: 9, life: 2.6, box: MBOX, field: maneuverField, spawn: maneuverSpawn,
  controls: [
    { k: 'when', label: '조타 시점', type: 'seg', opts: [['calc', '신침로 거리 앞'], ['late', '변침점에서'], ['early', '너무 일찍']], val: 'calc' },
    { k: 'psi', label: '변침각', type: 'range', min: 20, max: 90, step: 5, val: 60, fmt: v => v + '°' },
    { k: 'del', label: '사용 타각', type: 'seg', opts: [[10, '10°'], [20, '20°']], val: 20 }
  ],
  cam: { r: 3200, th: 2.4, ph: 0.42 }, water: { alpha: 0.62, amp: 0.3 }, parts: ['rudder', 'radar'],
  legend: [['ink', '계획 항로'], ['deck', '실제 항적'], ['amber', '조타 개시점'], ['bad', '변침점']],
  chartTitle: '선수방위와 타각 (시간)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, U = 16 * KN, psiC = p.psi, del = +p.del, W = 3000;
    const nc = newCourseDistance(U, psiC, del); this.nc = nc; const AC = nc.AB + nc.BC; this.AC = AC;
    const Xw = p.when === 'calc' ? W - AC : p.when === 'late' ? W : W - 2.2 * AC; this.Xw = Xw;
    let ph = 0; const ev = {};
    const A = maneuver({ U0: U, dur: 1400, K0: Kp, Tp, cY: 0.12, loss: 0.15, cmd: st => {
      const d = st.psi / DEG, rd = st.r / DEG;
      if (ph === 0) { if (st.X >= Xw) { ph = 1; ev.wo = st.t; } return 0; }
      if (ph === 1) { if (d >= psiC - rd * nc.T * 0.9) { ph = 2; ev.check = st.t; } return del; }
      if (ph === 2) { if (rd <= 0.02) { ph = 3; ev.steady = st.t; } return -del * 0.5; }
      return Math.max(-10, Math.min(10, 1.5 * (psiC - d) - 25 * rd));
    }, stop: st => ph === 3 && st.t > (ev.steady || 0) + 200 });
    this.A = A; this.ev = ev; this.scale = A.dur / this.dur;
    /* 새 침로 위에서의 이탈 거리 */
    const c = Math.cos(psiC * DEG), s = Math.sin(psiC * DEG), xte = i => (A.Z[i] - 0) * c - (A.X[i] - W) * s;
    this.xteEnd = xte(A.n - 1); let mx = 0; for (let i = 0; i < A.n; i++) if (A.X[i] > W - 50 || A.psi[i] > 5 * DEG) mx = Math.max(mx, Math.abs(xte(i)));
    let pk = 0; for (let i = 0; i < A.n; i++) pk = Math.max(pk, A.psi[i] / DEG); this.os = pk - psiC;
    const S = t => t / this.scale;
    const tag = { calc: '신침로 거리만큼 앞에서', late: '변침점에 닿아서야', early: '필요한 것보다 훨씬 일찍' }[p.when];
    this.steps = [
      { t: 0, h: '변침 계획', p: `원침로에서 우현으로 ${psiC}° 바꿔 새 침로에 올라야 한다. 계획 항로의 꺾이는 점(변침점)은 앞쪽 ${fmt(W / 1852, 1)}해리에 있다. 선회 반응 지연과 선회 반지름 때문에 변침점에서 타를 쓰면 늦다.` },
      { t: S(ev.wo || 0), h: '조타 개시', p: `${tag} 타를 ${del}° 쓴다. 신침로 거리 AC = V(T + t₀/2) + R·tan(ψ/2) ≈ ${fmt(AC, 0)} m (${fmt(AC / SH.L, 1)}L). 앞의 항은 반응 지연 동안 나아가는 거리(Reach), 뒤의 항은 선회 반지름이 만드는 거리다.` },
      { t: S((ev.wo || 0) + nc.T * 0.6), h: '회두가 붙는다', p: '타가 다 돌아간 뒤에도 선회율이 서서히 붙는다. 선미는 바깥으로 밀리고(킥), 속력이 조금 준다. 회두각과 선회율(ROT)을 계속 확인한다.' },
      { t: S(ev.check || 0), h: '반대타로 선회를 꺾는다', p: '새 침로에 닿기 전에, 남은 회두 관성으로 더 돌 각(선회율 × T)만큼 미리 반대타를 써서 선회를 줄인다. 이 시점이 늦으면 새 침로를 지나친다(오버슈트).' },
      { t: S(ev.steady || 0), h: '정침', p: `선회가 멈추면 작은 타로 새 침로 ${psiC}°에 맞춘다. 이 조타의 오버슈트는 ${fmt(Math.max(0, this.os), 1)}°, 새 침로에서 옆으로 벗어난 거리는 ${fmt(Math.abs(this.xteEnd), 0)} m(${this.xteEnd > 0 ? '선회 안쪽' : '선회 바깥쪽'})다.` }
    ];
    /* 그리기: 계획 항로, 변침점, 조타 개시점, 항적 */
    ctx.fxW.add(Line([V3(-500, 1, 0), V3(W, 1, 0), V3(W + 4000 * c, 1, 4000 * s)], P.ink, { top: true, opacity: 0.85, dash: 40 }));
    const dW = Dot(P.bad, 14, false); dW.position.set(W, 2, 0); ctx.fxW.add(dW); ctx.label('<b style="color:var(--bad)">변침점</b>', 'dim', o => o.set(W, 40, -60));
    const iw = Math.round((ev.wo || 0) / A.dt), dO = Dot(P.amber, 14, false); dO.position.set(A.X[iw], 2, A.Z[iw]); ctx.fxW.add(dO); ctx.label('<b style="color:var(--amber)">조타 개시점</b>', 'dim', o => o.set(A.X[iw], 40, A.Z[iw] - 60));
    if (p.when === 'calc') { ctx.fxW.add(Line([V3(Xw, 3, -120), V3(W, 3, -120)], P.amber, { top: true })); ctx.label(`신침로 거리 ${fmt(AC, 0)} m`, 'dim', o => o.set((Xw + W) / 2, 10, -150)); }
    const pts = []; for (let i = 0; i < A.n; i += 4) pts.push([A.X[i], A.Z[i]]); this.rib = Ribbon(pts, 10, P.deck, 0.8); ctx.fxW.add(this.rib);
    ctx.fxW.add(Line(arcPts(W, 0, 260, 0, psiC * DEG, 1.5, 30), P.muted, { top: true, opacity: 0.8 })); ctx.label(`변침각 ${psiC}°`, 'dim', o => o.set(W + 300 * Math.cos(psiC * DEG / 2), 10, 300 * Math.sin(psiC * DEG / 2)));
    this.cam = { r: 3200, th: 2.4, ph: 0.42, target: () => V3(W - 300, 0, 700) };
    this.st = { u: U, v: 0, r: 0, n: 84, cref: U };
  },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt)));
    this.ctx.ship.pose(A.X[i], A.Z[i], A.psi[i], A.phi[i] * 2); this.ctx.ship.rudder.rotation.y = A.del[i];
    this.rib.setCount(i / 4); this.cur = { i, ts }; Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i] });
  },
  read() {
    const A = this.A, { i, ts } = this.cur, d = A.del[i] / DEG, nc = this.nc;
    const phase = ts < (this.ev.wo || 0) ? '원침로 항해' : ts < (this.ev.check || 1e9) ? '변침 중 (전타)' : ts < (this.ev.steady || 1e9) ? '반대타로 선회 감쇠' : '새 침로 정침';
    return [['경과 시간', realTime(ts)], ['단계', phase], ['선수방위', fmt(A.psi[i] / DEG, 1) + '° / 목표 ' + this.p.psi + '°'], ['타각', (d > 0.3 ? '우현 ' : d < -0.3 ? '좌현 ' : '') + fmt(Math.abs(d), 1) + '°'], ['선회율 ROT', fmt(A.r[i] / DEG * 60, 0) + '°/분'],
      ['신침로 거리 AC', fmt(nc.AB, 0) + ' + ' + fmt(nc.BC, 0) + ' = ' + fmt(this.AC, 0) + ' m'], ['오버슈트', fmt(Math.max(0, this.os), 1) + '°'], ['새 침로 이탈', fmt(Math.abs(this.xteEnd), 0) + ' m ' + (this.xteEnd > 0 ? '안쪽' : '바깥'), Math.abs(this.xteEnd) > 150 ? 'bad' : Math.abs(this.xteEnd) > 50 ? 'warn' : 'ok']];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, h = [], d = []; for (let i = 0; i < A.n; i += 8) { h.push([i * A.dt, A.psi[i] / DEG]); d.push([i * A.dt, A.del[i] / DEG]); }
    const m = this.p.psi * 1.35;
    lineChart(cv, P, { x0: 0, x1: A.dur, upto: this.cur.ts, cursor: this.cur.ts, right: true, xt: [[0, '0'], [this.ev.wo || 0, '조타'], [A.dur, realTime(A.dur)]], series: [{ data: h, color: P.deck, min: -5, max: m, yt: [0, this.p.psi], hlines: [this.p.psi], label: '선수방위 °' }, { data: d, color: P.amber, min: -25, max: 25, yt: [-20, 0, 20], axis: true, label: '타각 °', width: 1.5 }] });
  }
};
