/* 7-3 천수 효과: (A) 선저 흐름과 침하·트림, (B) 깊은 물과 얕은 물의 선회권 비교 */
import { SH, DEG, KN, XA, XF, smooth } from '../physics/ship.js';
const EX = 5; /* 침하를 눈에 보이게 키워 그리는 배율 */
import { maneuver, firstIdx } from '../physics/maneuver.js';
import { shallowFactors, squatBarrass } from '../physics/shallow.js';
import { Ribbon, Line, V3, Arrow } from '../engine/draw.js';
import { hullDeflect, propJet, boxSpawn } from '../engine/flow.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
export default {
  id: 'shallow', flowVis: 4, life: 2.6,
  controls: [
    { k: 'mode', label: '장면', type: 'seg', opts: [['A', '선저 흐름과 침하'], ['B', '선회권 비교']], val: 'A', restart: true },
    { k: 'hd', label: '수심/흘수 h/d', type: 'range', min: 1.1, max: 4, step: 0.1, val: 1.3, fmt: v => fmt(v, 1) + ' (수심 ' + fmt(v * SH.T, 1) + ' m)' },
    { k: 'U', label: '선속', type: 'range', min: 4, max: 16, step: 1, val: 10, fmt: v => v + ' kn' }
  ],
  water: { alpha: 0.32, amp: 0.15 }, parts: ['rudder', 'propeller'],
  get dur() { return this.mode === 'A' ? 24 : 36; },
  get scale() { return this.mode === 'A' ? 1 : this.sc; },
  get cam() { return this.mode === 'A' ? { r: 290, th: 1.66, ph: 1.5, target: () => V3(10, -4, 0) } : { r: this.camR || 2600, th: 2.2, ph: 0.45, target: () => this.center.clone() }; },
  get legend() { return this.mode === 'A' ? [['cool0', '선저를 빠르게 지나는 물(저압)'], ['jet0', '선수·선미 부근(고압)'], ['sand', '해저']] : [['deck', '얕은 물 선회권'], ['info', '깊은 물 선회권']]; },
  get chartTitle() { return this.mode === 'A' ? '수심/흘수에 따른 선회성·추종성 계수' : '선회 중 선수방위 변화'; },
  build(ctx, p) {
    this.ctx = ctx; this.p = p; this.mode = p.mode; const P = ctx.P, U = p.U * KN, f = shallowFactors(p.hd); this.f = f;
    this.depth = p.hd * SH.T; ctx.stage.setSeabed(this.depth); this.sq = squatBarrass(SH.Cb, p.U * (1 - f.speedLoss));
    this.st = { u: U * (1 - f.speedLoss), v: 0, r: 0, n: 60, cref: U, depth: this.depth, hd: p.hd };
    if (p.mode === 'A') {
      this.steps = [
        { t: 0, h: '깊은 물에서처럼', p: '배가 나아가면 배수량만큼의 물이 선체를 따라 뒤로 흘러 비켜난다. 깊은 물에서는 이 물이 선저 아래로도 넉넉히 빠져나간다.' },
        { t: 4, h: '선저 아래가 좁아진다', p: `지금 수심은 흘수의 ${fmt(p.hd, 1)}배, 선저와 해저 사이 여유는 ${fmt(this.depth - SH.T, 1)} m다. 선저 아래로 빠지던 물이 막혀 옆으로 밀려나고, 남은 물은 좁은 틈을 빨리 지나간다. 흐름이 세 면(양현과 선저)에서 두 면(양현) 위주로 바뀐다.` },
        { t: 9, h: '압력이 떨어져 선체가 가라앉는다', p: '빨라진 흐름 때문에 선체 중앙부 압력이 낮아지고(선수·선미는 높다) 배 전체가 내려앉는다(선체 침하, squat). 상선의 속력 범위에서는 주로 선수 트림으로 바뀐다. 장면에서는 보이도록 침하량을 5배로 키워 그렸다. 점선은 가라앉기 전 선저 위치, 빨간 화살표는 선수와 선미가 가라앉은 양이다.' },
        { t: 15, h: '저항이 늘고 속력이 준다', p: '부가 질량과 선체 저항이 커지고 선수·선미에서 일어나는 파도도 커져 속력이 줄어든다. 침하로 선저 여유(UKC)가 더 작아지므로 수심이 얕은 곳에서는 속력을 낮춘다.' },
        { t: 20, h: '조종성은 어떻게 변하나', p: '부가 관성과 선회 저항 모멘트가 커져 T와 K가 모두 작아진다. 조타에 대한 반응(추종성)은 좋아지지만 선회권이 커진다(선회성 저하). 오른쪽 위 \'장면\'에서 선회권 비교를 골라 보자.' }
      ];
      this.ctx.ship.setOpacity(0.55);
      this.aL = Arrow(P.bad, 0.9, { top: true }); ctx.fxY.add(this.aL); this.lS = ctx.label('', 'dim', o => o.copy(this.pS || V3()));
      const T3 = ctx.THREE, d = this.depth, hb = SH.B / 2 + 0.6, W0 = o => { ctx.ship.yaw.updateMatrixWorld(); return o.applyMatrix4(ctx.ship.yaw.matrixWorld); };
      /* 해저: 두꺼운 모래 층과 윗면 선, 바닥 무늬 */
      const sand = new T3.Mesh(new T3.BoxGeometry(520, 60, 150), new T3.MeshBasicMaterial({ color: new T3.Color(P.sand).lerp(new T3.Color('#C9A96E'), 0.55) })); sand.position.set(0, -d - 30, 0); ctx.fxY.add(sand);
      ctx.fxY.add(Line([V3(-260, -d + 0.15, 75.2), V3(260, -d + 0.15, 75.2)], P.ink, { opacity: 0.7 }));
      for (let x = -240; x <= 240; x += 30) ctx.fxY.add(Line([V3(x, -d - 1, 75.3), V3(x + 14, -d - 5, 75.3)], P.ink, { opacity: 0.25 }));
      ctx.label('<b>해저</b>', 'dim', o => W0(o.set(215, -d - 5, 76)));
      /* 선저 여유 구간: 선저와 해저 사이의 좁은 물 층 */
      this.gapBox = new T3.Mesh(new T3.BoxGeometry(SH.L, 1, SH.B), new T3.MeshBasicMaterial({ color: P.cool0, transparent: true, opacity: 0.28, depthWrite: false })); ctx.fxY.add(this.gapBox);
      /* 가라앉기 전 선저 위치(점선)와 수심·흘수 눈금 */
      for (const z of [hb, -hb]) ctx.fxY.add(Line([V3(XA - 8, -SH.T, z), V3(XF + 8, -SH.T, z)], P.ink, { dash: 3, top: true, opacity: 0.9 }));
      ctx.label('원래 선저', 'dim', o => W0(o.set(XF + 14, -SH.T + 1, hb)));
      const sx = 172, tick = (y, c) => ctx.fxY.add(Line([V3(sx - 5, y, hb), V3(sx + 5, y, hb)], c, { top: true }));
      ctx.fxY.add(Line([V3(sx, 0, hb), V3(sx, -d, hb)], P.info, { top: true })); tick(0, P.info); tick(-d, P.info);
      ctx.fxY.add(Line([V3(sx - 14, 0, hb), V3(sx - 14, -SH.T, hb)], P.amber, { top: true })); ctx.fxY.add(Line([V3(sx - 19, -SH.T, hb), V3(sx - 9, -SH.T, hb)], P.amber, { top: true }));
      ctx.label(`<b style="color:var(--info)">수심 h ${fmt(d, 1)} m</b>`, 'dim', o => W0(o.set(sx - 6, -d - 6, hb)));
      ctx.label(`<b style="color:var(--amber)">흘수 d ${fmt(SH.T, 1)} m</b>`, 'dim', o => W0(o.set(sx - 6, 7, hb)));
      /* 선수·선미가 가라앉은 양 */
      this.aBow = Arrow(P.bad, 0.9, { top: true }); this.aStern = Arrow(P.bad, 0.9, { top: true }); ctx.fxY.add(this.aBow, this.aStern);
      this.lBow = ctx.label('', 'dim', o => o.copy(this.pBow || V3())); this.lStern = ctx.label('', 'dim', o => o.copy(this.pStern || V3()));
      ctx.label('<b>UKC</b>', 'dim', o => o.copy(this.pU || V3()));
      return;
    }
    const run = sh => maneuver({ U0: U, dur: 2000, K0: 2.0, Tp: 1.6, nonlin: true, shallow: sh, cmd: st => st.t < 3 ? 0 : 35, stop: st => st.psi > 370 * DEG });
    this.deep = run(null); this.shal = run(f); this.sc = this.shal.dur / 36;
    const fd = A => { const e = A.n - 1; return 2 * A.u[e] / Math.max(1e-4, A.r[e]); };
    this.fdD = fd(this.deep); this.fdS = fd(this.shal);
    const i180 = A => firstIdx(A.psi, v => v >= 180 * DEG); this.tdD = this.deep.Z[i180(this.deep)]; this.tdS = this.shal.Z[i180(this.shal)];
    this.steps = [
      { t: 0, h: `${p.U}노트에서 우현 35°`, p: `같은 배, 같은 속력, 같은 타각으로 깊은 물(파랑)과 수심이 흘수의 ${fmt(p.hd, 1)}배인 얕은 물(초록)에서 한 바퀴 돈다.` },
      { t: 6, h: '처음 반응은 비슷하다', p: '얕은 물에서는 T가 작아져 조타에 대한 반응은 오히려 빠르다. Reach는 두 경우 차이가 크지 않다.' },
      { t: 16, h: '선회권이 커진다', p: `K가 작아져 같은 타각에서 선회율이 작다. 얕은 물의 선회경은 약 ${fmt(this.tdS / SH.L, 1)}L로 깊은 물(약 ${fmt(this.tdD / SH.L, 1)}L)보다 크다. 종거보다 선회경이 더 많이 늘어나 선회권이 옆으로 볼록해진다.` },
      { t: 28, h: '정상 선회경 비교', p: `정상 선회경은 깊은 물 약 ${fmt(this.fdD, 0)} m, 얕은 물 약 ${fmt(this.fdS, 0)} m(모델 값). LNG선 시험에서도 h/d = 1.3일 때 정상 선회경이 깊은 물의 거의 2배였다.` }
    ];
    const pts = A => { const g = []; for (let i = 0; i < A.n; i += 4) g.push([A.X[i], A.Z[i]]); return g; };
    this.ribD = Ribbon(pts(this.deep), 7, P.info, 0.6, 0.85); this.ribS = Ribbon(pts(this.shal), 9, P.deck, 0.8); ctx.fxW.add(this.ribD, this.ribS);
    ctx.fxW.add(Line([V3(-300, 0.6, 0), V3(2400, 0.6, 0)], P.muted, { dash: 30 }));
    const lab = (A, txt) => { let im = 0; for (let i = 0; i < A.n; i++) if (A.Z[i] > A.Z[im]) im = i; ctx.label(txt, 'dim', o => o.set(A.X[im], 30, A.Z[im] + 40)); };
    lab(this.deep, '<b style="color:var(--info)">깊은 물</b>'); lab(this.shal, '<b style="color:var(--deck)">얕은 물</b>');
    let mx = 0, Mx = 0, mz = 0, Mz = 0; for (const A of [this.deep, this.shal]) for (let i = 0; i < A.n; i++) { mx = Math.min(mx, A.X[i]); Mx = Math.max(Mx, A.X[i]); mz = Math.min(mz, A.Z[i]); Mz = Math.max(Mz, A.Z[i]); }
    this.center = V3((mx + Mx) / 2, 0, (mz + Mz) / 2); this.camR = Math.max(Mx - mx, Mz - mz) * 1.7 + 400;
    ctx.stage.setSeabed(null);
  },
  apply(t) {
    const ship = this.ctx.ship;
    if (this.mode === 'A') {
      const k = smooth((t - 4) / 8), sink = this.sq * EX * k, trim = -0.35 * DEG * k * Math.min(1, this.sq / 0.6);
      ship.pose(0, 0, 0, 0, trim, -sink); this.sink = sink / EX; this.k = k;
      const ukc = this.depth - SH.T - this.sink;
      this.aL.set(V3(0, -this.depth + 0.6, 34), V3(0, 1, 0), Math.max(0.1, this.depth - SH.T - sink - 0.6));
      const W = v => { ship.yaw.updateMatrixWorld(); return v.applyMatrix4(ship.yaw.matrixWorld); };
      this.pU = W(V3(0, -this.depth + 2, 42)); this.pS = W(V3(-60, 6, 30)); this.lS.set(k > 0.05 ? `<b style="color:var(--bad)">침하 ${fmt(this.sink, 2)} m</b><i>선수 트림</i>` : '');
      /* 선저 여유 층: 원래 선저에서 해저까지, 가라앉은 만큼 얇아진다 */
      const gapTop = -SH.T - sink, gH = Math.max(0.2, gapTop + this.depth); this.gapBox.scale.y = gH; this.gapBox.position.y = -this.depth + gH / 2;
      const xb = SH.L / 2 - 22, dB = sink - Math.sin(trim) * xb, dS = sink + Math.sin(trim) * xb, top = SH.D - SH.T + 26;
      this.aBow.set(V3(xb, top + 6, 0), V3(0, -1, 0), Math.max(0.1, 6 + dB)); this.aStern.set(V3(-xb, top + 6, 0), V3(0, -1, 0), Math.max(0.1, 6 + dS));
      this.pBow = W(V3(xb, top + 14, 0)); this.pStern = W(V3(-xb, top + 14, 0));
      this.lBow.set(k > 0.05 ? `<b style="color:var(--bad)">선수 ${fmt(dB / EX, 2)} m</b>` : ''); this.lStern.set(k > 0.05 ? `<b style="color:var(--bad)">선미 ${fmt(dS / EX, 2)} m</b>` : '');
      this.ukc = ukc; this.st.k = k;
      return;
    }
    const A = this.shal, ts = t * this.sc, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))), j = Math.min(this.deep.n - 1, Math.round(ts / this.deep.dt));
    ship.pose(A.X[i], A.Z[i], A.psi[i], A.phi[i] * 2); ship.rudder.rotation.y = A.del[i];
    this.ribS.setCount(i / 4); this.ribD.setCount(j / 4); this.cur = { i, j, ts };
    Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i] });
  },
  read() {
    const f = this.f;
    if (this.mode === 'A') return [['수심 / 흘수', fmt(this.depth, 1) + ' m / ' + fmt(SH.T, 1) + ' m (h/d ' + fmt(this.p.hd, 1) + ')'], ['선체 침하 (Barrass 근사)', fmt(this.sink, 2) + ' m'], ['선저 여유 UKC', fmt(this.ukc, 2) + ' m', this.ukc < 1.5 ? 'bad' : this.ukc < 3 ? 'warn' : ''], ['속력 감소', fmt(f.speedLoss * 100, 0) + '%'], ['추종성 T', '깊은 물의 ' + fmt(f.T * 100, 0) + '% (좋아짐)'], ['선회성 K', '깊은 물의 ' + fmt(f.K * 100, 0) + '% (나빠짐)']];
    const { i, j, ts } = this.cur, A = this.shal, B = this.deep;
    return [['경과 시간', realTime(ts)], ['얕은 물 회두', fmt(A.psi[i] / DEG, 0) + '°'], ['깊은 물 회두', fmt(B.psi[j] / DEG, 0) + '°'], ['선회경 (얕음 / 깊음)', fmt(this.tdS / SH.L, 1) + 'L / ' + fmt(this.tdD / SH.L, 1) + 'L'], ['정상 선회경 (얕음 / 깊음)', fmt(this.fdS, 0) + ' m / ' + fmt(this.fdD, 0) + ' m']];
  },
  chart(cv, P, { lineChart }) {
    if (this.mode === 'A') {
      const k = [], tt = []; for (let h = 1.1; h <= 4.01; h += 0.05) { const f = shallowFactors(h); k.push([h, f.K]); tt.push([h, f.T]); }
      const f = shallowFactors(this.p.hd);
      lineChart(cv, P, { x0: 1.1, x1: 4, xt: [[1.1, '1.1'], [1.3, '1.3'], [2, '2'], [3, '3'], [4, '4 (h/d)']], series: [{ data: k, color: P.deck, min: 0.3, max: 1.05, yt: [0.5, 1], label: 'K 비율', mark: [this.p.hd, f.K] }, { data: tt, color: P.info, min: 0.3, max: 1.05, label: 'T 비율', mark: [this.p.hd, f.T] }] });
      return;
    }
    const a = [], b = []; for (let i = 0; i < this.shal.n; i += 8) a.push([i * this.shal.dt, this.shal.psi[i] / DEG]); for (let i = 0; i < this.deep.n; i += 8) b.push([i * this.deep.dt, this.deep.psi[i] / DEG]);
    lineChart(cv, P, { x0: 0, x1: this.shal.dur, upto: this.cur.ts, cursor: this.cur.ts, xt: [[0, '0'], [300, '5분'], [600, '10분'], [900, '15분']].filter(x => x[0] <= this.shal.dur), series: [{ data: a, color: P.deck, min: 0, max: 380, yt: [0, 180, 360], label: '얕은 물' }, { data: b, color: P.info, min: 0, max: 380, label: '깊은 물', full: true }] });
  },
  field(x, y, z, o, st) {
    o.x = -st.u + st.r * z; o.y = 0; o.z = -st.v - st.r * x; o.k = 0;
    if (this.mode === 'A' && st.depth) {
      const gap = st.depth - SH.T, k = st.k || 0;
      if (y < -SH.T && Math.abs(x) < SH.L / 2 + 10 && Math.abs(z) < SH.B / 2 + 4) { const sp = 1 + k * 2.2 * SH.T / (gap + 3); o.x *= sp; o.k = 3; }
      else if (Math.abs(z) < SH.B / 2 + 25 && Math.abs(x) < SH.L / 2 && y > -SH.T) { o.x *= 1 + 0.35 * k; o.z += Math.sign(z) * 0.6 * k * Math.cos(x / SH.L * Math.PI); }
      if (Math.abs(x) > SH.L / 2 - 25 && Math.abs(x) < SH.L / 2 + 25 && Math.abs(z) < SH.B / 2 + 10 && k > 0.2) o.k = 1;
    }
    hullDeflect(x, y, z, o); propJet(x, y, z, o, st);
  },
  kill(x, y, z) { const b = this.mode === 'A' ? [-260, 260, -(this.depth || 30) + 0.3, 1, -70, 70] : [-360, 360, -18, 1, -160, 160]; return x < b[0] || x > b[1] || y < b[2] || y > b[3] || z < b[4] || z > b[5]; },
  get spawn() { return this.mode === 'A' ? p => { boxSpawn([-240, 240, -(this.depth || 30) + 0.5, -0.6, -45, 45], p); } : p => boxSpawn([-330, 330, -16, -0.6, -130, 130], p); }
};
