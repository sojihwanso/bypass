/* 8-4 접이안: 부두 앞 예정 정지점까지 거리 D에서 후진을 걸 때의 안전 여유 σ = A/D (A: 실제 정지점과 예정 정지점 사이 남은 거리)
   멈춘 뒤에는 입항자세 좌현 접안(정창현 『선박조종학』 Vol.3 Ch4, 고교 『선박 운용』 Ⅴ):
   우현 선수·선미 예선이 밀어 선수가 먼저 부두에 닿고, 선수를 축으로 선미가 따라 붙는다.
   계선줄은 히빙 라인을 먼저 던져 건네고, 스프링 라인(back spring)을 가장 먼저, 이어 Head line·Stern line·Breast line을 내어
   Head line과 Stern line을 함께 감아 들여 고정한다 */
import { SH, DEG, KN, hullHalfWidth as hw } from '../physics/ship.js';
import { Line, Ribbon, Arrow, Dot, V3, setLine } from '../engine/draw.js';
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

/* ---- 옆으로 붙이기 ----
   옆 방향 질량은 부가 질량을 배수량만큼 더해 2배(6-2 예선 모델과 같음), 옆 방향 저항 Cv·v|v|. 예선 한 척이 배의 절반을 맡는다 */
const ML = SH.disp * 1000 * 2.0, CV = 0.5 * 1025 * 0.9 * SH.L * SH.T;
const FENDER = 1.5;                       /* 착안했을 때 선체와 안벽 사이(방현재 두께) */
const VMAX = 0.25, VLAND = 0.07;          /* 옆 속력 최대 0.25 m/s, 착안 속력 7 cm/s(대형선 권고 0.1 m/s 이하) */
const T_COME = 60, T_ACC = 90, T_DEC = 150, LAG = 70; /* 예선 접근, 가속, 감속(초), 선미가 선수보다 늦게 움직이는 시간 */
const XF = 36, XA = -78;                  /* 평행부 앞끝(선수 어깨)·뒤끝(선미 어깨): 여기가 방현재에 닿는다 */
const TUG_X = 0.3 * SH.L, TUG_OFF = 16.5, TUG_PULL = 34, TUG_WAIT = 170; /* 예선: 무게중심 앞뒤 0.3L, 선체에서 예선 중심까지 */
const BP = 50, HOLD = 5;                  /* 예선 한 척 예인력(t, 가정), 붙여 둘 때 미는 힘 */
const sm = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
/* 옆 이동 Y(m)를 가속 → 등속 → 감속(착안 속력까지)으로 간다. 1초 간격: y, v, 예선 한 척 힘(t, + 미는 쪽) */
function sideRun(Y) {
  const dA = 0.5 * VMAX * T_ACC, dD = 0.5 * (VMAX + VLAND) * T_DEC, tc = Math.max(0, (Y - dA - dD) / VMAX);
  const o = { y: [], v: [], f: [] }; let y = 0, t = 0;
  const vAt = t => t < T_ACC ? VMAX * t / T_ACC : t < T_ACC + tc ? VMAX : VMAX + (VLAND - VMAX) * Math.min(1, (t - T_ACC - tc) / T_DEC);
  while (y < Y && t < 4000) {
    const v = vAt(t), a = (vAt(t + 1) - vAt(Math.max(0, t - 1))) / (t ? 2 : 1);
    o.y.push(y); o.v.push(v); o.f.push((ML * a + CV * v * v) / 9810 / 2); y += v; t += 1;
  }
  o.y.push(Y); o.v.push(0); o.f.push(HOLD); o.T = t; o.tDec = T_ACC + tc; return o;
}
const at = (s, k) => { if (k <= 0) return { y: 0, v: 0, f: 0, on: false }; if (k >= s.T) return { y: s.y[s.y.length - 1], v: 0, f: HOLD, on: true, done: true }; const i = Math.floor(k), w = k - i; return { y: s.y[i] + (s.y[i + 1] - s.y[i]) * w, v: s.v[i], f: s.f[i], on: true }; };
/* 배 기준점 (x, y, z) → 세계 좌표 (pose: 위치 X, Z, 선수방위 psi) */
const toW = (X, Z, psi, x, y, z) => V3(X + x * Math.cos(psi) - z * Math.sin(psi), y, Z + x * Math.sin(psi) + z * Math.cos(psi));
/* 굵기가 있는 밧줄(튜브). 1픽셀 선보다 잘 보이게 실제보다 굵게 그린다 */
function Rope(T3, color, r) {
  const m = new T3.Mesh(new T3.BufferGeometry(), new T3.MeshBasicMaterial({ color }));
  m.frustumCulled = false; m.renderOrder = 5;
  m.set = pts => { if (pts[0].distanceTo(pts[pts.length - 1]) < 0.5) { m.visible = false; return; } m.geometry.dispose(); m.geometry = new T3.TubeGeometry(new T3.CatmullRomCurve3(pts), pts.length + 4, r, 6, false); };
  return m;
}
/* 처진 줄: a→b, 가운데가 sag만큼 처진다 */
const sagPts = (a, b, sag, n = 14) => { const p = []; for (let i = 0; i <= n; i++) { const u = i / n, q = a.clone().lerp(b, u); q.y -= sag * 4 * u * (1 - u); p.push(q); } return p; };

/* 계선줄: 배 쪽 x, 부두 쪽 x (L 단위, 배 무게중심 기준), 어느 끝(선수 bow / 선미 stern / 가운데 mid)에서 내는가, 그 끝에서 몇 번째인가 */
const MOOR = [
  { n: 'Back spring', sx: 0.22, qx: -0.02, end: 'bow', k: 0 },
  { n: 'Head line', sx: 0.47, qx: 0.69, end: 'bow', k: 1 },
  { n: 'After spring', sx: -0.22, qx: 0.02, end: 'stern', k: 0 },
  { n: 'Stern line', sx: -0.45, qx: -0.67, end: 'stern', k: 1 },
  { n: 'Fore breast', sx: 0.36, qx: 0.36, end: 'mid', k: 0 },
  { n: 'After breast', sx: -0.36, qx: -0.36, end: 'mid', k: 1 }
];
const HL_GAP = 30, HL_FLY = 12, PAY = 30; /* 히빙 라인을 던지는 거리(m), 날아가는 시간, 계선줄이 부두까지 건너가는 시간(초) */

export default {
  id: 'berth', dur: 60,
  controls: [
    { k: 'D', label: '예정 정지점까지 거리', type: 'seg', opts: [[500, '500 m'], [1000, '1,000 m'], [2000, '2,000 m']], val: 1000 },
    { k: 'U', label: '그때 속력', type: 'range', min: 1, max: 10, step: 0.5, val: 2.5, fmt: v => fmt(v, 1) + ' kn' },
    { k: 'lv', label: '후진 기관', type: 'seg', opts: Object.entries(ASTERN).map(([k, v]) => [k, v[0]]), val: 'ds' }
  ],
  cam: { r: 1500, th: 2.3, ph: 0.75, follow: true }, water: { alpha: 0.55, amp: 0.15 }, parts: ['propeller', 'rudder'],
  legend: [['deck', '지나온 길'], ['amber', '예정 정지점 · 예선 추력'], ['bad', '오버런'], ['sand', '부두'], ['warn', '히빙 라인'], ['info', '계선줄']],
  chartTitle: '예정 정지점까지 거리에 따른 접근 속력 지침 (모델 값)',
  /* 재생 시간 ↔ 실제 시간: 멈추기까지는 빠르게, 접안 작업은 천천히 보이도록 구간마다 배율이 다르다 */
  get scale() { const t = this.tAnim || 0; return t > 0 ? this.realAt(t) / t : (this.R ? this.R[1] / this.A[1] : 1); },
  realAt(t) { const A = this.A, R = this.R; for (let i = 1; i < A.length; i++) if (t <= A[i] || i === A.length - 1) return R[i - 1] + (R[i] - R[i - 1]) * cl((t - A[i - 1]) / (A[i] - A[i - 1]), 0, 1); return 0; },
  animAt(s) { const A = this.A, R = this.R; for (let i = 1; i < R.length; i++) if (s <= R[i] || i === R.length - 1) return A[i - 1] + (A[i] - A[i - 1]) * cl((s - R[i - 1]) / (R[i] - R[i - 1]), 0, 1); return 0; },
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, T3 = ctx.THREE, D = +p.D, U0 = p.U * KN;
    const run = stopRun(U0, p.lv); this.run = run; this.D = D;
    const A = D - run.S, sig = A / D; this.sig = sig; this.A0 = A;
    const zq = -(hw(0, SH.T) + 2 * SH.B); this.zq = zq;
    const xs = run.S - D; this.xs = xs;
    /* 방현재까지 옆 이동 거리(평행부 기준) */
    const Y = -(zq + FENDER) - SH.B / 2; this.Y = Y; const side = sideRun(Y); this.side = side;
    this.t1 = run.T + 10; this.t2 = this.t1 + T_COME;
    this.tBow = this.t2 + side.T; this.tStern = this.tBow + LAG;
    const iHL = side.y.findIndex(y => Y - y <= HL_GAP); this.tHLb = this.t2 + (iHL < 0 ? side.T : iHL); this.tHLs = Math.max(this.tHLb + LAG, this.tBow + 5);
    this.tMid = this.tStern + 15; this.tHeave = this.tStern + 60; this.tFree = this.tHeave + 45; this.tEnd = this.tFree + 60;
    this.A = [0, 16, 20, this.dur]; this.R = [0, this.t1, this.t2, this.tEnd]; this.tAnim = 0;
    /* 줄마다 내보내는 시각: 끝마다 히빙 라인 → 스프링 먼저 → 다음 줄 */
    this.moorT = MOOR.map(m => (m.end === 'bow' ? this.tHLb + HL_FLY : m.end === 'stern' ? this.tHLs + HL_FLY : this.tMid) + m.k * 22);
    /* 부두: 배가 멈춘 곳까지 넉넉히 덮는다 */
    const qx0 = -D - 600, qx1 = Math.max(1200, xs + SH.L), qL = qx1 - qx0;
    const quay = new T3.Mesh(new T3.BoxGeometry(qL, 12, 40), new T3.MeshStandardMaterial({ color: P.sand, roughness: 0.9 })); quay.position.set((qx0 + qx1) / 2, 2, zq - 20); ctx.fxW.add(quay);
    /* 방현재와 계선주 */
    const fMat = new T3.MeshStandardMaterial({ color: '#2B2B2B', roughness: 0.8 }), bMat = new T3.MeshStandardMaterial({ color: '#3A4047', roughness: 0.6, metalness: 0.3 });
    for (let x = xs - SH.L * 0.6; x <= xs + SH.L * 0.6; x += 30) { const fd = new T3.Mesh(new T3.CylinderGeometry(FENDER / 2, FENDER / 2, 5, 12), fMat); fd.position.set(x, 3.5, zq + FENDER / 2); ctx.fxW.add(fd); }
    this.yDeck = SH.D - SH.T + 1;
    this.moor = MOOR.map((m, j) => {
      const q = V3(xs + m.qx * SH.L, 9, zq - 3);
      const bol = new T3.Mesh(new T3.CylinderGeometry(0.9, 1.1, 1.8, 12), bMat); bol.position.set(q.x, 8.9, q.z); ctx.fxW.add(bol);
      const l = Rope(T3, P.info, 0.55); l.visible = false; ctx.fxW.add(l);
      const o = { ...m, t0: this.moorT[j], q, l, mid: V3(), on: false };
      ctx.label(`<b style="color:var(--info)">${m.n}</b>`, 'dim', v => o.on ? v.copy(o.mid).setY(o.mid.y + 6) : null);
      return o;
    });
    /* 히빙 라인 셋(선수·선미·가운데): 끝에 원숭이 주먹 매듭(모래주머니) */
    this.hl = ['bow', 'stern', 'mid'].map(end => {
      const l = Rope(T3, P.warn, 0.25); l.visible = false; ctx.fxW.add(l);
      const fist = Dot(P.warn, 1.2); fist.visible = false; ctx.fxW.add(fist);
      const m = MOOR.find(x => x.end === end && x.k === 0);
      return { end, l, fist, sx: m.sx, q: V3(xs + m.qx * SH.L, 9.5, zq - 6), t0: end === 'bow' ? this.tHLb : end === 'stern' ? this.tHLs : this.tMid - HL_FLY };
    });
    this.hlL = ctx.label('<b style="color:var(--warn)">히빙 라인</b>', 'dim', v => { const h = this.hlNow; return h ? v.copy(h).setY(h.y + 8) : null; });
    ctx.fxW.add(Line([V3(0, 1, zq), V3(0, 1, 120)], P.amber, { top: true }));
    ctx.label('<b style="color:var(--amber)">예정 정지점</b>', 'dim', o => o.set(0, 20, 130));
    const g = []; for (let i = 0; i < run.x.length; i += 5) g.push([run.x[i] - D, 0]); g.push([run.S - D, 0]); this.rib = Ribbon(g, 6, P.deck, 0.6, 0.85); ctx.fxW.add(this.rib);
    if (A < 0) { ctx.fxW.add(Line([V3(0, 2, 40), V3(-A, 2, 40)], P.bad, { top: true })); ctx.label(`<b style="color:var(--bad)">오버런 ${fmt(-A, 0)} m</b>`, 'dim', o => o.set(-A / 2, 24, 60)); }
    /* 예선 두 척(우현 선수 쪽·선미 쪽) */
    this.tugs = [ctx.tug, ctx.tug2].map((tg, k) => {
      tg.visible = true; const xa = k ? -TUG_X : TUG_X;
      const ar = Arrow(P.amber, 1.4, { top: true }); ctx.fxW.add(ar);
      const tow = Line([V3(), V3()], P.ink || '#222', { opacity: 0.9 }); tow.visible = false; ctx.fxW.add(tow);
      return { tg, xa, ar, tow, pk: 0, lag: k ? LAG : 0, name: k ? '예선 2 (선미 쪽)' : '예선 1 (선수 쪽)' };
    });
    this.tugs.forEach(T => ctx.label(`<b>${T.name}</b>`, 'dim', o => o.set(T.tg.position.x, 18, T.tg.position.z)));
    this.landL = ctx.label('', 'dim', o => o.set(xs + XF, 26, zq + 10));
    const lv = ASTERN[p.lv][0], zone = this.zoneOf(p.U, D), ta = s => this.animAt(s);
    this.steps = [
      { t: 0, h: `${fmt(D, 0)} m 앞에서 ${lv}`, p: `예정 정지점까지 ${fmt(D, 0)} m 남은 곳에서 ${fmt(p.U, 1)}노트로 ${lv}을 건다. 후진 추력이 다 걸리기까지 약 ${RAMP}초가 걸린다고 두었다. 우현 바깥에는 예선 두 척이 기다린다.` },
      { t: ta(run.T * 0.5), h: '타력으로 나아간다', p: '배는 무거워 후진을 걸어도 한참 나아간다. 속력이 줄수록 물의 저항도 줄어 마지막에는 후진 추력만으로 멈춘다.' },
      { t: ta(run.T), h: A < 0 ? `오버런: 정지점을 ${fmt(-A, 0)} m 지남` : `안전 여유 σ = ${fmt(sig, 2)}`, p: (A < 0 ? '예정 정지점을 지나쳤다. 부두 앞에서는 다른 배, 안벽과 부딪치거나 좌초할 수 있다. ' : `정지점 ${fmt(A, 0)} m 앞에서 멈췄다. `) + zone[1] + ' 배는 부두와 나란히, 선폭의 약 2배 떨어져 멈췄다.' },
      { t: ta(this.t1), h: '예선이 와서 붙는다', p: '우현 선수 쪽과 선미 쪽(무게중심에서 앞뒤로 0.3L)에 예선이 와서 선체에 붙는다. 교재는 예선을 쓸 때 우현 선수에 두어 선수가 지나치게 도는 것을 막도록 권한다. 예선은 밀기와 당기기를 모두 할 수 있게 처음부터 줄을 잡아 둔다(push-pull).' },
      { t: ta(this.t2), h: '선수 쪽부터 민다', p: `선수 예선이 먼저 밀고 선미 예선은 약 ${LAG}초 늦게 민다. 배는 좌현 선수를 부두 쪽으로 조금 돌린 채(소각도) 옆으로 다가간다. 교재의 입항자세 좌현 접안처럼 좌현 선수로 부두에 다가가는 자세다. 옆 속력은 0.25 m/s(약 0.5노트)를 넘기지 않는다.` },
      { t: ta(this.tHLb), h: '히빙 라인을 던진다', p: `선수가 부두에서 약 ${HL_GAP} m까지 오면 갑판원이 히빙 라인을 부두로 던진다. 히빙 라인은 끝에 모래주머니 매듭(monkey fist)이 달린 가는 줄로, 다른 끝은 계선줄에 묶여 있다. 부두의 줄잡이가 이 줄을 당겨 무거운 계선줄을 끌어 간다.` },
      { t: ta(this.tHLb + HL_FLY), h: '스프링 라인을 가장 먼저', p: '선수에서 Fore spring(back spring)을 먼저 내보내 부두 계선주에 건다. 스프링 라인은 접안할 때 처음으로 내보내고 이안할 때 마지막으로 푸는 줄이다. back spring의 장력은 배가 앞으로 나가는 것을 막는다. 이어서 Head line을 낸다.' },
      { t: ta(this.t2 + side.tDec), h: '부두 가까이에서는 당겨서 줄인다', p: '안벽에 세게 닿지 않도록 예선이 반대쪽으로 당겨 옆 속력을 줄인다.' },
      { t: ta(this.tBow), h: `선수가 먼저 닿는다 (${fmt(VLAND * 100, 0)} cm/s)`, p: '좌현 선수 쪽이 먼저 방현재에 닿는다. 선수 예선은 가볍게 밀어 선수를 붙여 두고, 선미 예선이 선미를 마저 민다. 배는 선수를 축으로 돌며 부두와 나란해진다.' },
      { t: ta(this.tHLs + HL_FLY), h: '선미에서도 줄을 낸다', p: '선미에서도 히빙 라인을 던지고 After spring, Stern line을 내보낸다. 선미 쪽 줄은 프로펠러에 감기지 않게 기관 사용에 주의한다.' },
      { t: ta(this.tStern), h: '선미가 붙어 부두와 나란히', p: `선미도 ${fmt(VLAND * 100, 0)} cm/s로 방현재에 닿아 선체 전체가 부두와 나란해졌다. 가운데에서 Breast line을 내어 옆으로 벌어지는 것을 막는다.` },
      { t: ta(this.tHeave), h: 'Head line과 Stern line을 함께 감는다', p: '계선 윈치로 Head line과 Stern line을 함께 감아 들여 배를 부두에 고정한다. 처져 있던 줄이 팽팽해진다. 보통 Head line·Stern line 각 3가닥, Spring 각 2가닥을 잡지만 장면에는 한 가닥씩만 그렸다.' },
      { t: ta(this.tFree), h: '예선을 풀어 보낸다', p: '계선줄을 다 잡으면 예선 줄을 풀어 예선을 보낸다. 접안 끝.' }
    ].sort((a, b) => a.t - b.t);
    this.st = { u: U0, v: 0, r: 0, n: -30, cref: U0 };
  },
  zoneOf(U, D) {
    const red = speedFor(D, 'fu'), avail = speedFor(D, 'ds'), r3 = speedFor(D, 'ds', 0.3), r6 = speedFor(D, 'ds', 0.6);
    if (U > red) return ['적색', '이 거리에서 이 속력은 전속 후진으로도 정지점 안에 멈추지 못하는 적색 범위다. 극도로 주의해야 할 속력이다.'];
    if (U > avail) return ['황색', '미속·반속·전속 후진으로는 멈출 수 있지만 극미속 후진으로는 못 멈추는 황색 범위다. 후진 기관이 뜻대로 안 될 수도 있어 도선사들은 이 범위를 피한다.'];
    if (U >= r6 && U <= r3) return ['권고', '극미속 후진으로 안전 여유 0.3~0.6에 드는 권고 속력이다. 도선사의 3분의 2가 이 범위를 알맞다고 답했다.'];
    return ['가능', U > r3 ? '극미속 후진으로 멈출 수는 있지만 여유가 0.3보다 작다. 대담한 쪽에 가깝다.' : '여유가 0.6보다 커서 신중한 쪽이다. 접근에 시간이 더 걸린다.'];
  },
  /* 실제 시각 ts의 배 자세: 선수 어깨(XF)와 선미 어깨(XA)가 각각 옆으로 간 거리로 위치와 선수방위를 정한다 */
  poseAt(ts) {
    const k = ts - this.t2, f = at(this.side, k), a = at(this.side, k - LAG);
    const s = cl((a.y - f.y) / (XF - XA), -0.3, 0.3), psi = Math.asin(s), Z = -f.y - XF * s;
    return { Z, psi, f, a };
  },
  apply(t) {
    this.tAnim = t;
    const run = this.run, ts = this.realAt(t), i = Math.min(run.x.length - 1, Math.round(ts)), ship = this.ctx.ship, lv = ASTERN[this.p.lv][1];
    const ps = this.poseAt(ts); this.ps = ps; const { Z, psi } = ps, X = run.x[i] - this.D;
    ship.pose(X, Z, psi); ship.prop.rotation.x += run.u[i] > 0 ? 0.05 * lv : 0; this.rib.setCount(i / 5); this.i = i; this.ts = ts;
    Object.assign(this.st, { u: run.u[i], v: (ps.f.v + ps.a.v) / 2, r: 0, n: run.u[i] > 0 ? -60 * lv : 0 });
    /* 예선: 기다림 → 접근 → 밀기/당기기 → 붙여 두기 → 풀려 나감 */
    const come = sm((ts - this.t1) / T_COME), leave = sm((ts - this.tFree) / 40);
    for (const T of this.tugs) {
      const st = at(this.side, ts - this.t2 - T.lag), pullK = st.on && !st.done && st.f < 0 ? 1 : 0;
      T.pk += (pullK - T.pk) * 0.15; if (Math.abs(T.pk - pullK) < 0.02) T.pk = pullK;
      const hz = hw(T.xa, SH.T), off = TUG_OFF + (TUG_PULL - TUG_OFF) * T.pk + 120 * leave;
      const att = toW(X, Z, psi, T.xa, 0, hz + off), wait = V3(this.xs + T.xa, 0, TUG_WAIT);
      T.tg.position.copy(come < 1 ? wait.lerp(att, come) : att); T.tg.rotation.set(0, Math.PI / 2 - psi, 0);
      const f = come >= 1 && leave < 1 ? (st.on ? st.f : 0) : 0, push = f > 0;
      for (const pr of T.tg.userData.pods || []) pr.rotation.x += 0.02 + 0.06 * Math.min(1, Math.abs(f) / BP) * (push ? 1 : -1);
      const len = Math.abs(f) < 0.3 ? 0 : 10 + 40 * Math.min(1, Math.abs(f) / BP), sideP = toW(X, Z, psi, T.xa, 14, hz + 2), dir = V3(Math.sin(psi), 0, -Math.cos(psi));
      T.ar.set(push ? sideP.clone().addScaledVector(dir, -len) : sideP, push ? dir : dir.clone().negate(), len);
      const showTow = T.pk > 0.3 && leave < 0.5;
      T.tow.visible = showTow; if (showTow) setLine(T.tow, [toW(X, Z, psi, T.xa, 9, hz + 0.5), toW(X, Z, psi, T.xa, 4, hz + off - 15)]);
    }
    /* 계선줄: 배 쪽 끝은 배를 따라 움직이고, 부두 쪽 끝은 계선주로 건너간 뒤 감겨 팽팽해진다 */
    const heave = sm((ts - this.tHeave) / 40);
    for (const m of this.moor) {
      const u = cl((ts - m.t0) / PAY, 0, 1); m.on = ts > m.t0;
      m.l.visible = m.on; if (!m.on) continue;
      const a = toW(X, Z, psi, m.sx * SH.L, this.yDeck, -hw(m.sx * SH.L, SH.D) + 0.5), b = a.clone().lerp(m.q, sm(u));
      const sag = (u < 1 ? 2 + 6 * u : 8) * (1 - heave) + 0.6 * heave;
      m.l.set(sagPts(a, b, sag)); m.mid.copy(a).lerp(b, 0.5); m.mid.y -= sag;
    }
    /* 히빙 라인: 포물선으로 날아가 부두에 떨어지고, 계선줄이 건너가면 걷는다 */
    this.hlNow = null;
    for (const h of this.hl) {
      const u = (ts - h.t0) / HL_FLY, vis = u > 0 && ts < h.t0 + HL_FLY + PAY;
      h.l.visible = h.fist.visible = vis; if (!vis) continue;
      const a = toW(X, Z, psi, h.sx * SH.L + 4, this.yDeck + 1.5, -hw(h.sx * SH.L, SH.D)), k = cl(u, 0, 1), pts = [];
      for (let j = 0; j <= 16; j++) { const w = k * j / 16, q = a.clone().lerp(h.q, w); q.y += u < 1 ? 22 * 4 * w * (1 - w) : -1.5 * 4 * w * (1 - w); pts.push(q); }
      h.l.set(pts); h.fist.position.copy(pts[pts.length - 1]); if (u < 1.4) this.hlNow = pts[pts.length - 1];
    }
    const gapF = Math.max(0, this.Y - ps.f.y), gapA = Math.max(0, this.Y - ps.a.y);
    this.landL.set(ts >= this.tStern ? `<b>착안</b><i>선수·선미 ${fmt(VLAND * 100, 0)} cm/s</i>` : ts >= this.tBow ? `<b>선수 착안</b><i>선미까지 ${fmt(gapA, 0)} m</i>` : ts > this.t2 ? `<b>부두까지</b><i>선수 ${fmt(gapF, 0)} m · 선미 ${fmt(gapA, 0)} m</i>` : '');
  },
  read() {
    const run = this.run, i = this.i, left = this.D - run.x[i], z = this.zoneOf(this.p.U, this.D), ps = this.ps || { f: { y: 0, v: 0, f: 0 }, a: { y: 0, v: 0, f: 0 }, psi: 0 }, ts = this.ts || 0;
    const rows = [['경과 시간', realTime(ts)], ['속력', fmt(run.u[i] / KN, 1) + ' kn'], ['예정 정지점까지', left >= 0 ? fmt(left, 0) + ' m' : '지남 ' + fmt(-left, 0) + ' m', left < 0 ? 'bad' : ''], ['정지 거리', fmt(run.S, 0) + ' m'], ['안전 여유 σ = A/D', this.A0 < 0 ? '0 미만 (오버런)' : fmt(this.sig, 2), this.A0 < 0 ? 'bad' : this.sig < 0.3 ? 'warn' : 'ok'], ['속력 범위', z[0], z[0] === '적색' ? 'bad' : z[0] === '황색' ? 'warn' : 'ok']];
    const gap = s => s.done ? '착안' : fmt(Math.max(0, this.Y - s.y), 0) + ' m';
    rows.push(['부두까지 선수 · 선미', gap(ps.f) + ' · ' + gap(ps.a), ps.a.done ? 'ok' : '']);
    rows.push(['부두와 이루는 각', fmt(Math.abs(ps.psi) / DEG, 1) + '°' + (Math.abs(ps.psi) > 0.002 ? ' (선수가 부두 쪽)' : '')]);
    rows.push(['옆 속력 선수 · 선미', fmt(ps.f.v * 100, 0) + ' · ' + fmt(ps.a.v * 100, 0) + ' cm/s', Math.max(ps.f.v, ps.a.v) > 0.15 ? 'warn' : '']);
    const tf = s => !s.on ? '—' : s.done ? '붙여 두기' : (s.f >= 0 ? '밀기 ' : '당기기 ') + fmt(Math.abs(s.f), 0) + ' t';
    rows.push(['예선 힘 선수 · 선미', ts >= this.tFree ? '풀어 보냄' : tf(ps.f) + ' · ' + tf(ps.a) + (ps.f.on ? ' (모델 값)' : '')]);
    rows.push(['계선줄', this.moor ? (this.moor.filter(m => ts >= m.t0 + PAY).length + ' / ' + this.moor.length + (ts >= this.tHeave + 40 ? ' · 감아 고정' : '')) : '—']);
    return rows;
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
