/* 8-8 악천후와 태풍: 북반구 태풍의 위험 반원(우반원)·가항 반원(좌반원)과 RRR·LLR 법칙. 지도 축척(1 = 50 m)의 모식 */
import { DEG, KN } from '../physics/ship.js';
import { Arrow, Ribbon, Line, Dot, V3, arcPts } from '../engine/draw.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const U = 50;                                   /* 장면 1 = 50 m */
const VT = 12 * KN, VS = 12 * KN, VM = 40, RM = 40000, HRS = 16, DT = 60;
/* 지도: x = 북, z = 동. 방위 b(시계 방향) ↔ (cos b, sin b). 북반구 태풍: 반시계 방향 회전 + 중심으로 20° 유입 + 진행 속도의 절반을 더함(모델 값) */
export function wind(dx, dz) {
  const r = Math.hypot(dx, dz) + 1, sp = r < RM ? VM * r / RM : VM * (RM / r) ** 0.6, a = 20 * DEG;
  const tn = dz / r, te = -dx / r, inn = -dx / r, ie = -dz / r;
  const n = (Math.cos(a) * tn + Math.sin(a) * inn) * sp + 0.5 * VT, e = (Math.cos(a) * te + Math.sin(a) * ie) * sp;
  return { n, e, sp: Math.hypot(n, e) };
}
const fromBrg = w => (Math.atan2(-w.e, -w.n) / DEG + 360) % 360;
export function stormRun(side, mode) {
  let cx = 0, x = 120e3, z = side === 'R' ? 100e3 : -100e3; const o = { x: [], z: [], cx: [], h: [], fb: [], sp: [], d: [] };
  for (let t = 0; t <= HRS * 3600; t += DT) {
    const w = wind(x - cx, z), fb = fromBrg(w), h = (mode === 'rule' ? (side === 'R' ? fb - 45 : fb - 135) : (side === 'R' ? 270 : 90)) * DEG;
    o.x.push(x); o.z.push(z); o.cx.push(cx); o.h.push(h); o.fb.push(fb); o.sp.push(w.sp); o.d.push(Math.hypot(x - cx, z));
    x += VS * Math.cos(h) * DT; z += VS * Math.sin(h) * DT; cx += VT * DT;
  }
  o.n = o.x.length; return o;
}
export default {
  id: 'heavy', dur: 30,
  controls: [
    { k: 'side', label: '본선 위치 (태풍 진로 기준)', type: 'seg', opts: [['R', '오른쪽 (위험 반원)'], ['L', '왼쪽 (가항 반원)']], val: 'R' },
    { k: 'mode', label: '조선', type: 'seg', opts: [['rule', 'RRR · LLR 법칙대로'], ['none', '원래 침로 (진로를 가로지름)']], val: 'rule' }
  ],
  cam: { r: 17000, th: Math.PI, ph: 0.12, target: () => V3(2600, 0, 0) }, fog: [40000, 60000], water: { alpha: 0.35, amp: 0.1 }, parts: [],
  legend: [['deck', '본선 항적'], ['muted', '다른 조선의 항적'], ['bad', '태풍 중심과 강풍 반지름'], ['air1', '바람']],
  chartTitle: '태풍 중심까지 거리 (km)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P; ctx.ship.model.visible = false;
    const A = stormRun(p.side, p.mode), B = stormRun(p.side, p.mode === 'rule' ? 'none' : 'rule'); this.A = A; this.B = B; this.scale = HRS * 3600 / DT / this.dur;
    ctx.fxW.add(Line([V3(-2000, 2, 0), V3(16000, 2, 0)], P.bad, { dash: 200, opacity: 0.5 }));
    ctx.label('태풍 진로 (북쪽으로 12노트)', 'dim', o => o.set(14500, 40, -700));
    const gA = [], gB = []; for (let i = 0; i < A.n; i += 4) { gA.push([A.x[i] / U, A.z[i] / U]); gB.push([B.x[i] / U, B.z[i] / U]); }
    this.rA = Ribbon(gA, 60, P.deck, 3, 0.95); this.rB = Ribbon(gB, 40, P.muted, 2.5, 0.6); ctx.fxW.add(this.rA, this.rB);
    this.storm = new ctx.THREE.Group(); ctx.fxW.add(this.storm);
    for (const R of [RM, 100e3, 200e3]) this.storm.add(Line(arcPts(0, 0, R / U, 0, 2 * Math.PI, 3, 90), P.bad, { dash: 120, opacity: R === RM ? 0.9 : 0.45 }));
    const c = Dot(P.bad, 160); c.position.y = 6; this.storm.add(c);
    this.arrows = []; for (let i = -4; i <= 4; i++) for (let k = -4; k <= 4; k++) { if (!i && !k) continue; const a = Arrow(P.air1, 18, { top: true }); this.storm.add(a); this.arrows.push([i * 1100, k * 1100, a]); }
    this.lC = ctx.label('<b style="color:var(--bad)">태풍 중심</b>', 'dim', o => o.copy(this.storm.position).add(V3(0, 60, 500)));
    this.lR = ctx.label('위험 반원', 'dim', o => o.copy(this.storm.position).add(V3(0, 60, 3200))); this.lL = ctx.label('가항 반원', 'dim', o => o.copy(this.storm.position).add(V3(0, 60, -3200)));
    this.boat = Arrow(P.deck, 70, { top: true }); ctx.fxW.add(this.boat); this.lS = ctx.label('<b>본선</b>', 'dim', o => o.copy(this.pS || V3()).add(V3(0, 60, 0)));
    const R = p.side === 'R', rule = p.mode === 'rule', dmin = Math.min(...A.d) / 1000;
    this.steps = [
      { t: 0, h: R ? '태풍 진로 오른쪽: 위험 반원' : '태풍 진로 왼쪽: 가항 반원', p: R ? '북반구 태풍은 반시계 방향으로 돈다. 진로 오른쪽은 회전 바람과 태풍의 진행이 더해져 바람이 세고 배를 진로 앞쪽으로 밀어 넣는다. 그래서 우반원을 위험 반원이라 한다.' : '진로 왼쪽은 회전 바람이 일반 대기 흐름과 상쇄돼 약해지고, 배를 태풍 뒤쪽으로 밀어낸다. 그래서 좌반원을 가항 반원이라 한다.' },
      { t: 6, h: R ? '바람이 시계 방향으로 바뀐다' : '바람이 반시계 방향으로 바뀐다', p: R ? '태풍이 다가오며 지나갈 때 우반원에서는 풍향이 시계 방향(R)으로 돈다. 풍향 변화로 자기가 어느 반원에 있는지 판단한다.' : '좌반원에서는 풍향이 반시계 방향(L)으로 돈다.' },
      { t: 12, h: rule ? (R ? 'RRR: 우현 선수에 바람' : 'LLR: 우현 선미에 바람') : '원래 침로로 진로를 가로지르면', p: rule ? (R ? '풍향이 시계 방향(R)으로 바뀌면 우반원(R)이므로, 바람을 우현 선수(R)에 받으며 나아가 중심에서 벗어난다.' : '풍향이 반시계 방향(L)으로 바뀌면 좌반원(L)이므로, 바람과 풍랑을 우현 선미(R)에 받으며 나아가 중심에서 벗어난다. 이처럼 뒤에서 바람을 받으며 빠져나가는 것을 스커딩(scudding)이라 한다.') : `태풍 앞을 가로질러 가면 중심에 약 ${fmt(dmin, 0)} km까지 가까워진다. 진행 방향 앞쪽은 특히 위험하다.` },
      { t: 22, h: rule ? `가장 가까울 때 ${fmt(dmin, 0)} km` : `가장 가까울 때 ${fmt(dmin, 0)} km`, p: '최대 풍속 반지름(가장 안쪽 빨간 원) 안으로 들지 않는 것이 목표다. 거리가 멀어질수록 바람과 파도가 약해진다. 회색 항적은 다른 조선을 했을 때다.' }
    ];
  },
  apply(t) {
    const A = this.A, B = this.B, i = Math.min(A.n - 1, Math.round(t * this.scale)), cx = A.cx[i] / U;
    this.storm.position.set(cx, 0, 0); this.rA.setCount(i / 4); this.rB.setCount(i / 4);
    for (const [ax, az, a] of this.arrows) { const w = wind(ax * U, az * U), L = 120 + w.sp * 14; a.set(V3(ax, 8, az), V3(w.n, 0, w.e).normalize(), L); a.mat?.color?.set(w.sp > 25 ? this.ctx.P.bad : this.ctx.P.air1); }
    const x = A.x[i] / U, z = A.z[i] / U; this.pS = V3(x, 10, z); this.boat.set(V3(x - 260 * Math.cos(A.h[i]), 10, z - 260 * Math.sin(A.h[i])), V3(Math.cos(A.h[i]), 0, Math.sin(A.h[i])), 520);
    this.ctx.ship.pose(x, z, A.h[i]); this.i = i;
  },
  read() {
    const A = this.A, i = this.i, h = ((A.h[i] / DEG) % 360 + 360) % 360, rel = ((A.fb[i] - h) % 360 + 360) % 360;
    const side = rel < 180 ? '우현' : '좌현', rr = rel < 180 ? rel : 360 - rel, part = rr < 60 ? '선수' : rr > 120 ? '선미' : '정횡';
    return [['경과 시간', fmt(i * DT / 3600, 1) + ' 시간'], ['태풍 중심까지', fmt(A.d[i] / 1000, 0) + ' km', A.d[i] < 80e3 ? 'bad' : A.d[i] < 150e3 ? 'warn' : 'ok'], ['풍향 · 풍속', fmt(A.fb[i], 0) + '°에서 ' + fmt(A.sp[i], 0) + ' m/s', A.sp[i] > 25 ? 'bad' : ''], ['풍향 변화 (처음부터)', (A.fb[i] - A.fb[0] >= 0 ? '시계 방향 ' : '반시계 방향 ') + fmt(Math.abs(A.fb[i] - A.fb[0]), 0) + '°'], ['본선 침로', fmt(h, 0) + '°'], ['바람을 받는 곳', side + ' ' + part + ' (' + fmt(rr, 0) + '°)']];
  },
  chart(cv, P, { lineChart }) {
    const a = [], b = []; for (let i = 0; i < this.A.n; i += 6) { a.push([i * DT / 3600, this.A.d[i] / 1000]); b.push([i * DT / 3600, this.B.d[i] / 1000]); }
    lineChart(cv, P, { x0: 0, x1: HRS, upto: this.i * DT / 3600, cursor: this.i * DT / 3600, xt: [[0, '0'], [4, '4시간'], [8, '8'], [12, '12'], [16, '16시간']], series: [{ data: a, color: P.deck, min: 0, max: 500, yt: [0, 100, 200, 400], hlines: [RM / 1000], label: '본선 km' }, { data: b, color: P.muted, min: 0, max: 500, label: '다른 조선', dash: [4, 3] }] });
  }
};
