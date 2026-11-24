/* 5-5 선속과 타력: 전속 전진에서 기관 정지(정지 타력)와 전속 후진(긴급 정지 타력)을 나란히 비교 */
import { SH, DEG, KN, smooth } from '../physics/ship.js';
import { Ribbon, Ghost, Line, V3 } from '../engine/draw.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const M = SH.disp * 1000 * 1.07; /* 질량 + 앞뒤 방향 부가 질량(가정 7%) */
/* 저항 R = k·u², 전속에서 추력과 저항이 같다(모델 값). 후진 추력은 전진의 0.75배, 기관 반전에 1분(가정) */
function run(U0, mode) {
  const Rf = 1.6e6 * (U0 / 10.3) ** 2, k = Rf / (U0 * U0), Ta = 0.75 * 1.6e6, dt = 1, out = { t: [], u: [], x: [], z: [], psi: [] };
  let u = U0, x = 0, z = 0, psi = 0, t = 0, tStop = null;
  while (t <= 9000) {
    out.t.push(t); out.u.push(u); out.x.push(x); out.z.push(z); out.psi.push(psi);
    let T = 0; if (mode === 'crash') T = t < 20 ? 0 : t < 80 ? -Ta * (t - 20) / 60 : -Ta;
    if (mode === 'crash' && u <= 0) { if (tStop == null) tStop = t; u = 0; T = 0; }
    u += (T - k * u * Math.abs(u)) / M * dt; if (mode === 'crash' && u < 0) u = 0;
    if (mode === 'crash' && T < 0 && u > 0) psi += 0.006 * DEG * (1 + 6 * (1 - u / U0)) * dt; /* 배출류·횡압력으로 선수가 우현으로 (모식) */
    x += u * Math.cos(psi) * dt; z += u * Math.sin(psi) * dt; t += dt;
    if (mode === 'stop' && u < 2 * KN && out.t2 == null) out.t2 = t;
    if (mode === 'crash' && tStop != null && t > tStop + 60) break;
    if (mode === 'stop' && out.t2 != null && t > out.t2 + 60) break;
  }
  out.tStop = tStop; out.n = out.t.length; return out;
}
export default {
  id: 'inertia', scale: 1,
  controls: [
    { k: 'mode', label: '보기', type: 'seg', opts: [['crash', '긴급 정지 (전속 후진)'], ['stop', '기관 정지']], val: 'crash', restart: true },
    { k: 'U', label: '처음 속력', type: 'range', min: 10, max: 24, step: 1, val: 20, fmt: v => v + ' kn' }
  ],
  dur: 30, get cam() { return { r: this.camR || 3000, th: 2.6, ph: 0.55, target: () => (this.center || V3()).clone() }; }, water: { alpha: 0.6, amp: 0.25 }, parts: ['propeller', 'engine'],
  legend: [['deck', '긴급 정지 항적'], ['amber', '기관 정지 항적'], ['muted', '배 길이 눈금(1L)']],
  chartTitle: '선속 변화 (분)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; this.mode = p.mode; const P = ctx.P, U0 = p.U * KN;
    this.C = run(U0, 'crash'); this.S = run(U0, 'stop');
    const tEnd = p.mode === 'crash' ? this.C.tStop + 60 : this.S.t2 + 60; this.tEnd = tEnd; this.scale = tEnd / this.dur;
    const iAt = (A, t) => Math.min(A.n - 1, Math.round(t)), Sc = s => s / this.scale;
    const cDist = this.C.x[this.C.n - 1], sDist2 = this.S.x[iAt(this.S, this.S.t2)];
    this.cDist = cDist; this.sDist2 = sDist2;
    this.steps = p.mode === 'crash' ? [
      { t: 0, h: '전속 전진', p: `${p.U}노트로 나아가다 앞에 위험이 보인다. 추력과 저항이 맞서 속력이 일정한 상태다.` },
      { t: Sc(20), h: '전속 후진 명령', p: '기관을 멈추고 반대 방향으로 다시 돌린다. 디젤 기관은 캠을 바꾸려 일단 멈췄다가 시동 공기로 재시동한다. 그 사이에도 배는 거의 같은 속력으로 나아간다.' },
      { t: Sc(90), h: '후진 추력', p: '후진 추력이 붙어 속력이 빠르게 준다. 후진에서는 배출류가 선체에 막혀 전진 때만큼 추력을 내지 못한다.' },
      { t: Sc(this.C.tStop * 0.6), h: '선수가 우현으로', p: '후진 프로펠러의 배출류와 횡압력 때문에 선수가 우현으로 돈다. 정지에 걸리는 시간이 길수록 더 많이 돈다. VLCC와 LNG선은 거의 직각까지, 다른 배는 30° 안팎 돈다.' },
      { t: Sc(this.C.tStop), h: `정지: 약 ${fmt(cDist / SH.L, 1)}L`, p: `물에 대해 멈출 때까지 약 ${fmt(this.C.tStop / 60, 0)}분, ${fmt(cDist, 0)} m를 나아갔다(모델 값). 이 거리가 최단 정지거리다. 시뮬레이션 자료에서 큰 배들은 10~14L, 2~4 km에 이른다.` }
    ] : [
      { t: 0, h: '전속 전진', p: `${p.U}노트로 나아간다.` },
      { t: Sc(30), h: '기관 정지', p: '추력이 없어지면 저항만 남아 속력이 준다. 처음에는 저항이 커서 빨리 줄지만, 느려질수록 저항도 작아져 천천히 준다.' },
      { t: Sc(this.S.t2 * 0.5), h: '오래 미끄러진다', p: '선속은 속력의 제곱에 비례하는 저항으로 줄어 끝으로 갈수록 거의 줄지 않는다. 그래서 완전히 멈출 때까지 재지 않고 2노트까지를 정지 타력으로 본다.' },
      { t: Sc(this.S.t2), h: `2노트: 약 ${fmt(sDist2 / SH.L, 0)}L`, p: `2노트가 될 때까지 약 ${fmt(this.S.t2 / 60, 0)}분, ${fmt(sDist2, 0)} m(모델 값). 같은 속력에서 전속 후진으로 멈춘 거리(약 ${fmt(cDist / SH.L, 1)}L)의 몇 배다.` }
    ];
    const rib = A => { const g = []; for (let i = 0; i < A.n; i += 10) g.push([A.x[i], A.z[i]]); return g; };
    this.ribC = Ribbon(rib(this.C), 14, P.deck, 0.6, 0.9); this.ribS = Ribbon(rib(this.S).map(([x, z]) => [x, z - 260]), 14, P.amber, 0.6, 0.9); ctx.fxW.add(this.ribC, this.ribS);
    this.ghost = Ghost(0, -260, 0, P.amber, 0.9); ctx.fxW.add(this.ghost);
    const xmax = p.mode === 'crash' ? Math.max(cDist, this.S.x[iAt(this.S, tEnd)]) : sDist2;
    for (let L = 0; L <= xmax + SH.L; L += SH.L) ctx.fxW.add(Line([V3(L, 0.8, 70), V3(L, 0.8, 100)], P.muted, { opacity: 0.8 }));
    ctx.label('<b style="color:var(--deck)">긴급 정지</b>', 'dim', o => o.set(-250, 20, 0)); ctx.label('<b style="color:var(--amber)">기관 정지</b>', 'dim', o => o.set(-250, 20, -260));
    this.center = V3(Math.min(xmax, 14000) / 2, 0, -120); this.camR = Math.min(xmax, 14000) * 0.8 + 700;
    this.st = { u: U0, v: 0, r: 0, n: 0, cref: U0 };
  },
  apply(t) {
    const ts = t * this.scale, C = this.C, S = this.S, ic = Math.min(C.n - 1, Math.round(ts)), is = Math.min(S.n - 1, Math.round(ts)), ship = this.ctx.ship;
    ship.pose(C.x[ic], C.z[ic], C.psi[ic]); this.ghost.position.set(S.x[is], 0.8, -260 + S.z[is]);
    this.ribC.setCount(ic / 10); this.ribS.setCount(is / 10); this.ic = ic; this.is = is; this.ts = ts;
    const T = ts < 20 ? 49 : ts < 80 ? 49 - 119 * (ts - 20) / 60 : -70; this.ctx.ship.prop.rotation.x = -(T > 0 ? 1 : -1) * ts * 0.8;
  },
  read() {
    const C = this.C, S = this.S, ic = this.ic, is = this.is;
    return [['경과 시간', realTime(this.ts)], ['긴급 정지 선속', fmt(C.u[ic] / KN, 1) + ' kn'], ['긴급 정지 진출 거리', fmt(C.x[ic], 0) + ' m (' + fmt(C.x[ic] / SH.L, 1) + 'L)'], ['선수 편향', fmt(C.psi[ic] / DEG, 0) + '° 우현 (모식)'],
      ['기관 정지 선속', fmt(S.u[is] / KN, 1) + ' kn'], ['기관 정지 진출 거리', fmt(S.x[is], 0) + ' m (' + fmt(S.x[is] / SH.L, 1) + 'L)'], ['최단 정지거리 (모델)', fmt(this.cDist / SH.L, 1) + 'L, ' + fmt(C.tStop / 60, 0) + '분'], ['2노트까지 (기관 정지)', fmt(this.sDist2 / SH.L, 0) + 'L, ' + fmt(S.t2 / 60, 0) + '분']];
  },
  chart(cv, P, { lineChart }) {
    const C = this.C, S = this.S, a = [], b = [], x1 = this.tEnd / 60;
    for (let i = 0; i < C.n; i += 10) a.push([C.t[i] / 60, C.u[i] / KN]); for (let i = 0; i < S.n; i += 10) if (S.t[i] / 60 <= x1) b.push([S.t[i] / 60, S.u[i] / KN]);
    lineChart(cv, P, { x0: 0, x1, upto: this.ts / 60, cursor: this.ts / 60, xt: [[0, '0'], [x1 / 2, fmt(x1 / 2, 0) + '분'], [x1, fmt(x1, 0) + '분']], series: [{ data: a, color: P.deck, min: 0, max: this.p.U + 1, yt: [0, 2, this.p.U], hlines: [2], label: '긴급 정지 kn' }, { data: b, color: P.amber, min: 0, max: this.p.U + 1, label: '기관 정지 kn' }] });
  }
};
void smooth;
