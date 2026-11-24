/* 2-2 경사와 복원성: 횡(중앙 단면을 실제로 잘라 부심·GZ 계산) / 종(같은 각도에서 종복원 비교) */
import { SH, DEG, G9, XA, smooth } from '../physics/ship.js';
import { SEC0, SEC, equilibrium, sectionWorld, clipBelow, polyAC, bmLong, waterplane } from '../physics/stability.js';
import { Arrow, Dot, Line, setLine, V3 } from '../engine/draw.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
export default {
  id: 'stab', dur: 34, scale: 2.5, flowVis: 3, flowN: 0,
  controls: [
    { k: 'dir', label: '방향', type: 'seg', opts: [['T', '횡(좌우)'], ['L', '종(앞뒤)']], val: 'T', restart: true },
    { k: 'gm', label: 'GM', type: 'range', min: -0.6, max: 3.0, step: 0.1, val: 1.8, fmt: v => fmt(v, 1) + ' m', when: p => p.dir === 'T' }
  ],
  water: { alpha: 0.5, amp: 0 }, parts: ['hull'],
  get cam() { return this.dir === 'L' ? { r: 520, th: Math.PI / 2, ph: 1.47, target: () => V3(0, 4, 0) } : { r: 125, th: Math.PI + 0.12, ph: 1.42, target: () => V3(XA - 6, 2, 0) }; },
  get legend() { return [['bad', 'G 무게중심 · 무게'], ['info', 'B 부심 · 부력'], ['ok', 'M 메타센터'], ['amber', 'GZ 복원정']]; },
  get chartTitle() { return this.dir === 'L' ? '같은 경사각에서 복원 모멘트 비교' : 'GZ 곡선 (중앙 단면으로 계산)'; },
  build(ctx, p) {
    this.ctx = ctx; this.dir = p.dir; const P = ctx.P, ship = ctx.ship;
    this.st = { u: 0, v: 0, r: 0 };
    if (p.dir === 'L') return this.buildL(ctx);
    this.GM = p.gm; this.KG = SEC0.KM - p.gm; ship.setKG(this.KG); ship.setOpacity(0.28);
    const tbl = []; for (let d = -70; d <= 70.01; d += 0.5) tbl.push(equilibrium(d * DEG, this.KG)); this.tbl = tbl;
    const at = (ph, key) => { const f = (ph / DEG + 70) / 0.5, i = Math.max(0, Math.min(tbl.length - 2, Math.floor(f))), u = Math.max(0, Math.min(1, f - i)); return tbl[i][key] + (tbl[i + 1][key] - tbl[i][key]) * u; };
    this.gzf = ph => at(ph, 'GZ'); this.hvf = ph => at(ph, 'hv');
    const dt = 0.02, n = Math.ceil(this.dur * this.scale / dt) + 1, k = 0.40 * SH.B, rel = 5.2 * this.scale, phi0 = 15 * DEG;
    const w0 = Math.sqrt(G9 * Math.max(0.15, Math.abs(p.gm))) / k;
    this.phi = new Float32Array(n); let ph = 0, dph = 0;
    for (let i = 0; i < n; i++) {
      const ts = i * dt;
      if (ts < rel) { ph = phi0 * smooth((ts - 1.2 * this.scale) / (3.6 * this.scale)); dph = 0; }
      else { const acc = -G9 * this.gzf(ph) / (k * k) - 2 * 0.045 * w0 * dph - dph * Math.abs(dph); dph += acc * dt; ph += dph * dt; if (Math.abs(ph) > 60 * DEG) { ph = Math.sign(ph) * 60 * DEG; dph = 0; } }
      this.phi[i] = ph;
    }
    this.dt = dt;
    this.steps = [
      { t: 0, h: '바로 선 상태', p: '무게(G에서 아래로)와 부력(B에서 위로)이 같은 연직선 위에서 크기는 같고 방향은 반대다. 그래서 배는 가만히 떠 있다.' },
      { t: 1.2, h: '외력으로 기울임', p: '옆바람이 선체를 15°까지 기울인다. 낮아진 쪽은 더 잠기고 반대쪽은 떠올라 잠긴 단면(파란 면)이 비대칭이 된다. 그 중심인 B가 낮아진 쪽으로 옮겨 간다. 화물이 움직이지 않으면 G는 그대로다.' },
      { t: 5.2, h: '외력이 사라짐', p: '부력은 옮겨 간 B에서 위로, 무게는 G에서 아래로 작용한다. 두 작용선 사이 거리가 GZ다. 크기가 같고 방향이 반대인 두 힘이 짝힘을 이루어 복원 모멘트 W·GZ로 배를 되돌린다.' },
      { t: 11, h: '횡요', p: '배는 바로 선 자리를 지나쳐 반대로 기울었다가 다시 돌아온다. 물의 저항으로 조금씩 잦아든다. 한 번 왕복하는 시간이 횡요 주기다.' },
      { t: 22, h: 'GM의 크기', p: 'GM이 크면 빨리 되돌아오지만 흔들림이 거칠다. 작으면 느리고 부드럽지만 여유가 적다. 오른쪽에서 GM을 0이나 음수로 바꾸면 중립과 불안정 상태를 볼 수 있다.' }
    ];
    const X = XA - 6, fx = ctx.fxY, T = ctx.THREE;
    this.secLine = Line([V3(X, 0, 0), V3(X, 1, 0)], P.ink, { top: true, opacity: 0.9 }); fx.add(this.secLine);
    this.fill = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: P.info, transparent: true, opacity: 0.38, side: T.DoubleSide, depthWrite: false })); this.fill.renderOrder = 5; fx.add(this.fill);
    this.cl = Line([V3(X, 0, 0), V3(X, 1, 0)], P.muted, { dash: 1.2, top: true }); fx.add(this.cl);
    fx.add(Line([V3(X, 0, -40), V3(X, 0, 40)], P.info, { top: true, opacity: 0.7 }));
    this.dG = Dot(P.bad, 0.9); this.dB = Dot(P.info, 0.9); this.dM = Dot(P.ok, 0.9); this.dZ = Dot(P.amber, 0.6); fx.add(this.dG, this.dB, this.dM, this.dZ);
    this.aW = Arrow(P.bad, 0.35, { top: true }); this.aB = Arrow(P.info, 0.35, { top: true }); fx.add(this.aW, this.aB);
    this.gzL = Line([V3(X, 0, 0), V3(X, 0, 1)], P.amber, { top: true }); fx.add(this.gzL);
    this.bl = Line([V3(X, 0, 0), V3(X, 1, 0)], P.info, { dash: 0.8, top: true, opacity: 0.8 }); fx.add(this.bl);
    this.wind = []; for (let i = 0; i < 3; i++) { const a = Arrow(P.muted, 0.5, { opacity: 0.8 }); fx.add(a); this.wind.push(a); }
    const L = (txt, obj, off) => ctx.label(txt, 'dim', o => { obj.updateMatrixWorld(); return o.copy(off).applyMatrix4(obj.matrixWorld); });
    L('<b style="color:var(--bad)">G</b>', this.dG, V3(0, 0, -1.8)); L('<b style="color:var(--info)">B</b>', this.dB, V3(0, -1.2, 0)); L('<b style="color:var(--ok)">M</b>', this.dM, V3(0, 1.4, 0));
    this.gzLbl = ctx.label('', 'dim', o => o.copy(this.gzMid || V3()));
    ctx.label('중앙 단면', 'dim', o => { ship.yaw.updateMatrixWorld(); return o.set(X, SH.D - SH.T + 6, 0).applyMatrix4(ship.yaw.matrixWorld); });
  },
  buildL(ctx) {
    const P = ctx.P, ship = ctx.ship; ship.setKG(SEC0.KM - 1.8); ship.setOpacity(0.35);
    this.KG = SEC0.KM - 1.8; this.BML = bmLong(); this.GML = this.BML + SEC0.KB - this.KG; this.GMT = 1.8;
    this.steps = [
      { t: 0, h: '같은 배, 다른 방향', p: '이번에는 배를 옆에서 본다. 같은 무게, 같은 G로 선수 쪽을 1° 들어 올리면(종경사, 트림) 어떻게 되는지 횡경사와 비교한다.' },
      { t: 4, h: '부심이 길게 옮겨 간다', p: '선수가 들리면 선미 쪽이 더 잠겨 부심 B가 선미 쪽으로 옮겨 간다. 배가 길어서 아주 작은 각도에도 B가 크게 움직인다.' },
      { t: 10, h: '종메타센터는 아주 높다', p: `BM = I ÷ V에서 I는 수선면의 관성 모멘트다. 길이 방향 관성 모멘트는 길이의 세제곱에 비례해 폭 방향보다 훨씬 크다. 이 배는 BM<sub>T</sub> 약 ${fmt(SEC0.BM, 1)} m, BM<sub>L</sub> 약 ${fmt(this.BML, 0)} m다.` },
      { t: 18, h: '종복원력이 훨씬 크다', p: `같은 1°에서 종방향 복원 모멘트는 횡방향의 약 ${fmt(this.GML / this.GMT, 0)}배다. 그래서 피치는 각도가 작고 빨리 되돌아오며, 배가 앞뒤로 전복되는 일은 거의 없다. 복원성은 주로 횡경사에 대해 따진다.` }
    ];
    const fx = ctx.fxY;
    this.dG = Dot(P.bad, 3); this.dB = Dot(P.info, 3); fx.add(this.dG, this.dB);
    this.aW = Arrow(P.bad, 1.2, { top: true }); this.aB = Arrow(P.info, 1.2, { top: true }); fx.add(this.aW, this.aB);
    this.bl = Line([V3(), V3(0, 1, 0)], P.info, { dash: 4, top: true, opacity: 0.8 }); fx.add(this.bl);
    this.gzL = Line([V3(), V3(1, 0, 0)], P.amber, { top: true }); fx.add(this.gzL);
    fx.add(Line([V3(-170, 0, 0), V3(170, 0, 0)], P.info, { top: true, opacity: 0.6 }));
    this.mArrow = Arrow(P.ok, 1.2, { top: true }); fx.add(this.mArrow);
    const L = (txt, fn) => ctx.label(txt, 'dim', o => { ship.yaw.updateMatrixWorld(); return fn(o).applyMatrix4(ship.yaw.matrixWorld); });
    L('<b style="color:var(--bad)">G</b>', o => o.copy(this.dG.position).add(V3(0, 5, 0))); L('<b style="color:var(--info)">B</b>', o => o.copy(this.dB.position).add(V3(0, -5, 0)));
    L(`<b style="color:var(--ok)">M<sub>L</sub>은 G 위 약 ${fmt(this.GML, 0)} m</b>`, o => o.set(0, 92, 0));
    this.gzLbl = ctx.label('', 'dim', o => o.copy(this.gzMid || V3()));
  },
  apply(t) {
    const ship = this.ctx.ship;
    if (this.dir === 'L') {
      const th = 1.0 * DEG * smooth((t - 1.5) / 4), Gy = this.KG - SH.T;
      ship.pose(0, 0, 0, 0, th, 0); this.th = th;
      const bx = -this.BML * Math.sin(th);
      this.dG.position.set(0, Gy, 0); this.dB.position.set(bx, SEC0.KB - SH.T, 0);
      this.aW.set(V3(0, Gy, 0), V3(0, -1, 0), 40); this.aB.set(V3(bx, SEC0.KB - SH.T, 0), V3(0, 1, 0), 40);
      setLine(this.bl, [V3(bx, SEC0.KB - SH.T, 0), V3(bx, 80, 0)]); setLine(this.gzL, [V3(0, Gy, 0), V3(bx, Gy, 0)]);
      this.mArrow.set(V3(0, Gy + 4, 0), V3(0, 1, 0), 80);
      this.gzMid = V3(bx / 2, Gy - 6, 0); ship.yaw.updateMatrixWorld(); this.gzMid.applyMatrix4(ship.yaw.matrixWorld);
      this.gzLbl.set(Math.abs(bx) > 0.5 ? `<b style="color:var(--amber)">종방향 GZ ${fmt(Math.abs(this.GML * Math.sin(th)), 1)} m</b>` : '');
      return;
    }
    const ts = t * this.scale, i = Math.min(this.phi.length - 1, Math.round(ts / this.dt)), ph = this.phi[i], hv = this.hvf(ph), KG = this.KG, X = XA - 6;
    ship.pose(0, 0, 0, ph, 0, hv); this.ph = ph;
    const sw = sectionWorld(ph, KG, hv), pts = sw.map(([z, y]) => V3(X, y, z)); pts.push(pts[0].clone()); setLine(this.secLine, pts);
    const poly = clipBelow(sw), ac = polyAC(poly), T = this.ctx.THREE;
    if (poly.length > 2) { const g = new T.ShapeGeometry(new T.Shape(poly.map(([z, y]) => new T.Vector2(z, y)))); g.rotateY(-Math.PI / 2); g.translate(X, 0, 0); this.fill.geometry.dispose(); this.fill.geometry = g; }
    const Gy = KG - SH.T + hv, s = Math.sin(ph), c = Math.cos(ph);
    setLine(this.cl, [V3(X, Gy - (KG + 2) * c, -(KG + 2) * s), V3(X, Gy + (SH.D - KG + 30) * c, (SH.D - KG + 30) * s)]);
    this.dG.position.set(X, Gy, 0); this.dB.position.set(X, ac.y, ac.z);
    const My = Math.abs(s) > 0.02 ? Gy + (ac.z / s) * c : Gy + (SEC0.KM - KG), Mz = Math.abs(s) > 0.02 ? ac.z : 0;
    this.dM.position.set(X, Math.max(-30, Math.min(60, My)), Mz); this.dM.visible = Math.abs(My - Gy) < 40;
    this.aW.set(V3(X, Gy, 0), V3(0, -1, 0), 14); this.aB.set(V3(X, ac.y, ac.z), V3(0, 1, 0), 14);
    this.dZ.position.set(X, Gy, ac.z);
    setLine(this.gzL, [V3(X, Gy, 0), V3(X, Gy, ac.z)]); setLine(this.bl, [V3(X, ac.y, ac.z), V3(X, Gy + 6, ac.z)]);
    this.gzMid = V3(X, Gy - 1.6, ac.z / 2); ship.yaw.updateMatrixWorld(); this.gzMid.applyMatrix4(ship.yaw.matrixWorld);
    this.gzLbl.set(Math.abs(ac.z) > 0.05 ? `<b style="color:var(--amber)">GZ ${fmt(Math.abs(ac.z), 2)} m</b>` : '');
    const wOn = t > 1.0 && t < 5.2; this.wind.forEach((a, k) => wOn ? a.set(V3(X + 30 - k * 60, 8 + k * 3, -64), V3(0, 0, 1), 16) : (a.visible = false));
    this.GZ = ac.z;
  },
  read() {
    if (this.dir === 'L') {
      const th = this.th / DEG, mT = SH.disp * this.GMT * Math.sin(this.th), mL = SH.disp * this.GML * Math.sin(this.th);
      return [['종경사(트림)', sgn(th, 2) + '° (선수 들림)'], ['BM 횡 / 종', fmt(SEC0.BM, 1) + ' m / ' + fmt(this.BML, 0) + ' m'], ['GM 횡 / 종', fmt(this.GMT, 1) + ' m / ' + fmt(this.GML, 0) + ' m'], ['같은 각도 횡 모멘트', fmt(mT, 0) + ' t·m'], ['같은 각도 종 모멘트', fmt(mL, 0) + ' t·m'], ['비율', '약 ' + fmt(this.GML / this.GMT, 0) + '배', 'ok']];
    }
    const gm = this.GM, ph = this.ph / DEG, gz = this.GZ * Math.sign(this.ph || 1);
    const v = gm > 0.29 ? ['안정 · G가 M 아래', 'ok'] : gm > -0.05 ? ['중립에 가까움', 'warn'] : ['불안정 · G가 M 위', 'bad'];
    return [['GM', fmt(gm, 1) + ' m'], ['KG / KM', fmt(this.KG, 1) + ' m / ' + fmt(SEC0.KM, 1) + ' m'], ['횡경사', sgn(ph, 1) + '° ' + (ph > 0.05 ? '(우현)' : ph < -0.05 ? '(좌현)' : '')], ['GZ', fmt(gz, 2) + ' m'], ['복원 모멘트', fmt(SH.disp * gz, 0) + ' t·m'], ['횡요 주기', gm > 0.05 ? '약 ' + fmt(0.8 * SH.B / Math.sqrt(gm), 0) + '초' : '없음'], ['판정', v[0], v[1]]];
  },
  chart(cv, P, { lineChart }) {
    if (this.dir === 'L') {
      const a = [], b = []; for (let d = 0; d <= 3; d += 0.1) { a.push([d, SH.disp * this.GMT * Math.sin(d * DEG) / 1000]); b.push([d, SH.disp * this.GML * Math.sin(d * DEG) / 1000]); }
      const m = b[b.length - 1][1];
      lineChart(cv, P, { x0: 0, x1: 3, xt: [[0, '0°'], [1, '1°'], [2, '2°'], [3, '3°']], series: [{ data: b, color: P.ok, min: 0, max: m * 1.05, yt: [0, Math.round(m / 2), Math.round(m)], label: '종 (천 t·m)' }, { data: a, color: P.info, min: 0, max: m * 1.05, label: '횡 (천 t·m)', width: 2.5 }] });
      return;
    }
    const data = []; for (let d = 0; d <= 60; d++) data.push([d, this.gzf(d * DEG)]);
    const mx = Math.max(0.5, ...data.map(d => Math.abs(d[1])));
    lineChart(cv, P, { x0: 0, x1: 60, xt: [[0, '0°'], [15, '15°'], [30, '30°'], [45, '45°'], [60, '60°']], series: [{ data, color: P.amber, min: -mx, max: mx * 1.1, yt: [0, +(mx / 2).toFixed(1)], label: 'GZ (m)', mark: [Math.abs(this.ph / DEG), this.gzf(Math.abs(this.ph))] }] });
  }
};
void SEC; void waterplane;
