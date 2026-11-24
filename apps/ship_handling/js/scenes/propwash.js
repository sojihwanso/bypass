/* 5-4 배출류와 횡압력: (A) 정지→미속 전진→정지→반속 후진, (B) 저속 전진에서 좌우 같은 타각의 초기 회두 비교 */
import { SH, DEG, KN, XF, smooth } from '../physics/ship.js';
import { maneuver } from '../physics/maneuver.js';
import { apparentSlip, PROP } from '../physics/propeller.js';
import { RUD } from '../engine/ship.js';
import { hullHalfWidth as hw } from '../physics/ship.js';
import { Arrow, Ribbon, Line, Ghost, V3, setLine } from '../engine/draw.js';
import { baseWater, hullDeflect, propJet, boxSpawn } from '../engine/flow.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
/* 배출류를 한눈에: 경로를 따라 흘러가는 작은 화살촉 줄과, 흐름이 부딪히는 자리를 표시하는 판 */
function pathPts(fn, n = 60) { const a = []; for (let i = 0; i <= n; i++) a.push(fn(i / n)); return a; }
function samplePath(pts, f) { const k = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1))), u = f * (pts.length - 1) - k; return [pts[k].clone().lerp(pts[k + 1], u), pts[k + 1].clone().sub(pts[k])]; }
function makeStreams(ctx, P) {
  const T = ctx.THREE, g = new T.Group(), py = PROP.y - SH.T, R = PROP.R;
  const cone = new T.ConeGeometry(0.42, 1.5, 10); cone.rotateX(Math.PI / 2);
  const mk = (color, n) => { const m = new T.MeshBasicMaterial({ color, transparent: true, depthTest: false }); const arr = []; for (let i = 0; i < n; i++) { const c = new T.Mesh(cone, m); c.renderOrder = 6; g.add(c); arr.push(c); } return { m, arr }; };
  /* 전진: 선미에서 보아 시계 방향 나선이 뒤(−x)로 흘러 타를 때린다. +z가 우현, θ=0은 위쪽 */
  const helix = k => pathPts(f => { const th = k * 2 * Math.PI / 3 + f * 2.2 * 2 * Math.PI, r = R * (0.95 - 0.2 * f); return V3(PROP.x - 0.5 - f * 26, py + r * Math.cos(th), r * Math.sin(th)); });
  /* 후진: 반시계 방향. 우현 쪽은 올라가며 선미 우현 선체를 거의 직각으로 때리고, 좌현 쪽은 내려가 선저 아래로 빠진다 */
  const yk = PROP.y + 2.5, hx = -128, hitZ = hw(hx, yk);
  const stbdP = pathPts(f => { const a = V3(PROP.x + 0.6, py - R * 0.8, R * 0.5), b = V3(-133.5, py - 2.5, hitZ + 5.5), c = V3(hx, yk - SH.T, hitZ + 0.4); const u = 1 - f; return a.clone().multiplyScalar(u * u).add(b.clone().multiplyScalar(2 * u * f)).add(c.clone().multiplyScalar(f * f)); });
  const portP = pathPts(f => { const a = V3(PROP.x + 0.6, py + R * 0.8, -R * 0.5), b = V3(-131, py - 1, -hw(-131, PROP.y) - 4), c = V3(-118, -SH.T - 3.5, -2); const u = 1 - f; return a.clone().multiplyScalar(u * u).add(b.clone().multiplyScalar(2 * u * f)).add(c.clone().multiplyScalar(f * f)); });
  const S = { g, fwd: [0, 1, 2].map(k => ({ pts: helix(k), ...mk(P.jet0, 16) })), ast: [{ pts: stbdP, ...mk(P.bad, 12) }, { pts: stbdP.map(v => v.clone().add(V3(0, 1.6, -0.6))), ...mk(P.bad, 12) }, { pts: portP, ...mk(P.info, 12) }] };
  /* 부딪히는 자리 */
  const patch = (color, w, h) => { const m = new T.Mesh(new T.CircleGeometry(1, 28), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: T.DoubleSide, depthTest: false })); m.scale.set(w, h, 1); m.renderOrder = 5; g.add(m); return m; };
  const xm = RUD.x + (RUD.le - RUD.te) / 2, yLow = RUD.y0 + (RUD.y1 - RUD.y0) * 0.3 - SH.T, yHigh = RUD.y0 + (RUD.y1 - RUD.y0) * 0.72 - SH.T;
  S.hitStrong = patch(P.bad, 2.6, 2.6); S.hitStrong.position.set(xm, yLow, 0.75); /* 타 우측 아래: 강함 */
  S.hitWeak = patch(P.amber, 1.7, 1.7); S.hitWeak.position.set(xm, yHigh, -0.75); /* 타 좌측 위: 약함 */
  S.hitHull = patch(P.bad, 5, 3.2); S.hitHull.position.set(hx, yk - SH.T, hitZ + 0.3); /* 선미 우현 선체 */
  S.hitHullPt = V3(hx, yk - SH.T + 4, hitZ + 2); S.hitRudPt = V3(xm, yLow - 3, 3);
  return S;
}
const STEPS_A = [
  { t: 0, h: '정지', p: '기관 정지, 프로펠러도 멈춰 있다. 타는 중앙이다.' },
  { t: 2, h: '미속 전진', p: '프로펠러가 선미에서 보아 시계 방향으로 돈다(우회전). 앞쪽에서 물을 빨아들이고(흡입류) 뒤로 나선형 배출류를 내보낸다. 시험선 자료의 회전수를 참고해 49 RPM으로 두었다(모델 값).' },
  { t: 5, h: '횡압력: 선수 좌회두 경향', p: '날개가 받는 물의 반작용에는 옆으로 미는 성분이 있다. 전진 때 위쪽 날개에는 좌현 쪽, 아래쪽 날개에는 우현 쪽으로 작용하는데, 수면에 가까운 위쪽 날개는 공기가 섞여 힘이 약하다. 그래서 선미가 우현으로 밀려 선수는 좌현으로 돈다.' },
  { t: 10, h: '배출류와 타: 선수 우회두 경향', p: '시계 방향 나선형 배출류는 타의 좌측 위, 우측 아래를 때린다. 우측 아래가 더 세서 선미를 좌현으로 밀고, 선수를 우현으로 돌리려 한다. 다만 전진 중에는 이 효과가 작아 횡압력 쪽이 더 드러난다.' },
  { t: 15, h: '기관 정지', p: '프로펠러는 멈췄지만 배는 관성으로 계속 나아간다.' },
  { t: 19, h: '반속 후진: 측압작용', p: '프로펠러가 반시계 방향으로 돈다(70 RPM, 모델 값). 배출류가 선미 우현 선체를 거의 직각으로 때려 선미를 좌현으로 민다. 이것이 측압작용이다. 후진 때 횡압력도 선미를 좌현으로 민다. 선미 쪽에서 본 흐름은 본문 아래 영상에서 따로 볼 수 있다.' },
  { t: 26, h: '후진 중 선수 우회두', p: '두 힘이 같은 쪽이고 측압작용이 훨씬 커서, 후진 때 선수는 타와 상관없이 우현으로 돌기 쉽다. 그래서 우회전 단일 프로펠러 선박은 제자리 우현 선회와 좌현 접안이 편하다.' }
];
export default {
  id: 'propwash', flowVis: 2.2, life: 3, flowBoost: 2.2,
  controls: [
    { k: 'mode', label: '장면', type: 'seg', opts: [['A', '전진·정지·후진'], ['B', '저속 전진 좌우 타']], val: 'A', restart: true },
    { k: 'side', label: '배가 따를 타', type: 'seg', opts: [['port', '좌현 15°'], ['stbd', '우현 15°']], val: 'port', when: p => p.mode === 'B' }
  ],
  water: { alpha: 0.32, amp: 0.15 }, parts: ['propeller', 'rudder', 'engine'],
  get dur() { return this.mode === 'A' ? 34 : 30; },
  get scale() { return this.mode === 'A' ? 10 : this.sc; },
  get cam() { return this.mode === 'A' ? { r: 92, th: 2.45, ph: 1.4, follow: true, target: c => { c.ship.yaw.updateMatrixWorld(); return V3(-136, -6, 2).applyMatrix4(c.ship.yaw.matrixWorld); } } : { r: 900, th: 2.4, ph: 0.55, follow: true }; },
  get legend() { return this.mode === 'A' ? [['jet0', '배출류 나선(전진)'], ['bad', '배출류가 때리는 자리·측압작용'], ['info', '횡압력·선저로 빠지는 흐름'], ['deck', '선수 회두']] : [['deck', '좌현 타 항적'], ['amber', '우현 타 항적'], ['info', '횡압력']]; },
  get chartTitle() { return this.mode === 'A' ? '선수 방위 변화와 선속' : '같은 크기 좌우 타각의 선수방위 변화'; },
  build(ctx, p) {
    this.ctx = ctx; this.p = p; this.mode = p.mode; const P = ctx.P;
    this.aSP = Arrow(P.info, 0.5, { top: true }); this.aDC = Arrow(P.bad, 0.5, { top: true }); this.aBow = Arrow(P.deck, 0.9, { top: true }); ctx.fxY.add(this.aSP, this.aDC, this.aBow);
    this.lSP = ctx.label('', 'dim', o => o.copy(this.pSP || V3())); this.lDC = ctx.label('', 'dim', o => o.copy(this.pDC || V3())); this.lBow = ctx.label('', 'dim', o => o.copy(this.pBow || V3()));
    this.st = { u: 0, v: 0, r: 0, n: 0, cref: 4, jref: 7 };
    return p.mode === 'A' ? this.buildA() : this.buildB(ctx, p);
  },
  buildA() {
    this.steps = STEPS_A;
    this.S = makeStreams(this.ctx, this.ctx.P); this.ctx.fxY.add(this.S.g); this.lHit = this.ctx.label('', 'dim', o => o.copy(this.pHit || V3()));
    const dt = 0.2, n = Math.ceil(340 / dt) + 1, A = { X: new Float32Array(n), Z: new Float32Array(n), psi: new Float32Array(n), u: new Float32Array(n), r: new Float32Array(n), n: new Float32Array(n), sp: new Float32Array(n), dc: new Float32Array(n), pl: new Float32Array(n) };
    let X = 0, Z = 0, psi = 0, u = 0, r = 0, rpm = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt, cmd = t < 20 ? 0 : t < 150 ? 49 : t < 190 ? 0 : -70;
      rpm += Math.max(-6 * dt, Math.min(6 * dt, cmd - rpm));
      const f = rpm / 49, a = 0.025 * f * Math.abs(f) - 0.000554 * u * Math.abs(u);
      const sp = rpm > 0 ? -0.0011 * (rpm / 49) / (1 + Math.abs(u) / 1.5) : rpm < 0 ? 0.0009 * (-rpm / 70) / (1 + Math.abs(u) / 3) : 0;
      const dc = rpm > 0 ? 0.0007 * (rpm / 49) * Math.min(1, u / 3) : 0, pl = rpm < 0 ? 0.0032 * (-rpm / 70) / (1 + Math.abs(u) / 4) : 0;
      A.X[i] = X; A.Z[i] = Z; A.psi[i] = psi; A.u[i] = u; A.r[i] = r; A.n[i] = rpm; A.sp[i] = sp; A.dc[i] = dc; A.pl[i] = pl;
      u += a * dt; r += ((sp + dc + pl) - r) / 40 * dt; X += u * Math.cos(psi) * dt; Z += u * Math.sin(psi) * dt; psi += r * dt;
    }
    A.dt = dt; A.n_ = n; this.A = A;
  },
  buildB(ctx, p) {
    const P = ctx.P, U0 = 4 * KN;
    const run = side => maneuver({ U0, dur: 240, K0: 3.5, Tp: 1.0, cY: 0.1, loss: 0.2, /* 저속에서도 배출류가 타에 닿아 타효가 커지는 것을 반영해 K′를 크게 둔 모델 */ cmd: st => st.t < 6 ? 0 : (side === 'port' ? -15 : 15),
      moment: st => -3.5 * DEG / (1 + st.u / 1.5) });
    this.port = run('port'); this.stbd = run('stbd');
    this.main = p.side === 'port' ? this.port : this.stbd; this.other = p.side === 'port' ? this.stbd : this.port;
    this.sc = this.port.dur / 30;
    const iAt = (A, deg) => { for (let i = 0; i < A.n; i++) if (Math.abs(A.psi[i]) >= deg * DEG) return i; return A.n - 1; };
    this.t10p = iAt(this.port, 10) * this.port.dt; this.t10s = iAt(this.stbd, 10) * this.stbd.dt;
    const S = s => s / this.sc;
    this.steps = [
      { t: 0, h: '저속 전진', p: '4노트로 천천히 나아간다. 프로펠러는 전진 회전 중이고 타는 중앙이다. 선속이 낮을수록 프로펠러가 만드는 옆 힘의 영향이 커진다.' },
      { t: S(6), h: '같은 15°를 좌우로', p: '한 번은 좌현 15°, 한 번은 우현 15°를 준다. 타력 자체는 좌우가 같다.' },
      { t: S(6) + 3, h: '횡압력이 더해진다', p: '횡압력은 늘 선미를 우현으로 밀어 선수를 좌현으로 돌린다. 좌현 타의 회두와 방향이 같아 더해지고, 우현 타의 회두와는 반대라 깎인다.' },
      { t: S(Math.min(this.t10p, this.t10s)), h: `좌현 타가 먼저 10°에 닿는다`, p: `선수방위가 10° 바뀌기까지 좌현 타는 약 ${fmt(this.t10p, 0)}초, 우현 타는 약 ${fmt(this.t10s, 0)}초가 걸렸다(모델 값). 우회전 단일 프로펠러 선박은 저속 전진에서 좌현 쪽 회두가 촉진되고 우현 쪽은 늦어진다.` },
      { t: S(Math.max(this.t10p, this.t10s)) + 2, h: '조건에 따라 달라진다', p: '프로펠러가 수면에 가까울수록(공선·발라스트) 차이가 커지고, 프로펠러가 충분히 잠기고 전진 관성이 크면 차이가 작아진다. 배출류는 선수를 우현으로 돌리려 하지만 전진 중에는 영향이 작다.' }
    ];
    this.ribM = Ribbon(this.trk(this.main), 6, p.side === 'port' ? P.deck : P.amber, 0.7); this.ribO = Ribbon(this.trk(this.other), 4, p.side === 'port' ? P.amber : P.deck, 0.65, 0.75);
    this.ghost = Ghost(0, 0, 0, p.side === 'port' ? P.amber : P.deck, 0.8); ctx.fxW.add(this.ribM, this.ribO, this.ghost);
    ctx.fxW.add(Line([V3(-100, 0.6, 0), V3(1400, 0.6, 0)], P.muted, { dash: 20 }));
    this.hM = Line([V3(), V3(1, 0, 0)], p.side === 'port' ? P.deck : P.amber, { top: true }); this.hO = Line([V3(), V3(1, 0, 0)], p.side === 'port' ? P.amber : P.deck, { top: true, dash: 10 }); ctx.fxW.add(this.hM, this.hO);
    this.lM = ctx.label('', 'dim', o => o.copy(this.pM || V3())); this.lO = ctx.label('', 'dim', o => o.copy(this.pO || V3()));
  },
  trk(A) { const g = []; for (let i = 0; i < A.n; i += 4) g.push([A.X[i], A.Z[i]]); return g; },
  apply(t) {
    const ship = this.ctx.ship, W = v => { ship.yaw.updateMatrixWorld(); return v.applyMatrix4(ship.yaw.matrixWorld); }, Sk = 26000;
    const spArrow = sp => { const d = sp < 0 ? 1 : -1, py = PROP.y - SH.T; this.aSP.set(V3(PROP.x - 2, py - 7, 0), V3(0, 0, d), Math.abs(sp) * Sk); this.pSP = W(V3(PROP.x - 2, py - 9, d * (Math.abs(sp) * Sk + 3))); this.lSP.set(Math.abs(sp) > 1e-5 ? `<b style="color:var(--info)">횡압력</b><i>선미 ${d > 0 ? '우현' : '좌현'}으로</i>` : ''); };
    if (this.mode === 'A') {
      const A = this.A, ts = t * 10, i = Math.min(A.n_ - 1, Math.max(0, Math.round(ts / A.dt)));
      const psi = A.psi[i], u = A.u[i], r = A.r[i], rpm = A.n[i], sp = A.sp[i], dc = A.dc[i], pl = A.pl[i], py = PROP.y - SH.T;
      ship.pose(A.X[i], A.Z[i], psi); ship.rudder.rotation.y = 0;
      spArrow(sp);
      if (dc > 1e-5) { this.aDC.set(V3(RUD.x - 3, py, 6), V3(0, 0, -1), dc * Sk); this.pDC = W(V3(RUD.x - 3, py + 3, 6 - dc * Sk - 3)); this.lDC.set('<b style="color:var(--bad)">배출류 → 타</b><i>선미 좌현으로</i>'); }
      else if (pl > 1e-5) { const zz = hw(-128, 8) + 1 + pl * Sk; this.aDC.set(V3(-128, py + 3, zz), V3(0, 0, -1), pl * Sk); this.pDC = W(V3(-128, py + 6, zz + 2)); this.lDC.set('<b style="color:var(--bad)">측압작용</b><i>배출류가 우현 선미를 때림</i>'); }
      else { this.aDC.visible = false; this.lDC.set(''); }
      const bowL = Math.abs(r) * 9000; this.aBow.set(V3(XF - 10, SH.D - SH.T + 8, 0), V3(0, 0, Math.sign(r) || 1), bowL); this.pBow = W(V3(XF - 10, SH.D - SH.T + 14, (Math.sign(r) || 1) * (bowL + 6)));
      this.lBow.set(bowL > 3 ? `<b style="color:var(--deck)">선수 ${r > 0 ? '우' : '좌'}회두</b>` : '');
      this.streams(t, rpm, W);
      this.cur = { ts, psi, u, r, rpm, sp, dc, pl }; Object.assign(this.st, { u, v: 0, r, n: rpm });
      return;
    }
    const ts = t * this.sc, A = this.main, B = this.other, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))), j = Math.min(B.n - 1, Math.max(0, Math.round(ts / B.dt)));
    ship.pose(A.X[i], A.Z[i], A.psi[i]); ship.rudder.rotation.y = A.del[i];
    this.ghost.position.set(B.X[j], 0.8, B.Z[j]); this.ghost.rotation.y = -B.psi[j];
    this.ribM.setCount(i / 4); this.ribO.setCount(j / 4);
    const HL = 500, tip = (X, Z, ps) => V3(X + HL * Math.cos(ps), 4, Z + HL * Math.sin(ps));
    setLine(this.hM, [V3(A.X[i], 4, A.Z[i]), tip(A.X[i], A.Z[i], A.psi[i])]); setLine(this.hO, [V3(B.X[j], 4, B.Z[j]), tip(B.X[j], B.Z[j], B.psi[j])]);
    this.pM = tip(A.X[i], A.Z[i], A.psi[i]); this.pO = tip(B.X[j], B.Z[j], B.psi[j]);
    const nm = X => X === this.port ? '좌현 15°' : '우현 15°';
    this.lM.set(ts > 6 ? `<b>${nm(A)}</b><i>${sgn(A.psi[i] / DEG, 1)}°</i>` : ''); this.lO.set(ts > 6 ? `<b>${nm(B)}</b><i>${sgn(B.psi[j] / DEG, 1)}°</i>` : '');
    spArrow(-0.0011); this.aDC.visible = false; this.lDC.set(''); this.aBow.visible = false; this.lBow.set('');
    this.cur = { ts, i, j }; Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i], n: 49 });
  },
  streams(t, rpm, W) {
    const S = this.S, fw = rpm > 1, as = rpm < -1, k = Math.min(1, Math.abs(rpm) / 40);
    const run = (list, on, speed) => { for (const st of list) { st.m.opacity = on ? 0.95 * k : 0; st.arr.forEach((c, i) => { c.visible = on && k > 0.05; if (!c.visible) return; const f = ((i / st.arr.length) + t * speed) % 1, [p, d] = samplePath(st.pts, f); c.position.copy(p); c.lookAt(p.clone().add(d)); c.scale.setScalar(0.6 + 0.6 * Math.sin(Math.PI * f)); }); } };
    run(S.fwd, fw, 0.32); run(S.ast, as, 0.42);
    const pulse = 0.45 + 0.25 * Math.sin(t * 5);
    S.hitStrong.visible = S.hitWeak.visible = fw && k > 0.05; S.hitHull.visible = as && k > 0.05;
    S.hitStrong.material.opacity = pulse * k + 0.1; S.hitWeak.material.opacity = (pulse * 0.6) * k + 0.05; S.hitHull.material.opacity = pulse * k + 0.1;
    if (fw && k > 0.05) { this.pHit = W(S.hitRudPt.clone()); this.lHit.set('<b style="color:var(--bad)">타격: 타 우측 아래 (강함)</b><i>좌측 위는 약함</i>'); }
    else if (as && k > 0.05) { this.pHit = W(S.hitHullPt.clone()); this.lHit.set('<b style="color:var(--bad)">타격: 선미 우현 선체</b><i>측압작용</i>'); }
    else this.lHit.set('');
  },
  read() {
    if (this.mode === 'A') {
      const c = this.cur, slip = apparentSlip(PROP.P, c.rpm, c.u);
      const eng = c.rpm > 1 ? '미속 전진 (Slow ahead)' : c.rpm < -1 ? '반속 후진 (Half astern)' : '정지 (Stop)';
      const dom = c.pl > 1e-5 ? '측압작용 (선수 우회두)' : (c.dc > Math.abs(c.sp) ? '배출류 (선수 우회두)' : Math.abs(c.sp) > 1e-5 ? '횡압력 (선수 좌회두)' : '없음');
      return [['기관', eng], ['회전수', fmt(Math.abs(c.rpm), 0) + ' RPM' + (c.rpm > 1 ? ', 시계 방향' : c.rpm < -1 ? ', 반시계 방향' : '')], ['선속', sgn(c.u / KN, 1) + ' kn'], ['겉보기 슬립', slip == null ? '—' : fmt(Math.max(-99, Math.min(100, slip * 100)), 0) + '%'], ['선수 방위 변화', sgn(c.psi / DEG, 1) + '°'], ['우세한 힘', dom]];
    }
    const { i, j, ts } = this.cur, A = this.main, B = this.other, pA = A === this.port ? A.psi[i] : B.psi[j], pS = A === this.stbd ? A.psi[i] : B.psi[j];
    return [['경과 시간', realTime(ts)], ['선속', fmt(A.u[i] / KN, 1) + ' kn'], ['좌현 15° 회두', sgn(pA / DEG, 1) + '°'], ['우현 15° 회두', sgn(pS / DEG, 1) + '°'], ['10°까지 걸린 시간', '좌현 ' + fmt(this.t10p, 0) + '초 / 우현 ' + fmt(this.t10s, 0) + '초'], ['촉진되는 쪽', '좌현 (선수 좌회두)', 'ok']];
  },
  chart(cv, P, { lineChart }) {
    if (this.mode === 'A') {
      const A = this.A, h = [], s = []; for (let i = 0; i < A.n_; i += 5) { h.push([i * A.dt, A.psi[i] / DEG]); s.push([i * A.dt, A.u[i] / KN]); }
      const m = Math.max(4, ...h.map(x => Math.abs(x[1]))) * 1.15;
      lineChart(cv, P, { x0: 0, x1: 340, upto: this.cur.ts, cursor: this.cur.ts, right: true, xt: [[20, '전진'], [150, '정지'], [190, '후진']], series: [{ data: h, color: P.deck, min: -m, max: m, yt: [Math.round(-m / 1.15), 0, Math.round(m / 1.15)], label: '선수 방위 °(+ 우현)' }, { data: s, color: P.info, min: -8, max: 8, yt: [-6, 0, 6], axis: true, label: '선속 kn' }] });
      return;
    }
    const a = [], b = []; for (let k = 0; k < this.port.n; k += 6) a.push([k * this.port.dt, -this.port.psi[k] / DEG]); for (let k = 0; k < this.stbd.n; k += 6) b.push([k * this.stbd.dt, this.stbd.psi[k] / DEG]);
    const m = Math.max(...a.map(x => x[1]), ...b.map(x => x[1])) * 1.1;
    lineChart(cv, P, { x0: 0, x1: this.port.dur, upto: this.cur.ts, cursor: this.cur.ts, xt: [[0, '0'], [60, '1분'], [120, '2분'], [240, '4분']], series: [{ data: a, color: P.deck, min: 0, max: m, yt: [0, 10, Math.round(m / 1.1)], hlines: [10], label: '좌현 15° (좌회두 크기)' }, { data: b, color: P.amber, min: 0, max: m, label: '우현 15° (우회두 크기)' }] });
  },
  field(x, y, z, o, st) { baseWater(x, y, z, o, st); hullDeflect(x, y, z, o); propJet(x, y, z, o, st); },
  get spawn() { return this.mode === 'A' ? p => boxSpawn([-230, -70, -15, -0.5, -30, 30], p) : p => boxSpawn([-330, 330, -16, -0.6, -130, 130], p); },
  get box() { return this.mode === 'A' ? [-260, -40, -18, 1, -45, 45] : [-360, 360, -18, 1, -160, 160]; }
};
void smooth;
