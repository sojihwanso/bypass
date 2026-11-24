/* 7-2 수류: 4노트 수류 속 U-turn. 선회율은 그대로인데 항적이 수류에 실려 간다 */
import { SH, DEG, KN } from '../physics/ship.js';
import { maneuver } from '../physics/maneuver.js';
import { TURN } from './turning.js';
import { Ribbon, Arrow, Line, V3 } from '../engine/draw.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const DIR = { 0: '0° (원침로와 같은 쪽)', 180: '180° (맞은편)', 90: '90° (우현 쪽으로)', 270: '270° (좌현 쪽으로)' };
export default {
  id: 'current', dur: 30, flowVis: 6, life: 3,
  controls: [{ k: 'dir', label: '수류 방향', type: 'seg', opts: Object.entries(DIR).map(([k, v]) => [+k, v.split(' ')[0]]), val: 0 }, { k: 'vc', label: '수류 속도', type: 'seg', opts: [[2, '2노트'], [4, '4노트']], val: 4 }],
  get cam() { return { r: this.camR || 2600, th: 2.2, ph: 0.3, target: () => (this.center || V3()).clone() }; }, water: { alpha: 0.6, amp: 0.2 }, parts: ['rudder'],
  legend: [['deck', '수류 속 항적(대지)'], ['muted', '잔잔한 물에서의 항적'], ['info', '수류']],
  chartTitle: '선수방위 변화: 수류가 있든 없든 같다',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, U0 = 12.3 * KN, vc = p.vc * KN, d = p.dir * DEG;
    const A = maneuver({ U0, dur: 900, ...TURN, cmd: st => st.t < 5 ? 0 : 15, stop: st => st.psi > 200 * DEG });
    const cx = vc * Math.cos(d), cz = vc * Math.sin(d); this.A = A; this.cx = cx; this.cz = cz; this.scale = A.dur / this.dur;
    const tr = (i, k) => [A.X[i] + k * cx * i * A.dt, A.Z[i] + k * cz * i * A.dt];
    const g = k => { const a = []; for (let i = 0; i < A.n; i += 4) a.push(tr(i, k)); return a; };
    this.rS = Ribbon(g(0), 8, P.muted, 0.6, 0.6); this.rC = Ribbon(g(1), 10, P.deck, 0.8, 0.9); ctx.fxW.add(this.rS, this.rC);
    for (let k = 0; k < 6; k++) { const a = Arrow(P.info, 3, { top: false }); a.set(V3(-400 + k * 300, 2, -500), V3(Math.cos(d), 0, Math.sin(d)), 120); ctx.fxW.add(a); }
    const e = A.n - 1, [xe, ze] = tr(e, 1); this.adv = Math.max(...g(1).map(q => q[0])); this.shift = Math.hypot(xe - A.X[e], ze - A.Z[e]);
    const desc = { 0: '수류가 원침로와 같은 방향(순조)이라 앞으로 더 나아가고, 돌아선 뒤에는 수류를 거슬러 가느라 대지 속력이 준다.', 180: '수류를 거슬러(역조) 돌기 시작해 앞으로 덜 나아가고, 돌아선 뒤에는 수류에 실려 하류로 크게 밀려난다.', 90: '돌기 시작하자마자 원침로에서 벗어나 하류 쪽으로 크게 밀려난다.', 270: '수류를 옆으로 받아 회두는 하지만 하류로 밀려 선회에 오래 걸리고 앞으로 더 나아간다. 돌아선 뒤에는 원침로 쪽으로 되밀린다.' }[p.dir];
    this.steps = [
      { t: 0, h: '12.3노트로 직진', p: `수류 ${p.vc}노트, 방향 ${DIR[p.dir]}. 물의 밀도는 공기의 약 836배라 수류는 바람보다 훨씬 크게 배를 민다.` },
      { t: 5 / this.scale, h: '15°로 U-turn', p: '같은 배, 같은 타각으로 회두한다. 회색 선은 잔잔한 물에서, 초록 선은 수류 속에서 땅에 대해 그린 항적이다.' },
      { t: 12, h: '항적이 수류에 실린다', p: desc },
      { t: 22, h: '선회율은 같다', p: '배는 물과 함께 실려 가므로 물에 대한 선회율과 선수방위 변화는 수류가 있든 없든 거의 같다. 달라지는 것은 땅에 대한 항적이다. 장애물이나 어선을 피할 때, 특히 저속일 때 이 점을 계산에 넣는다.' }
    ];
    let mx = 0, Mx = 0, mz = 0, Mz = 0; for (const s of [0, 1]) for (let i = 0; i < A.n; i++) { const [x, z] = tr(i, s); mx = Math.min(mx, x); Mx = Math.max(Mx, x); mz = Math.min(mz, z); Mz = Math.max(Mz, z); }
    this.center = V3((mx + Mx) / 2, 0, (mz + Mz) / 2 - 100); this.camR = Math.max(Mx - mx, Mz - mz) * 1.5 + 500;
    this.st = { u: U0, v: 0, r: 0, n: 60, cref: U0, cx, cz };
  },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))), ship = this.ctx.ship;
    ship.pose(A.X[i] + this.cx * i * A.dt, A.Z[i] + this.cz * i * A.dt, A.psi[i], A.phi[i]); ship.rudder.rotation.y = A.del[i];
    this.rS.setCount(i / 4); this.rC.setCount(i / 4); this.i = i; this.ts = ts;
    Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i] });
  },
  read() {
    const A = this.A, i = this.i, sh = Math.hypot(this.cx * i * A.dt, this.cz * i * A.dt);
    return [['경과 시간', realTime(this.ts)], ['선수방위 변화', fmt(A.psi[i] / DEG, 0) + '°'], ['선회율', fmt(A.r[i] / DEG * 60, 0) + '°/분 (수류와 무관)'], ['수류에 밀린 거리', fmt(sh, 0) + ' m (' + fmt(sh / SH.L, 1) + 'L)'], ['물에 대한 속력', fmt(A.u[i] / KN, 1) + ' kn']];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, h = []; for (let i = 0; i < A.n; i += 6) h.push([i * A.dt, A.psi[i] / DEG]);
    lineChart(cv, P, { x0: 0, x1: A.dur, upto: this.ts, cursor: this.ts, xt: [[0, '0'], [120, '2분'], [240, '4분']].filter(x => x[0] <= A.dur), series: [{ data: h, color: P.deck, min: 0, max: 200, yt: [0, 90, 180], hlines: [180], label: '선수방위 변화 °' }] });
  },
  field(x, y, z, o, st) { o.x = -st.u + st.r * z; o.y = 0; o.z = -st.v - st.r * x; o.k = 0; }, flowN: 300,
  spawn(p) { const a = Math.random() * 2 * Math.PI, r = 150 + Math.random() * 120; p.x = r * Math.cos(a); p.z = r * Math.sin(a); p.y = -Math.random() * 10; p.k = 0; }, box: [-400, 400, -18, 1, -400, 400]
};
