/* 8-6 인명 구조: 싱글 턴(앤더슨 턴), 윌리엄슨 턴, 샤르노브 턴을 같은 선회 모델로 계산해 항적을 비교 */
import { SH, DEG, KN } from '../physics/ship.js';
import { maneuver } from '../physics/maneuver.js';
import { TURN } from './turning.js';
import { Ribbon, Line, Dot, V3 } from '../engine/draw.js';
import { maneuverField, maneuverSpawn, MBOX } from './zigzag.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const V = 16 * KN;
const hold = (st, tgt, lim = 35) => Math.max(-lim, Math.min(lim, -2.0 * (st.psi / DEG - tgt) - 80 * st.r / DEG));
/* 각 조선법의 타 명령(도). st.ph로 단계를 기억한다 */
export function rescueRun(mode, sw = 60) {
  if (mode === 'single') return maneuver({ U0: V, dur: 900, ...TURN, cmd: st => { if (st.t < 3) return 0; if (!st.ph) { if (st.psi >= 250 * DEG) st.ph = 1; else return 35; } return hold(st, 255); }, stop: st => st.ph && st.X < -200 });
  if (mode === 'will') return maneuver({ U0: V, dur: 1500, ...TURN, cmd: st => { if (st.t < 3) return 0; if (!st.ph) { if (st.psi >= sw * DEG) st.ph = 1; else return 35; } if (st.ph === 1) { if (st.psi <= -160 * DEG) st.ph = 2; else return -35; } return hold(st, -180); }, stop: st => st.ph === 2 && st.X < -300 });
  return maneuver({ U0: V, dur: 1500, ...TURN, cmd: st => { if (st.t < 3) return 0; if (!st.ph) { if (st.psi >= 240 * DEG) st.ph = 1; else return 35; } if (st.ph === 1) { if (st.psi <= 200 * DEG) st.ph = 2; else return -35; } return hold(st, 180); }, stop: st => st.ph === 2 && st.X < -1500 });
}
const NAME = { single: '싱글 턴', will: '윌리엄슨 턴', sch: '샤르노브 턴' };
export default {
  id: 'rescue', dur: 30, flowVis: 6, life: 2.6, box: MBOX, field: maneuverField, spawn: maneuverSpawn,
  controls: [
    { k: 'mode', label: '조선법', type: 'seg', opts: [['will', '윌리엄슨 턴'], ['single', '싱글 턴'], ['sch', '샤르노브 턴']], val: 'will' },
    { k: 'sw', label: '윌리엄슨: 반대 전타하는 회두각', type: 'seg', opts: [[60, '60° (교재)'], [45, '45°'], [25, '25°']], val: 60 }
  ],
  get cam() { return { r: this.camR || 4200, th: 2.2, ph: 0.28, target: () => (this.center || V3()).clone() }; }, fog: [12000, 30000], water: { alpha: 0.6, amp: 0.25 }, parts: ['rudder'],
  legend: [['deck', '구조 항적'], ['muted', '원래 항적과 그 연장'], ['bad', '익수자'], ['amber', '타를 바꾼 곳']],
  chartTitle: '선수방위 변화 (원침로 기준, °)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, A = rescueRun(p.mode, +p.sw); this.A = A; this.scale = A.dur / this.dur;
    const e = A.n - 1; let mx = -600, Mx = 600, mz = -400, Mz = 400; for (let i = 0; i < A.n; i += 10) { mx = Math.min(mx, A.X[i]); Mx = Math.max(Mx, A.X[i]); mz = Math.min(mz, A.Z[i]); Mz = Math.max(Mz, A.Z[i]); }
    this.center = V3((mx + Mx) / 2, 0, (mz + Mz) / 2); this.camR = Math.max(Mx - mx, Mz - mz) * 1.55 + 600;
    const back = p.mode === 'sch' ? -1800 : -900, e2 = e; this.mob = p.mode === 'sch' ? V3(-1100, 0, 0) : V3(0, 0, 0);
    ctx.fxW.add(Line([V3(back - 600, 0.6, 0), V3(Mx + 400, 0.6, 0)], P.muted, { dash: 40, opacity: 0.8 }));
    const g = []; for (let i = 0; i < A.n; i += 6) g.push([A.X[i], A.Z[i]]); this.rib = Ribbon(g, 14, P.deck, 0.7, 0.9); ctx.fxW.add(this.rib);
    const mob = Dot(P.bad, 22); mob.position.set(this.mob.x, 4, this.mob.z); ctx.fxW.add(mob); ctx.label('<b style="color:var(--bad)">익수자</b>', 'dim', o => o.set(this.mob.x, 40, this.mob.z - 60));
    const first = (f, from = 0) => { for (let i = from; i < A.n; i++) if (f(A.psi[i] / DEG)) return i; return null; }, a1 = { will: +p.sw, single: 250, sch: 240 }[p.mode], ph = [first(v => v >= a1)];
    if (p.mode !== 'single' && ph[0] != null) ph.push(first(v => v <= (p.mode === 'will' ? -160 : 200), ph[0]));
    for (const i of ph.filter(i => i != null)) { const d = Dot(P.amber, 16); d.position.set(A.X[i], 6, A.Z[i]); ctx.fxW.add(d); }
    this.off = A.Z[e]; this.tEnd = e * A.dt;
    let m = 1e9, im = 0; for (let i = 0; i < A.n; i++) { const d = Math.hypot(A.X[i] - this.mob.x, A.Z[i] - this.mob.z); if (i * A.dt > 60 && d < m) { m = d; im = i; } } this.cpa = m; this.icpa = im;
    const S = s => Math.min(29, s / this.scale), sw = +p.sw;
    this.steps = p.mode === 'will' ? [
      { t: 0, h: '사람이 빠졌다: 우현 전타', p: '16노트로 가다 사람이 빠졌다. 구명환을 던지고 당직사관에게 알린 뒤, 한쪽으로 전타한다. 야간이나 시정이 나빠 사고 지점을 정확히 모를 때 쓰는 방법이다.' },
      { t: S(ph[0] != null ? ph[0] * A.dt : 60), h: `${sw}°에서 반대로 전타`, p: `선수방위가 원침로에서 ${sw}° 바뀌면 타를 반대쪽으로 전타한다. 선수는 관성으로 90° 가까이 더 돌다가 반대로 돌기 시작한다.` },
      { t: S(ph[1] != null ? ph[1] * A.dt : 200), h: '반대 침로 20° 전에 타 중앙', p: '원침로와 정반대인 침로에 20° 못 미쳤을 때 타를 중앙으로 하면 반대 침로에 정침한다. 지나온 항적을 거꾸로 되짚어 가게 된다.' },
      { t: 28, h: `원래 항적에서 ${fmt(Math.abs(this.off), 0)} m ${this.off > 0 ? '우현' : '좌현'} 쪽`, p: '어디서 정침하는지는 배의 조종 성능에 달려 있다. 조선자는 자기 배가 어느 각에서 반대 전타해야 원래 항적으로 돌아오는지 미리 알아 둔다. 반대 전타 각을 바꿔 보자.' }
    ] : p.mode === 'single' ? [
      { t: 0, h: '익수자 쪽으로 즉시 전타', p: '사람이 빠진 것을 바로 알았을 때 쓴다. 익수자가 빠진 현 쪽으로 최대 전타해 선미와 프로펠러가 익수자에게서 멀어지게 하며 그대로 돈다.' },
      { t: S(ph[0] != null ? ph[0] * A.dt : 400) - 2, h: '250° 돌면 타 중앙', p: '원침로에서 250° 돌았을 때 타를 중앙으로 해 익수자 쪽으로 다가간다. 가장 빠른 방법이고 선회 성능이 나쁜 배나 출력이 큰 배에 쓸모 있지만, 접근이 곧지 않아 맞추기 어렵다.' },
      { t: S(im * A.dt), h: `익수자에게서 ${fmt(m, 0)} m`, p: `약 ${realTime(im * A.dt)} 만에 익수자 곁을 지난다. 대형선은 익수자(조난선)의 풍상측에 다가가 풍하측 구명정을 내리고, 소형선은 풍하측에서 다가가 파도를 덜 받게 한다.` }
    ] : [
      { t: 0, h: '사고를 늦게 알았을 때', p: '사람이 빠지고 시간이 지난 뒤에 알았을 때, 지나온 항적을 거꾸로 되짚기 위해 쓴다. 우선 최대 전타한다.' },
      { t: S(ph[0] != null ? ph[0] * A.dt : 300), h: '240°에서 반대 전타', p: '원침로에서 240° 돌면 반대쪽으로 최대 전타한다.' },
      { t: S(ph[1] != null ? ph[1] * A.dt : 400), h: '반대 침로 20° 전에 타 중앙', p: '원침로의 반대 침로에 20° 못 미쳤을 때 타를 중앙으로 해 반대 침로에 들어간다. 윌리엄슨 턴보다 선회 거리가 짧아 시간을 아끼지만, 사고와 조종 시작 사이 시간을 모르면 효과가 없다.' }
    ];
    this.st = { u: V, v: 0, r: 0, n: 60, cref: V };
  },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))), ship = this.ctx.ship;
    ship.pose(A.X[i], A.Z[i], A.psi[i], A.phi[i] * 2); ship.rudder.rotation.y = A.del[i]; this.rib.setCount(i / 6); this.i = i; this.ts = ts;
    Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i] });
  },
  read() {
    const A = this.A, i = this.i, d = Math.hypot(A.X[i] - this.mob.x, A.Z[i] - this.mob.z);
    return [['조선법', NAME[this.p.mode]], ['경과 시간', realTime(this.ts)], ['선수방위 변화', fmt(A.psi[i] / DEG, 0) + '°'], ['타각', Math.abs(A.del[i] / DEG) < 1 ? '중앙' : (A.del[i] > 0 ? '우현 ' : '좌현 ') + fmt(Math.abs(A.del[i] / DEG), 0) + '°'], ['익수자까지', fmt(d, 0) + ' m'],
      this.p.mode === 'single' ? ['가장 가까이 지난 거리', fmt(this.cpa, 0) + ' m'] : ['반대 침로에서 원래 항적과 차이', fmt(Math.abs(this.off), 0) + ' m ' + (this.off > 0 ? '(우현 쪽)' : '(좌현 쪽)'), Math.abs(this.off) > 300 ? 'warn' : 'ok']];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, a = []; for (let i = 0; i < A.n; i += 8) a.push([i * A.dt, A.psi[i] / DEG]);
    lineChart(cv, P, { x0: 0, x1: A.dur, upto: this.ts, cursor: this.ts, xt: [[0, '0'], [300, '5분'], [600, '10분'], [900, '15분']].filter(q => q[0] <= A.dur), series: [{ data: a, color: P.deck, min: -200, max: 280, yt: [-180, -90, 0, 90, 180, 250], hlines: [0, 180, -180], label: '선수방위 변화 °' }] });
  }
};
