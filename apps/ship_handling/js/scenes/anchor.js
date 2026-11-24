/* 9-3 파주력과 주묘: 정상적인 묘박 중 선회(스윙)와 주묘를 위치 기록과 함께 비교 */
import { SH, DEG, smooth } from '../physics/ship.js';
import { catenary, holdingPower } from '../physics/anchor.js';
import { HAWSE, makeAnchor, COL } from '../engine/ship.js';
import { Arrow, Line, V3, setLine, arcPts } from '../engine/draw.js';
import { hullDeflect, boxSpawn } from '../engine/flow.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const WC = 0.25 * 0.87 * 9810, WA = 17000 * 9.81, WAIR = 0.25 * 1000 * 9.81, AF = 1900;
export default {
  id: 'anchor', dur: 36, flowVis: 4, life: 3, airTop: SH.D - SH.T + 16,
  controls: [
    { k: 'mode', label: '상황', type: 'seg', opts: [['swing', '정상 선회'], ['drag', '주묘']], val: 'drag' },
    { k: 'scope', label: '체인 길이', type: 'seg', opts: [[5, '수심×5'], [7, '×7'], [10, '×10']], val: 7 },
    { k: 'depth', label: '수심', type: 'range', min: 15, max: 40, step: 1, val: 25, fmt: v => v + ' m' }
  ],
  water: { alpha: 0.42, amp: 0.4 }, parts: ['anchor', 'radar'],
  legend: [['amber', '위치 기록(GPS 항적)'], ['ink', '선회권: 체인 + 선체 길이'], ['bad', '배를 미는 힘'], ['ok', '파주력']],
  chartTitle: '배를 미는 힘과 파주력 (시간)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, depth = p.depth, Lc = p.scope * depth, h = depth + (HAWSE.y - SH.T); this.depth = depth; this.Lc = Lc; this.h = h;
    const drag = p.mode === 'drag', W0 = drag ? 26 : 14;
    const dt = 0.5, dur = 720, n = Math.ceil(dur / dt) + 1; this.scale = dur / this.dur;
    const K = ['W', 'H', 'Hold', 'lay', 'xh', 'th', 'ax', 'az', 'lift', 'a', 'x0', 'dx', 'psi', 'gx', 'gz'], A = {}; for (const k of K) A[k] = new Float32Array(n);
    let ax = 0, az = 0, xhS = null, amp = 1;
    for (let i = 0; i < n; i++) {
      const t = i * dt, W = drag ? 12 + (W0 - 12) * smooth((t - 60) / 180) : W0;
      const dragging = i > 0 && A.H[i - 1] > A.Hold[i - 1];
      if (drag) amp = Math.max(0.15, amp - (dragging ? dt / 400 : 0));
      const sw = 35 * DEG * amp * Math.sin(2 * Math.PI * t / 110);          // 바람·선체가 만드는 스윙
      const offs = drag ? 70 * DEG * smooth((t - 360) / 200) * (1 - amp) : 0; // 주묘가 이어지면 바람에 옆으로 눕는다
      const th = sw, psi = th + offs;
      const slack = 0.55 + 0.45 * Math.cos(2 * Math.PI * t / 55) ** 2;         // 스윙 양 끝에서 장력이 풀림(정상)
      const Hraw = 0.5 * 1.225 * 0.8 * AF * W * W * (1 + 1.2 * Math.sin(psi) ** 2) + 30000;
      const H = drag && dragging ? Hraw : Hraw * slack;
      const g = catenary(H, WC, h, Lc), Hold = holdingPower(g.lay, WA, WAIR);
      if (H > Hold || g.lift > 0.02) { const v = 0.15 + 0.5 * Math.min(2, H / Hold - 1); ax -= v * dt; }
      xhS = xhS == null ? g.xh : xhS + (g.xh - xhS) * Math.min(1, dt / 12);
      const hx = ax - xhS * Math.cos(th), hz = az - xhS * Math.sin(th);
      A.W[i] = W; A.H[i] = H; A.Hold[i] = Hold; A.lay[i] = g.lay; A.xh[i] = xhS; A.th[i] = th; A.ax[i] = ax; A.az[i] = az; A.lift[i] = g.lift; A.a[i] = g.a; A.x0[i] = g.x0; A.dx[i] = g.dx; A.psi[i] = psi;
      A.gx[i] = hx - HAWSE.x * Math.cos(psi); A.gz[i] = hz - HAWSE.x * Math.sin(psi);
    }
    A.dt = dt; A.n = n; this.A = A;
    const R = catenary(0.5 * 1.225 * 0.8 * AF * 14 * 14 + 30000, WC, h, Lc).xh + SH.L; this.R = Lc + SH.L;
    let tOut = null; for (let i = 0; i < n; i++) { const d = Math.hypot(A.gx[i] + SH.L / 2 * Math.cos(A.psi[i]), A.gz[i] + SH.L / 2 * Math.sin(A.psi[i])); if (d > this.R && tOut == null) tOut = i * dt; } this.tOut = tOut; void R;
    const S = s => s / this.scale;
    this.steps = drag ? [
      { t: 0, h: '묘박 중, 바람 12 m/s', p: '앵커와 해저에 누운 체인이 배를 붙잡는다. 배는 바람 방향이 흔들리는 대로 앵커를 중심으로 좌우로 돈다(스윙). 여기까지는 정상이다.' },
      { t: S(120), h: '바람이 세진다', p: '풍속이 26 m/s까지 오른다. 배를 미는 힘이 커져 체인이 펴지고 해저에 누운 부분이 짧아진다. 파주력도 함께 줄어든다.' },
      { t: S(Math.max(150, (A.H.findIndex((v, i) => v > A.Hold[i]) || 300) * dt)), h: '파주력을 넘는다: 주묘 시작', p: '배를 미는 힘이 앵커와 체인의 파주력을 넘으면 앵커가 해저에서 끌리기 시작한다. 처음에는 일그러진 스윙을 하며 바람 아래로 밀린다. 주황 선(위치 기록)이 지그재그로 바람 아래로 이어진다.' },
      { t: S(420), h: '징후: 스윙이 사라지고 옆으로 눕는다', p: '더 밀리면 스윙 없이 일정한 속력으로 표류한다. 선수가 바람을 향하지 않고 바람에 옆으로 누우며, 바람을 받는 현이 바뀌지 않는다. 스윙 끝에서도 체인이 느슨해지지 않고 이상한 진동이 느껴진다.' },
      { t: tOut ? S(tOut) : S(560), h: '확인: 선회권 밖으로', p: `투묘 위치를 중심으로 반지름 '내준 체인 길이 + 선체 길이'(약 ${fmt(this.R, 0)} m)의 원을 그려 두면, 위치가 이 원 밖으로 나가는 것으로 주묘를 확인할 수 있다. 레이더로 두 물표까지 거리 변화를 재는 방법도 쓴다.` },
      { t: S(640), h: '대응', p: '끌리기 시작한 초기라면 체인을 더 내거나 반대쪽 앵커를 투하한다. 일정한 속력으로 표류하기 시작하면 이 방법은 효과가 적다. 주기관과 타, 선수 쓰러스터로 선수를 바람 쪽으로 유지하고, 필요하면 양묘해 다시 투묘한다.' }
    ] : [
      { t: 0, h: '정상적인 묘박 중 선회', p: '풍속 14 m/s. 바람 방향이 흔들리면 배는 앵커를 중심으로 좌우로 돈다(스윙). 이것은 정상이다.' },
      { t: S(60), h: '스윙 양 끝에서 체인이 느슨해진다', p: '배가 한쪽 끝에 이르러 방향을 바꿀 때 잠깐 체인이 느슨해졌다가 다시 팽팽해진다. 장력 그래프가 오르내린다.' },
      { t: S(200), h: '위치 기록이 원 안에서 호를 그린다', p: '주황 선은 같은 호 위를 오간다. 배를 미는 힘은 파주력보다 작고 앵커는 제자리에 있다. 선수는 늘 바람 쪽(풍상측)을 향한다.' },
      { t: S(420), h: '주묘와 구별하는 법', p: '정상 선회는 위치가 선회권 안의 같은 호를 오가고, 선수가 바람을 향하며, 바람을 받는 현이 번갈아 바뀌고, 스윙 끝에서 체인이 느슨해진다. 이 중 하나라도 어긋나면 주묘를 의심한다. 위 \'상황\'에서 주묘를 골라 비교해 보자.' }
    ];
    ctx.stage.setSeabed(depth); ctx.ship.anchors[0].visible = false;
    const am = new ctx.THREE.MeshStandardMaterial({ color: COL.steel, metalness: 0.3, roughness: 0.7, flatShading: true });
    this.anc = makeAnchor(ctx.THREE, am); this.anc.rotation.z = Math.PI / 2 + 0.25; this.anc.scale.setScalar(1.6); ctx.fxW.add(this.anc); ctx.stage.registerPart(this.anc, 'anchor');
    this.chain = new ctx.THREE.Mesh(new ctx.THREE.BufferGeometry(), new ctx.THREE.MeshStandardMaterial({ color: COL.chain, roughness: 0.5, metalness: 0.4 })); ctx.fxW.add(this.chain);
    this.furrow = Line([V3(0, -depth + 0.4, 0), V3(0, -depth + 0.4, 0)], P.amber, {}); ctx.fxW.add(this.furrow);
    const circ = Line(arcPts(0, 0, this.R, 0, Math.PI * 2, 0.8, 120), P.ink, { dash: 18, opacity: 0.7 }); ctx.fxW.add(circ);
    ctx.label('선회권 (체인 + 선체 길이)', 'dim', o => o.set(0, 8, -this.R - 20));
    ctx.label('투묘 위치', 'dim', o => o.set(0, 6, 0));
    this.trail = Line([V3(), V3(1, 0, 0)], P.amber, { top: true }); ctx.fxW.add(this.trail);
    this.wa = []; for (let k = 0; k < 4; k++) { const a = Arrow(P.info, 2.2, { opacity: 0.85 }); ctx.fxW.add(a); this.wa.push(a); }
    this.lW = ctx.label('', 'dim', o => o.copy(this.pW || V3()));
    this.cam = { r: 1500 + Lc, th: 2.2, ph: 0.55, target: () => V3(-this.R * 0.55, 0, 0) };
    this.st = { u: 0.6, v: 0, r: 0, cref: 1.2, W: W0, air: true, aref: 25, sp: -1, cp: 0 };
  },
  anchorObj() { return this.anc; },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))), depth = this.depth, ship = this.ctx.ship;
    const th = A.th[i], psi = A.psi[i], ax = A.ax[i], az = A.az[i], xh = A.xh[i], a = A.a[i];
    ship.pose(A.gx[i], A.gz[i], psi); this.anc.position.set(ax, -depth + 0.9, az);
    const hx = ax - xh * Math.cos(th), hz = az - xh * Math.sin(th);
    const pts = [], dir = V3(-Math.cos(th), 0, -Math.sin(th)), lay = A.lay[i], dx = A.dx[i], x0 = A.x0[i];
    const Pp = (d, y) => V3(ax + dir.x * d, y, az + dir.z * d);
    if (lay > 0) { pts.push(Pp(0, -depth + 0.5)); pts.push(Pp(lay * 0.5, -depth + 0.5)); for (let k = 0; k <= 40; k++) { const x = dx * k / 40; pts.push(Pp(lay + x, -depth + 0.5 + a * (Math.cosh(x / a) - 1))); } }
    else for (let k = 0; k <= 44; k++) { const x = x0 + dx * k / 44; pts.push(Pp(x - x0, -depth + 0.5 + a * (Math.cosh(x / a) - Math.cosh(x0 / a)))); }
    const last = pts[pts.length - 1], top = HAWSE.y - SH.T, sc = (top + depth - 0.5) / Math.max(1, last.y + depth - 0.5);
    for (const q of pts) q.y = -depth + 0.5 + (q.y + depth - 0.5) * sc; pts[pts.length - 1].set(hx, top, hz);
    this.chain.geometry.dispose(); this.chain.geometry = new this.ctx.THREE.TubeGeometry(new this.ctx.THREE.CatmullRomCurve3(pts), 90, 0.75, 6, false);
    setLine(this.furrow, [V3(0, -depth + 0.4, 0), V3(ax, -depth + 0.4, az)]); this.furrow.visible = ax < -1;
    const tp = []; for (let k = 0; k <= i; k += 4) tp.push(V3(A.gx[k] + (SH.L / 2) * Math.cos(A.psi[k]), 1.2, A.gz[k] + (SH.L / 2) * Math.sin(A.psi[k]))); if (tp.length > 1) setLine(this.trail, tp);
    const W = A.W[i]; this.wa.forEach((w, k) => w.set(V3(A.gx[i] + 300 + k * 30, 35 + k * 6, -90 + k * 60), V3(-1, 0, 0), 15 + W * 2.4));
    this.pW = V3(A.gx[i] + 320, 70, 40); this.lW.set(`<b style="color:var(--info)">바람 ${fmt(W, 0)} m/s</b>`);
    const out = Math.hypot(A.gx[i] + SH.L / 2 * Math.cos(psi), A.gz[i] + SH.L / 2 * Math.sin(psi)) > this.R;
    this.cur = { i, ts, out, dragging: A.H[i] > A.Hold[i] || A.lift[i] > 0.02, moved: Math.hypot(ax, az) };
    Object.assign(this.st, { W, psi });
  },
  read() {
    const A = this.A, c = this.cur, i = c.i, rel = Math.abs((A.psi[i] - 0) / DEG);
    const st = c.dragging ? ['주묘 중', 'bad'] : A.H[i] > A.Hold[i] * 0.75 ? ['주의, 여유 적음', 'warn'] : ['파주 유지', 'ok'];
    return [['경과 시간', realTime(c.ts)], ['풍속', fmt(A.W[i], 0) + ' m/s'], ['체인', '수심 ' + this.depth + ' m × ' + this.p.scope + ' = ' + fmt(this.Lc, 0) + ' m'], ['배를 미는 힘 / 파주력', fmt(A.H[i] / 9810, 0) + ' / ' + fmt(A.Hold[i] / 9810, 0) + ' tf'], ['해저에 누운 체인', fmt(A.lay[i], 0) + ' m'],
      ['선수와 바람 사이 각', fmt(rel, 0) + '°' + (rel > 45 ? ' (옆으로 누움)' : '')], ['선회권 안', c.out ? '아님, 밖으로 벗어남' : '안', c.out ? 'bad' : ''], ['앵커가 끌린 거리', fmt(c.moved, 0) + ' m'], ['판정', st[0], st[1]]];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, h = [], g = []; for (let i = 0; i < A.n; i += 4) { h.push([i * A.dt, A.H[i] / 9810]); g.push([i * A.dt, A.Hold[i] / 9810]); }
    const m = Math.max(...h.map(x => x[1]), ...g.map(x => x[1])) * 1.12;
    lineChart(cv, P, { x0: 0, x1: A.n * A.dt, upto: this.cur.ts, cursor: this.cur.ts, xt: [[0, '0'], [180, '3분'], [360, '6분'], [540, '9분'], [720, '12분']], series: [{ data: h, color: P.bad, min: 0, max: m, yt: [0, Math.round(m / 2), Math.round(m / 1.12)], label: '미는 힘 (tf)' }, { data: g, color: P.ok, min: 0, max: m, label: '파주력 (tf)' }] });
  },
  field(x, y, z, o, st) {
    if (o.k === 2 || y > 0.8) { o.k = 2; const W = st.W || 0, ps = st.psi || 0; o.x = -W * Math.cos(ps); o.y = 0; o.z = W * Math.sin(ps); hullDeflect(x, y, z, o, SH.D - SH.T + 17); return; }
    { const ps = st.psi || 0; o.x = -0.6 * Math.cos(ps); o.y = 0; o.z = 0.6 * Math.sin(ps); } hullDeflect(x, y, z, o);
  },
  spawn(p) { if (Math.random() < 0.5) { boxSpawn([-300, 420, 2, 45, -150, 150], p, 2); return; } boxSpawn([-260, 320, -16, -0.6, -110, 110], p); },
  box: [-340, 460, -20, 50, -170, 170]
};
