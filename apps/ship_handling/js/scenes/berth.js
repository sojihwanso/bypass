/* 8-4 접이안: 부두 앞 예정 정지점까지 거리 D에서 후진을 걸 때의 안전 여유 σ = A/D (A: 실제 정지점과 예정 정지점 사이 남은 거리) */
import { SH, DEG, KN, hullHalfWidth as hw } from '../physics/ship.js';
import { Line, Ribbon, V3 } from '../engine/draw.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const M = SH.disp * 1000 * 1.07, TF = 1.2e6; /* 질량+부가 질량(7%), 전속 후진 추력(5장 모델과 같음) */
const K = 1.6e6 / (10.3 * 10.3);             /* 저항 계수: 20노트에서 전속 추력과 같다(5장 모델) */
export const ASTERN = { ds: ['극미속 후진', 0.16], sl: ['미속 후진', 0.30], hf: ['반속 후진', 0.56], fu: ['전속 후진', 1.0] };
const RAMP = 30; /* 후진 명령부터 추력이 다 걸리기까지(가정) */
export function stopRun(U0, level) {
  const Ta = TF * ASTERN[level][1], o = { t: [], x: [], u: [] }; let u = U0, x = 0, t = 0;
  while (u > 0 && t < 3000) { o.t.push(t); o.x.push(x); o.u.push(u); const T = Ta * Math.min(1, t / RAMP); u -= (T + K * u * u) / M; if (u < 0) u = 0; x += u; t += 1; }
  o.t.push(t); o.x.push(x); o.u.push(0); o.S = x; o.T = t; return o;
}
/* 거리 D에서 안전 여유가 sig가 되는 속력(kn): 이분법 */
export function speedFor(D, level, sig = 0) { let a = 0.2, b = 16; for (let k = 0; k < 30; k++) { const m = (a + b) / 2; (stopRun(m * KN, level).S < D * (1 - sig)) ? a = m : b = m; } return (a + b) / 2; }
export default {
  id: 'berth', dur: 30,
  controls: [
    { k: 'D', label: '예정 정지점까지 거리', type: 'seg', opts: [[500, '500 m'], [1000, '1,000 m'], [2000, '2,000 m']], val: 1000 },
    { k: 'U', label: '그때 속력', type: 'range', min: 1, max: 10, step: 0.5, val: 2.5, fmt: v => fmt(v, 1) + ' kn' },
    { k: 'lv', label: '후진 기관', type: 'seg', opts: Object.entries(ASTERN).map(([k, v]) => [k, v[0]]), val: 'ds' }
  ],
  cam: { r: 1500, th: 2.3, ph: 0.75, follow: true }, water: { alpha: 0.55, amp: 0.15 }, parts: ['propeller', 'rudder'],
  legend: [['deck', '지나온 길'], ['amber', '예정 정지점'], ['bad', '오버런'], ['sand', '부두']],
  chartTitle: '예정 정지점까지 거리에 따른 접근 속력 지침 (모델 값)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, T3 = ctx.THREE, D = +p.D, U0 = p.U * KN;
    const run = stopRun(U0, p.lv); this.run = run; this.D = D; this.scale = (run.T + 20) / this.dur;
    const A = D - run.S, sig = A / D; this.sig = sig; this.A = A;
    const zq = -(hw(0, SH.T) + 2 * SH.B); this.zq = zq;
    const quay = new T3.Mesh(new T3.BoxGeometry(D + 1800, 12, 40), new T3.MeshStandardMaterial({ color: P.sand, roughness: 0.9 })); quay.position.set(-D / 2 + 300, 2, zq - 20 - SH.B * 0); ctx.fxW.add(quay);
    ctx.fxW.add(Line([V3(0, 1, zq), V3(0, 1, 120)], P.amber, { top: true }));
    ctx.label('<b style="color:var(--amber)">예정 정지점</b>', 'dim', o => o.set(0, 20, 130));
    const g = []; for (let i = 0; i < run.x.length; i += 5) g.push([run.x[i] - D, 0]); g.push([run.S - D, 0]); this.rib = Ribbon(g, 6, P.deck, 0.6, 0.85); ctx.fxW.add(this.rib);
    if (A < 0) { ctx.fxW.add(Line([V3(0, 2, 40), V3(-A, 2, 40)], P.bad, { top: true })); ctx.label(`<b style="color:var(--bad)">오버런 ${fmt(-A, 0)} m</b>`, 'dim', o => o.set(-A / 2, 24, 60)); }
    const lv = ASTERN[p.lv][0], zone = this.zoneOf(p.U, D);
    this.steps = [
      { t: 0, h: `${fmt(D, 0)} m 앞에서 ${lv}`, p: `예정 정지점까지 ${fmt(D, 0)} m 남은 곳에서 ${fmt(p.U, 1)}노트로 ${lv}을 건다. 후진 추력이 다 걸리기까지 약 ${RAMP}초가 걸린다고 두었다.` },
      { t: Math.min(25, run.T * 0.5 / this.scale), h: '타력으로 나아간다', p: '배는 무거워 후진을 걸어도 한참 나아간다. 속력이 줄수록 물의 저항도 줄어 마지막에는 후진 추력만으로 멈춘다.' },
      { t: Math.min(28, run.T / this.scale), h: A < 0 ? `오버런: 정지점을 ${fmt(-A, 0)} m 지남` : `안전 여유 σ = ${fmt(sig, 2)}`, p: (A < 0 ? '예정 정지점을 지나쳤다. 부두 앞에서는 다른 배, 안벽과 부딪치거나 좌초할 수 있다. ' : `정지점 ${fmt(A, 0)} m 앞에서 멈췄다. `) + zone[1] }
    ];
    this.st = { u: U0, v: 0, r: 0, n: -30, cref: U0 };
  },
  zoneOf(U, D) {
    const red = speedFor(D, 'fu'), avail = speedFor(D, 'ds'), r3 = speedFor(D, 'ds', 0.3), r6 = speedFor(D, 'ds', 0.6);
    if (U > red) return ['적색', '이 거리에서 이 속력은 전속 후진으로도 정지점 안에 멈추지 못하는 적색 범위다. 극도로 주의해야 할 속력이다.'];
    if (U > avail) return ['황색', '미속·반속·전속 후진으로는 멈출 수 있지만 극미속 후진으로는 못 멈추는 황색 범위다. 후진 기관이 뜻대로 안 될 수도 있어 도선사들은 이 범위를 피한다.'];
    if (U >= r6 && U <= r3) return ['권고', '극미속 후진으로 안전 여유 0.3~0.6에 드는 권고 속력이다. 도선사의 3분의 2가 이 범위를 알맞다고 답했다.'];
    return ['가능', U > r3 ? '극미속 후진으로 멈출 수는 있지만 여유가 0.3보다 작다. 대담한 쪽에 가깝다.' : '여유가 0.6보다 커서 신중한 쪽이다. 접근에 시간이 더 걸린다.'];
  },
  apply(t) {
    const run = this.run, ts = t * this.scale, i = Math.min(run.x.length - 1, Math.round(ts)), ship = this.ctx.ship, lv = ASTERN[this.p.lv][1];
    ship.pose(run.x[i] - this.D, 0, 0); ship.prop.rotation.x += run.u[i] > 0 ? 0.05 * lv : 0; this.rib.setCount(i / 5); this.i = i; this.ts = ts;
    Object.assign(this.st, { u: run.u[i], n: run.u[i] > 0 ? -60 * lv : 0 });
  },
  read() {
    const run = this.run, i = this.i, left = this.D - run.x[i], z = this.zoneOf(this.p.U, this.D);
    return [['경과 시간', realTime(this.ts)], ['속력', fmt(run.u[i] / KN, 1) + ' kn'], ['예정 정지점까지', left >= 0 ? fmt(left, 0) + ' m' : '지남 ' + fmt(-left, 0) + ' m', left < 0 ? 'bad' : ''], ['정지 거리', fmt(run.S, 0) + ' m'], ['안전 여유 σ = A/D', this.A < 0 ? '0 미만 (오버런)' : fmt(this.sig, 2), this.A < 0 ? 'bad' : this.sig < 0.3 ? 'warn' : 'ok'], ['속력 범위', z[0], z[0] === '적색' ? 'bad' : z[0] === '황색' ? 'warn' : 'ok']];
  },
  chart(cv, P, { lineChart }) {
    if (!this.curves) { const c = { fu: [], ds: [], r3: [], r6: [] }; for (let D = 100; D <= 3000; D += 100) { c.fu.push([D, speedFor(D, 'fu')]); c.ds.push([D, speedFor(D, 'ds')]); c.r3.push([D, speedFor(D, 'ds', 0.3)]); c.r6.push([D, speedFor(D, 'ds', 0.6)]); } this.curves = c; }
    const c = this.curves, y = { min: 0, max: 12 };
    lineChart(cv, P, { x0: 100, x1: 3000, xt: [[500, '500 m'], [1000, '1,000'], [2000, '2,000'], [3000, '3,000 m']], series: [
      { data: c.fu, color: P.bad, ...y, yt: [0, 4, 8, 12], label: '전속 후진 σ=0 (위는 적색)' },
      { data: c.ds, color: P.amber, ...y, label: '극미속 후진 σ=0' },
      { data: c.r3, color: P.deck, ...y, label: '권고 σ=0.3', dash: [4, 3] },
      { data: c.r6, color: P.deck, ...y, label: '권고 σ=0.6', dash: [4, 3], mark: [this.D, this.p.U] }] });
  }
};
