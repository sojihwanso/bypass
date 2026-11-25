/* 8-4 접이안: 부두 앞 예정 정지점까지 거리 D에서 후진을 걸 때의 안전 여유 σ = A/D (A: 실제 정지점과 예정 정지점 사이 남은 거리)
   멈춘 뒤에는 예선 두 척이 우현에서 밀어 좌현을 부두에 붙이고(부두 가까이에서는 당겨서 속력을 줄인다), 계선줄을 잡는다 */
import { SH, DEG, KN, hullHalfWidth as hw } from '../physics/ship.js';
import { Line, Ribbon, Arrow, V3, setLine } from '../engine/draw.js';
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

/* ---- 옆으로 붙이기(예선 두 척) ----
   옆 방향 질량은 부가 질량을 배수량만큼 더해 2배(6-2 예선 모델과 같음), 옆 방향 저항 Cv·v|v| */
const ML = SH.disp * 1000 * 2.0, CV = 0.5 * 1025 * 0.9 * SH.L * SH.T;
const FENDER = 1.5;                       /* 착안했을 때 선체와 안벽 사이(방현재 두께) */
const VMAX = 0.25, VLAND = 0.07;          /* 옆 속력 최대 0.25 m/s, 착안 속력 7 cm/s(대형선 권고 0.1 m/s 이하) */
const T_COME = 60, T_ACC = 90, T_DEC = 150, T_HOLD = 100; /* 예선 접근, 가속, 감속, 붙인 뒤 계선줄 잡기(초) */
const TUG_X = 0.3 * SH.L, TUG_OFF = 16.5, TUG_PULL = 34, TUG_WAIT = 170; /* 예선 위치: 무게중심 앞뒤 0.3L, 선체에서 예선 중심까지 */
const BP = 50;                            /* 예선 한 척의 예인력(t, 가정) */
const sm = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
/* 옆 이동 Y(m)를 가속 → 등속 → 감속(착안 속력까지)으로 간다. 1초 간격 표: y, v, 예선 한 척 힘(t, + 미는 쪽) */
function sideRun(Y) {
  const dA = 0.5 * VMAX * T_ACC, dD = 0.5 * (VMAX + VLAND) * T_DEC, tc = Math.max(0, (Y - dA - dD) / VMAX);
  const o = { y: [], v: [], f: [] }; let y = 0, t = 0;
  const vAt = t => t < T_ACC ? VMAX * t / T_ACC : t < T_ACC + tc ? VMAX : VMAX + (VLAND - VMAX) * Math.min(1, (t - T_ACC - tc) / T_DEC);
  while (y < Y && t < 4000) {
    const v = vAt(t), a = (vAt(t + 1) - vAt(t - 1 < 0 ? 0 : t - 1)) / (t ? 2 : 1);
    o.y.push(y); o.v.push(v); o.f.push((ML * a + CV * v * v) / 9810 / 2); y += v; t += 1;
  }
  o.y.push(Y); o.v.push(0); o.f.push(o.f[o.f.length - 1] || 0); o.T = t; o.tDec = T_ACC + tc; return o;
}

export default {
  id: 'berth', dur: 50,
  controls: [
    { k: 'D', label: '예정 정지점까지 거리', type: 'seg', opts: [[500, '500 m'], [1000, '1,000 m'], [2000, '2,000 m']], val: 1000 },
    { k: 'U', label: '그때 속력', type: 'range', min: 1, max: 10, step: 0.5, val: 2.5, fmt: v => fmt(v, 1) + ' kn' },
    { k: 'lv', label: '후진 기관', type: 'seg', opts: Object.entries(ASTERN).map(([k, v]) => [k, v[0]]), val: 'ds' }
  ],
  cam: { r: 1500, th: 2.3, ph: 0.75, follow: true }, water: { alpha: 0.55, amp: 0.15 }, parts: ['propeller', 'rudder'],
  legend: [['deck', '지나온 길'], ['amber', '예정 정지점 · 예선 추력'], ['bad', '오버런'], ['sand', '부두'], ['info', '계선줄']],
  chartTitle: '예정 정지점까지 거리에 따른 접근 속력 지침 (모델 값)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, T3 = ctx.THREE, D = +p.D, U0 = p.U * KN;
    const run = stopRun(U0, p.lv); this.run = run; this.D = D;
    const A = D - run.S, sig = A / D; this.sig = sig; this.A = A;
    const zq = -(hw(0, SH.T) + 2 * SH.B); this.zq = zq;
    /* 멈춘 뒤 옆으로 붙이기 */
    const xs = run.S - D; this.xs = xs;
    const zEnd = zq + hw(0, SH.D) + FENDER, side = sideRun(-zEnd); this.side = side; this.zEnd = zEnd;
    this.t1 = run.T + 10; this.t2 = this.t1 + T_COME; this.t3 = this.t2 + side.T; this.tEnd = this.t3 + T_HOLD;
    this.scale = this.tEnd / this.dur;
    /* 부두: 배가 멈춘 곳까지 넉넉히 덮는다 */
    const qx0 = -D - 600, qx1 = Math.max(1200, xs + SH.L), qL = qx1 - qx0;
    const quay = new T3.Mesh(new T3.BoxGeometry(qL, 12, 40), new T3.MeshStandardMaterial({ color: P.sand, roughness: 0.9 })); quay.position.set((qx0 + qx1) / 2, 2, zq - 20); ctx.fxW.add(quay);
    /* 방현재와 계선주 */
    const fMat = new T3.MeshStandardMaterial({ color: '#2B2B2B', roughness: 0.8 }), bMat = new T3.MeshStandardMaterial({ color: '#3A4047', roughness: 0.6, metalness: 0.3 });
    for (let x = xs - SH.L * 0.6; x <= xs + SH.L * 0.6; x += 30) { const fd = new T3.Mesh(new T3.CylinderGeometry(FENDER / 2, FENDER / 2, 5, 12), fMat); fd.position.set(x, 3.5, zq + FENDER / 2); ctx.fxW.add(fd); }
    const lines = [ /* 이름, 배 쪽 x, 부두 쪽 x (배 무게중심 기준) */
      ['Head line', 0.47, 0.47 + 0.22], ['Fore breast line', 0.36, 0.36], ['Fore spring line', 0.22, 0.22 - 0.24],
      ['After spring line', -0.22, -0.22 + 0.24], ['After breast line', -0.36, -0.36], ['Stern line', -0.45, -0.45 - 0.22]];
    const yDeck = SH.D - SH.T + 1;
    this.moor = lines.map(([n, sx, qx], i) => {
      const a = V3(xs + sx * SH.L, yDeck, zEnd - hw(sx * SH.L, SH.D) + 0.5), b = V3(xs + qx * SH.L, 9, zq - 3), m = a.clone().lerp(b, 0.5); m.y -= 2;
      const bol = new T3.Mesh(new T3.CylinderGeometry(0.9, 1.1, 1.8, 12), bMat); bol.position.set(b.x, 8.9, b.z); ctx.fxW.add(bol);
      const l = Line([a, m, b], P.info, { top: true }); l.visible = false; ctx.fxW.add(l); return { n, l, i };
    });
    ctx.fxW.add(Line([V3(0, 1, zq), V3(0, 1, 120)], P.amber, { top: true }));
    ctx.label('<b style="color:var(--amber)">예정 정지점</b>', 'dim', o => o.set(0, 20, 130));
    const g = []; for (let i = 0; i < run.x.length; i += 5) g.push([run.x[i] - D, 0]); g.push([run.S - D, 0]); this.rib = Ribbon(g, 6, P.deck, 0.6, 0.85); ctx.fxW.add(this.rib);
    if (A < 0) { ctx.fxW.add(Line([V3(0, 2, 40), V3(-A, 2, 40)], P.bad, { top: true })); ctx.label(`<b style="color:var(--bad)">오버런 ${fmt(-A, 0)} m</b>`, 'dim', o => o.set(-A / 2, 24, 60)); }
    /* 예선 두 척(선수 쪽·선미 쪽 우현) */
    this.tugs = [ctx.tug, ctx.tug2].map((tg, k) => {
      tg.visible = true; const xa = k ? -TUG_X : TUG_X;
      const ar = Arrow(P.amber, 1.4, { top: true }); ctx.fxW.add(ar);
      const tow = Line([V3(), V3()], P.ink || '#222', { opacity: 0.9 }); tow.visible = false; ctx.fxW.add(tow);
      return { tg, xa, ar, tow, name: k ? '예선 2 (선미 쪽)' : '예선 1 (선수 쪽)' };
    });
    this.tugs.forEach(T => ctx.label(`<b>${T.name}</b>`, 'dim', o => o.set(T.tg.position.x, 18, T.tg.position.z)));
    this.landL = ctx.label('', 'dim', o => o.set(xs, 26, zq + 10));
    const lv = ASTERN[p.lv][0], zone = this.zoneOf(p.U, D), at = s => s / this.scale;
    this.steps = [
      { t: 0, h: `${fmt(D, 0)} m 앞에서 ${lv}`, p: `예정 정지점까지 ${fmt(D, 0)} m 남은 곳에서 ${fmt(p.U, 1)}노트로 ${lv}을 건다. 후진 추력이 다 걸리기까지 약 ${RAMP}초가 걸린다고 두었다. 우현 바깥에는 예선 두 척이 기다린다.` },
      { t: at(run.T * 0.5), h: '타력으로 나아간다', p: '배는 무거워 후진을 걸어도 한참 나아간다. 속력이 줄수록 물의 저항도 줄어 마지막에는 후진 추력만으로 멈춘다.' },
      { t: at(run.T), h: A < 0 ? `오버런: 정지점을 ${fmt(-A, 0)} m 지남` : `안전 여유 σ = ${fmt(sig, 2)}`, p: (A < 0 ? '예정 정지점을 지나쳤다. 부두 앞에서는 다른 배, 안벽과 부딪치거나 좌초할 수 있다. ' : `정지점 ${fmt(A, 0)} m 앞에서 멈췄다. `) + zone[1] },
      { t: at(this.t1), h: '예선이 와서 붙는다', p: `배가 멈추면 우현 선수 쪽과 선미 쪽(무게중심에서 앞뒤로 0.3L)에 예선 두 척이 와서 선체에 붙는다. 무게중심에서 같은 거리를 같은 힘으로 밀면 배는 돌지 않고 옆으로만 움직인다. 부두까지는 ${fmt(-zEnd, 0)} m.` },
      { t: at(this.t2), h: '예선이 밀어 옆으로', p: `예선이 한 척에 최대 약 ${fmt(Math.max(...side.f), 0)}톤(모델 값)으로 민다. 옆 방향은 물을 함께 밀어야 해서 배가 아주 무겁게 움직인다. 옆 속력은 0.25 m/s(약 0.5노트)를 넘기지 않는다.` },
      { t: at(this.t2 + side.tDec), h: '부두 가까이에서는 당겨서 줄인다', p: '안벽에 세게 닿지 않도록 예선이 줄을 잡고 반대쪽으로 당겨 옆 속력을 줄인다. 미는 것도 당기는 것도 할 수 있도록 예선은 처음부터 줄을 잡아 둔다(push-pull).' },
      { t: at(this.t3), h: `착안: ${fmt(VLAND * 100, 0)} cm/s로 닿는다`, p: '좌현이 방현재에 닿았다. 대형선은 착안 속력을 0.1 m/s 이하로 맞춘다. 예선은 배가 튕겨 나가지 않게 가볍게 밀어 붙여 둔다.' },
      { t: at(this.t3 + 30), h: '계선줄을 잡는다', p: '선수·선미에서 Head line, Breast line, Spring line, Stern line을 내어 부두 계선주에 건다. Spring line은 앞뒤로, Breast line은 옆으로 움직이는 것을 막는다. 줄을 다 잡으면 예선을 풀어 보낸다.' }
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
  /* 실제 시각 ts에서 옆 이동 상태 */
  sideAt(ts) {
    const s = this.side, k = ts - this.t2;
    if (k <= 0) return { z: 0, v: 0, f: 0, ph: ts < this.t1 ? 0 : 1 };
    if (k >= s.T) return { z: this.zEnd, v: 0, f: ts < this.t3 + 60 ? 6 : 0, ph: 3 };
    const i = Math.floor(k), w = k - i, j = Math.min(i + 1, s.y.length - 1);
    return { z: -(s.y[i] + (s.y[j] - s.y[i]) * w), v: s.v[i], f: s.f[i], ph: 2 };
  },
  apply(t) {
    const run = this.run, ts = t * this.scale, i = Math.min(run.x.length - 1, Math.round(ts)), ship = this.ctx.ship, lv = ASTERN[this.p.lv][1];
    const sd = this.sideAt(ts); this.sd = sd;
    ship.pose(run.x[i] - this.D, sd.z, 0); ship.prop.rotation.x += run.u[i] > 0 ? 0.05 * lv : 0; this.rib.setCount(i / 5); this.i = i; this.ts = ts;
    Object.assign(this.st, { u: run.u[i], v: sd.v, n: run.u[i] > 0 ? -60 * lv : 0 });
    /* 예선: 기다림 → 접근 → 밀기/당기기 → 붙여 두기 → 풀려 나감 */
    const come = sm((ts - this.t1) / T_COME);
    const pf = ts < this.t2 + this.side.tDec ? 0 : sd.ph === 2 ? Math.min(1, Math.max(0, (ts - this.t2 - this.side.tDec) / 25)) : 0;
    const leave = sm((ts - this.t3 - 60) / 35);
    for (const T of this.tugs) {
      const zHull = sd.z + hw(T.xa, SH.T), off = TUG_OFF + (TUG_PULL - TUG_OFF) * pf + 120 * leave;
      const z = come < 1 ? TUG_WAIT + (zHull + off - TUG_WAIT) * come : zHull + off;
      T.tg.position.set(this.xs + T.xa, 0, z); T.tg.rotation.set(0, Math.PI / 2, 0);
      const f = come >= 1 && leave < 1 ? sd.f : 0, push = f > 0;
      for (const pr of T.tg.userData.pods || []) pr.rotation.x += 0.02 + 0.06 * Math.min(1, Math.abs(f) / BP) * (push ? 1 : -1);
      const len = Math.abs(f) < 0.3 ? 0 : 10 + 40 * Math.min(1, Math.abs(f) / BP);
      T.ar.set(V3(this.xs + T.xa, 14, push ? zHull + 2 + len : zHull + 2), V3(0, 0, push ? -1 : 1), len);
      const showTow = pf > 0.05 && leave < 0.5;
      T.tow.visible = showTow; if (showTow) setLine(T.tow, [V3(this.xs + T.xa, 9, zHull + 0.5), V3(this.xs + T.xa, 4, z - 15)]);
    }
    /* 계선줄은 붙은 뒤 하나씩 */
    for (const m of this.moor) m.l.visible = ts >= this.t3 + 25 + m.i * 8;
    this.landL.set(sd.ph === 3 ? `<b>착안</b><i>${fmt(VLAND * 100, 0)} cm/s</i>` : sd.ph === 2 ? `<b>부두까지</b><i>${fmt(Math.max(0, sd.z - this.zEnd), 0)} m</i>` : '');
  },
  read() {
    const run = this.run, i = this.i, left = this.D - run.x[i], z = this.zoneOf(this.p.U, this.D), sd = this.sd || { z: 0, v: 0, f: 0, ph: 0 };
    const rows = [['경과 시간', realTime(this.ts)], ['속력', fmt(run.u[i] / KN, 1) + ' kn'], ['예정 정지점까지', left >= 0 ? fmt(left, 0) + ' m' : '지남 ' + fmt(-left, 0) + ' m', left < 0 ? 'bad' : ''], ['정지 거리', fmt(run.S, 0) + ' m'], ['안전 여유 σ = A/D', this.A < 0 ? '0 미만 (오버런)' : fmt(this.sig, 2), this.A < 0 ? 'bad' : this.sig < 0.3 ? 'warn' : 'ok'], ['속력 범위', z[0], z[0] === '적색' ? 'bad' : z[0] === '황색' ? 'warn' : 'ok']];
    rows.push(['부두까지 (옆)', sd.ph === 3 ? '착안 (방현재 ' + fmt(FENDER, 1) + ' m)' : fmt(Math.max(0, sd.z - this.zEnd), 0) + ' m', sd.ph === 3 ? 'ok' : '']);
    rows.push(['옆 속력', fmt(sd.v * 100, 0) + ' cm/s', sd.v > 0.15 ? 'warn' : '']);
    rows.push(['예선 한 척 힘', sd.ph === 2 ? (sd.f >= 0 ? '밀기 ' : '당기기 ') + fmt(Math.abs(sd.f), 0) + ' t (모델 값)' : sd.ph === 3 && this.ts < this.t3 + 60 ? '붙여 두기' : '—']);
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
