/* 8-3 충돌 회피: 횡단 상황에서 상대선을 우현에 둔 본선이 우현으로 피한다. 회피 동작을 시작하는 거리에 따라 최근접 거리가 달라진다 */
import { SH, DEG, KN } from '../physics/ship.js';
import { maneuver } from '../physics/maneuver.js';
import { TURN } from './turning.js';
import { Ribbon, Line, Dot, V3, arcPts, footprint } from '../engine/draw.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const V = 12 * KN, L0 = SH.L, L1 = 200, Rv = Math.SQRT2 * V;
/* 충돌 회피 동작 개시 거리 D = (3.3·Rv + 6)·√((L0² + L1²)/2) */
export const startDist = (rv, l0, l1) => (3.3 * rv + 6) * Math.sqrt((l0 * l0 + l1 * l1) / 2);
const D = startDist(Rv, L0, L1), R0 = D + 1500, T = R0 / (Math.SQRT2 * V);
const NM = 1852;
export default {
  id: 'avoid', dur: 30,
  controls: [
    { k: 'when', label: '회피 동작을 시작하는 거리', type: 'seg', opts: [['D', `공식 거리 (${fmt(D / NM, 1)}해리)`], [1.5, '1.5해리'], [0.8, '0.8해리'], [0.5, '0.5해리']], val: 'D' },
    { k: 'del', label: '타각', type: 'seg', opts: [[15, '15°'], [35, '35° (전타)']], val: 15 }
  ],
  cam: { r: 12500, th: 2.4, ph: 0.3, target: () => V3(-3000, 0, 2600) }, fog: [20000, 40000], water: { alpha: 0.6, amp: 0.2 }, parts: ['rudder'],
  legend: [['deck', '본선 항적'], ['amber', '상대선 (본선의 우현에서 횡단)'], ['muted', '회피 개시 거리 원'], ['bad', '최근접 거리']],
  chartTitle: '두 배 사이 거리 (해리)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, T3 = ctx.THREE, dAct = p.when === 'D' ? D : +p.when * NM, del = +p.del;
    const tAct = (R0 - dAct) / (Math.SQRT2 * V); this.tAct = tAct;
    const A = maneuver({ U0: V, dur: T + 700, ...TURN, cmd: st => { if (st.t < tAct) return 0; if (st.psi < 45 * DEG && !st.hold) return del; st.hold = 1; return Math.max(-del, Math.min(del, -1.5 * (st.psi / DEG - 60) - 60 * st.r / DEG)); } });
    this.A = A; this.scale = A.dur / this.dur;
    const own = i => [A.X[i] - V * T, A.Z[i]], oth = t => [0, V * T - V * t];
    let cpa = 1e9, ic = 0, dist = []; for (let i = 0; i < A.n; i++) { const [x, z] = own(i), [bx, bz] = oth(i * A.dt), d = Math.hypot(x - bx, z - bz); if (i % 8 === 0) dist.push([i * A.dt, d / NM]); if (d < cpa) { cpa = d; ic = i; } }
    this.cpa = cpa; this.ic = ic; this.dist = dist; this.own = own; this.oth = oth;
    const g = []; for (let i = 0; i < A.n; i += 8) g.push(own(i)); this.rA = Ribbon(g, 40, P.deck, 0.8, 0.9);
    this.rB = Ribbon([oth(0), oth(A.dur)], 30, P.amber, 0.7, 0.55); ctx.fxW.add(this.rA, this.rB);
    const shp = new T3.Shape(footprint().map(v => new T3.Vector2(v.x, -v.z)));
    this.B = new T3.Mesh(new T3.ExtrudeGeometry(shp, { depth: 16, bevelEnabled: false }), new T3.MeshStandardMaterial({ color: P.amber, roughness: 0.7 }));
    this.B.rotation.x = -Math.PI / 2; const gB = new T3.Group(); gB.add(this.B); gB.scale.set(L1 / SH.L, 1, L1 / SH.L); this.gB = gB; ctx.fxW.add(gB);
    this.ring = Line(arcPts(0, 0, dAct, 0, 2 * Math.PI, 2, 90), P.muted, { dash: 120, opacity: 0.8 }); ctx.fxW.add(this.ring);
    this.mA = Dot(P.deck, 70); this.mB = Dot(P.amber, 60); ctx.fxW.add(this.mA, this.mB);
    const [cx, cz] = own(ic), [bx, bz] = oth(ic * A.dt); ctx.fxW.add(Line([V3(cx, 6, cz), V3(bx, 6, bz)], P.bad, { top: true }));
    ctx.label('본선', 'dim', o => o.copy(this.mA.position).add(V3(0, 200, 0))); ctx.label('상대선', 'dim', o => o.copy(this.mB.position).add(V3(0, 200, 0)));
    ctx.label(`<b style="color:var(--bad)">최근접 ${fmt(cpa / NM, 2)}해리</b><i>${fmt(cpa, 0)} m</i>`, 'dim', o => o.set((cx + bx) / 2, 220, (cz + bz) / 2));
    const S = s => s / this.scale, late = dAct < 1.0 * NM;
    this.steps = [
      { t: 0, h: '횡단 상황', p: `본선(${L0} m)과 상대선(${L1} m)이 각각 12노트로 90°를 이루며 다가온다. 상대선을 우현에 둔 본선이 피해야 할 배다. 상대 속력은 약 ${fmt(Rv / KN, 1)}노트다.` },
      { t: S(tAct), h: `${fmt(dAct / NM, 1)}해리에서 우현 ${del}°`, p: p.when === 'D' ? `해상 교통 조사로 만든 식에 넣으면 회피 동작 개시 거리는 약 ${fmt(D, 0)} m(${fmt(D / NM, 1)}해리)다. 상대선이 이 원 안으로 들어올 때 우현으로 크게 변침해 상대선의 선미 쪽으로 지나간다.` : `공식 거리(${fmt(D / NM, 1)}해리)보다 늦게 동작한다. 선회권과 최대 전진 거리가 정해져 있어 늦게 시작하면 큰 타각으로도 거리를 벌리기 어렵다.` },
      { t: S(ic * A.dt), h: `최근접 거리 ${fmt(cpa / NM, 2)}해리`, p: late ? '이렇게 가까이 지나면 서로의 압력장과 판단 착오로 위험이 커진다. 조타로 피할 수 있는 최소 거리는 선회권과 전타 시 최대 전진 거리로 정해지며, 천수에서는 선회권이 커져 더 멀어진다.' : '일찍, 크게 변침하면 상대선이 변화를 분명히 알아볼 수 있고 충분한 거리로 지나간다. 조종 성능이 나쁜 배일수록 더 일찍 동작한다.' }
    ];
    this.st = { u: V, v: 0, r: 0, n: 60, cref: V };
  },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(A.n - 1, Math.round(ts / A.dt)), ship = this.ctx.ship, [x, z] = this.own(i), [bx, bz] = this.oth(ts);
    ship.pose(x, z, A.psi[i], A.phi[i]); ship.rudder.rotation.y = A.del[i]; this.rA.setCount(i / 8); this.i = i; this.ts = ts;
    this.gB.position.set(bx, 0.8, bz); this.gB.rotation.y = Math.PI / 2; this.mA.position.set(x, 60, z); this.mB.position.set(bx, 60, bz);
    const [x0, z0] = this.own(Math.min(A.n - 1, Math.round(this.tAct / A.dt))); this.ring.position.set(ts < this.tAct ? x : x0, 0, ts < this.tAct ? z : z0);
    this.d = Math.hypot(x - bx, z - bz);
  },
  read() {
    const A = this.A, i = this.i;
    return [['경과 시간', realTime(this.ts)], ['두 배 사이 거리', fmt(this.d / NM, 2) + '해리 (' + fmt(this.d, 0) + ' m)'], ['본선 선수방위 변화', fmt(A.psi[i] / DEG, 0) + '° (우현)'], ['회피 개시 거리 (공식)', fmt(D / NM, 2) + '해리'], ['최근접 거리', fmt(this.cpa / NM, 2) + '해리', this.cpa < 0.3 * NM ? 'bad' : this.cpa < 1 * NM ? 'warn' : 'ok']];
  },
  chart(cv, P, { lineChart }) {
    lineChart(cv, P, { x0: 0, x1: this.A.dur, upto: this.ts, cursor: this.ts, xt: [[0, '0'], [600, '10분'], [1200, '20분']].filter(q => q[0] <= this.A.dur), series: [{ data: this.dist, color: P.info, min: 0, max: 6, yt: [0, 1, 2, 4, 6], hlines: [D / NM], label: '거리 해리' }] });
  }
};
