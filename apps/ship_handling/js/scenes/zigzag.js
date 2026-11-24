/* 4-1 조종성 지수 T와 K: 지그재그 시험 */
import { SH, DEG, KN, XA } from '../physics/ship.js';
import { maneuver } from '../physics/maneuver.js';
import { Ribbon, Line, V3 } from '../engine/draw.js';
import { baseWater, hullDeflect, propJet, boxSpawn } from '../engine/flow.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
export const MBOX = [-360, 360, -18, 1, -160, 160];
export function maneuverField(x, y, z, o, st) { baseWater(x, y, z, o, st); hullDeflect(x, y, z, o); propJet(x, y, z, o, st); }
export function maneuverSpawn(p) { boxSpawn([-340, 340, -16, -0.6, -140, 140], p); }
export function trackPts(A, every = 4) { const g = []; for (let i = 0; i < A.n; i += every) g.push([A.X[i], A.Z[i]]); return g; }

export default {
  id: 'tk', dur: 40, flowVis: 9, life: 2.6, box: MBOX, field: maneuverField, spawn: maneuverSpawn,
  controls: [
    { k: 'ang', label: '시험 타각', type: 'seg', opts: [[10, '10°/10°'], [20, '20°/20°']], val: 10 },
    { k: 'T', label: 'T′ 추종성', type: 'range', min: 0.8, max: 3.0, step: 0.1, val: 1.2, fmt: v => fmt(v, 1) },
    { k: 'K', label: 'K′ 선회성', type: 'range', min: 0.8, max: 3.0, step: 0.1, val: 1.5, fmt: v => fmt(v, 1) }
  ],
  cam: { r: 1150, th: 2.55, ph: 0.82, follow: true }, water: { alpha: 0.6, amp: 0.3 }, parts: ['rudder', 'radar'],
  legend: [['deck', '무게중심 항적'], ['muted', '원침로']],
  chartTitle: '선수방위와 타각 (시간)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const ang = +p.ang, U0 = 16 * KN, P = ctx.P, sw = []; let s = 0;
    const A = maneuver({ U0, dur: 760, K0: p.K, Tp: p.T, cY: 0.12, loss: 0.15, cmd: st => {
      if (st.t < 5) return 0; if (s === 0) { s = 1; sw.push(st.t); }
      if (s > 0 && st.psi >= ang * DEG) { s = -1; sw.push(st.t); } else if (s < 0 && st.psi <= -ang * DEG) { s = 1; sw.push(st.t); }
      return s * ang; } });
    this.A = A; this.ang = ang; this.scale = A.dur / this.dur;
    const pk = []; for (let k = 1; k < sw.length; k++) { const i0 = Math.round(sw[k] / A.dt), i1 = Math.round((sw[k + 1] || A.dur) / A.dt); let b = i0; for (let i = i0; i < Math.min(i1, A.n); i++) if (Math.abs(A.psi[i]) > Math.abs(A.psi[b])) b = i; pk.push(b); }
    this.sw = sw; this.pk = pk; this.os = pk.map(i => Math.abs(A.psi[i]) / DEG - ang);
    const S = x => x / this.scale;
    this.steps = [
      { t: 0, h: '정침', p: '16노트로 직진한다. 타는 중앙, 선수방위 변화는 0°다.' },
      { t: S(5), h: `우현 ${ang}° 전타`, p: '타는 초당 약 2.3°로 돌아간다(SOLAS 기준 35°→반대 30°를 28초 안에). 타가 다 돌아가도 선수는 바로 돌지 않고 회두 속도가 서서히 붙는다. 정상 선회율의 63%에 이르는 시간이 추종성 지수 T다.' },
      { t: S(sw[1] || 60), h: '반대 타', p: `선수방위가 우현으로 ${ang}° 바뀐 순간 좌현 ${ang}°로 바꾼다.` },
      { t: S(pk[0] * A.dt), h: `1차 오버슈트 ${fmt(this.os[0], 1)}°`, p: '반대 타를 줬는데도 선수는 한동안 같은 쪽으로 더 돈다. 이 초과 회두각이 오버슈트각이다. T가 작을수록(추종성이 좋을수록) 작다.' },
      { t: S(pk[1] * A.dt), h: `2차 오버슈트 ${fmt(this.os[1], 1)}°`, p: '같은 조작을 반대쪽으로 되풀이한다. 선수방위와 타각의 시간 기록에서 T와 K를 구한다.' },
      { t: S(Math.min(A.dur - 40, (pk[2] || pk[1]) * A.dt + 20)), h: 'T와 K로 본 배', p: 'K가 크면 같은 타각에서 선회율이 커져 주기가 짧아진다. 일반 선박의 T′·K′는 1.0 정도이고, 비대한 선박의 T′는 1.5~2.5로 커서 정침이 늦다. 오른쪽에서 T′와 K′를 바꿔 비교해 보자.' }
    ];
    this.pts = trackPts(A, 4); this.rib = Ribbon(this.pts, 7, P.deck, 0.7); ctx.fxW.add(this.rib);
    ctx.fxW.add(Line([V3(-200, 0.6, 0), V3(A.X[A.n - 1] + 400, 0.6, 0)], P.muted, { dash: 30 }));
    this.pkL = pk.slice(0, 4).map((i, k) => { const L = ctx.label(`${k + 1}차 오버슈트 ${fmt(this.os[k], 1)}°`, 'dim', o => o.set(A.X[i], 40, A.Z[i])); L.i = i; return L; });
    this.st = { u: U0, v: 0, r: 0, n: 84, cref: U0 };
  },
  apply(t) {
    const A = this.A, ts = t * this.scale, dt = A.dt, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / dt))), ship = this.ctx.ship;
    ship.pose(A.X[i], A.Z[i], A.psi[i], A.phi[i]); ship.rudder.rotation.y = A.del[i];
    this.rib.setCount(i / 4); for (const L of this.pkL) L.show = i >= L.i;
    Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i] }); this.i = i; this.ts = ts;
  },
  read() {
    const A = this.A, i = this.i, U = A.u[i], T = this.p.T * SH.L / U, K = this.p.K * U / SH.L, done = this.pk.filter(k => k <= i).length;
    return [['경과 시간', realTime(this.ts)], ['지령 / 실제 타', sgn(A.cmd[i] / DEG, 0) + '° / ' + sgn(A.del[i] / DEG, 1) + '°'], ['선수방위 변화', sgn(A.psi[i] / DEG, 1) + '°'], ['선회율 ROT', sgn(A.r[i] / DEG * 60, 0) + '°/분'],
      ['1차 오버슈트', done > 0 ? fmt(this.os[0], 1) + '°' : '—'], ['2차 오버슈트', done > 1 ? fmt(this.os[1], 1) + '°' : '—'], ['T (이 속력)', fmt(T, 0) + '초'], ['K (이 속력)', fmt(K, 4) + ' /초']];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, a = [], d = []; for (let i = 0; i < A.n; i += 8) { a.push([i * A.dt, A.psi[i] / DEG]); d.push([i * A.dt, A.del[i] / DEG]); }
    const m = this.ang * 2.6;
    lineChart(cv, P, { x0: 0, x1: A.dur, upto: this.ts, cursor: this.ts, xt: [[0, '0'], [300, '5분'], [600, '10분']], series: [{ data: a, color: P.deck, min: -m, max: m, yt: [-this.ang, 0, this.ang], hlines: [this.ang, -this.ang], label: '선수방위 °' }, { data: d, color: P.amber, min: -m, max: m, label: '타각 °', width: 1.5 }] });
  }
};
void XA;
