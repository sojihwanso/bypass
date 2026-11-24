/* 1-3 기본 용어: 배 주변 방향(상대방위), 가로 단면 치수, 길이 방향 치수를 차례로 짚는다 */
import { SH, XA, XF, hullHalfWidth as hw } from '../physics/ship.js';
import { Line, V3, Dot } from '../engine/draw.js';
const fmt = (v, d = 1) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const GROUPS = [
  { t: 0, key: 'dir', cam: { r: 860, th: 2.2, ph: 0.32 } },
  { t: 12, key: 'trans', cam: { r: 120, th: Math.PI, ph: 1.45 } },
  { t: 24, key: 'long', cam: { r: 520, th: Math.PI / 2 + 0.12, ph: 1.38 } }
];
export default {
  id: 'terms', dur: 36, scale: 1,
  controls: [],
  cam: GROUPS[0].cam, water: { alpha: 0.5, amp: 0.1 }, parts: ['hull'],
  legend: [['amber', '방향'], ['info', '가로 단면 치수'], ['deck', '길이 방향 치수'], ['muted', '모식 표시']],
  chartTitle: '',
  steps: [
    { t: 0, h: '배 주변의 방향', p: '선수를 0°로 두고 시계 방향으로 잰다. 정선수(Ahead) 000°, 정횡(Abeam) 090°와 270°, 정선미(Astern) 180°다. 그 사이 대략 45° 쪽을 선수(bow), 135°·225° 쪽을 선미(quarter)라 부른다.' },
    { t: 6, h: '좌현과 우현', p: '선미에서 선수를 바라볼 때 오른쪽이 우현(starboard), 왼쪽이 좌현(port)이다. "우현 선수에 어선"이라고 하면 약 045° 쪽을 말한다.' },
    { t: 12, h: '흘수와 건현', p: '가로 단면을 선미 쪽에서 본다. 물에 잠긴 깊이가 흘수(Draught), 수면에서 갑판까지가 건현(Freeboard)이다. 건현은 남은 부력, 곧 예비 부력의 크기를 보여 준다.' },
    { t: 18, h: '깊이와 폭', p: '용골 윗면에서 갑판까지가 깊이(Depth), 가장 넓은 곳의 가로 길이가 폭(Breadth)이다. 갑판 가운데를 양쪽보다 높게 휜 정도가 캠버, 현측 윗부분이 안쪽으로 굽은 정도가 텀블 홈이다.' },
    { t: 24, h: '배의 길이', p: '선수 맨 앞에서 선미 맨 뒤까지가 전장(LOA), 선수수선과 선미수선 사이가 수선간장(LBP), 수면에 닿은 길이가 수선장(LWL)이다. 보통 LOA가 가장 길고 LBP가 가장 짧다.' },
    { t: 30, h: '만재흘수선과 현호', p: '항해 안전상 허락되는 가장 깊은 흘수선이 만재흘수선(Load line)이다. 상갑판이 길이 방향으로 휜 정도가 현호(Sheer)로, 선체 중앙이 가장 낮고 선수·선미가 높다.' }
  ],
  build(ctx) {
    this.ctx = ctx; const P = ctx.P, T = SH.T, D = SH.D - SH.T, hb = SH.B / 2;
    ctx.ship.pose(0, 0, 0); this.groups = {}; this.labels = [];
    const G = key => { const g = new ctx.THREE.Group(); ctx.fxY.add(g); this.groups[key] = g; return g; };
    const lab = (key, html, x, y, z) => { const L = ctx.label(html, 'dim', o => { ctx.ship.yaw.updateMatrixWorld(); return o.set(x, y, z).applyMatrix4(ctx.ship.yaw.matrixWorld); }); L.key = key; L.html = html; this.labels.push(L); };
    /* 방향: 수면 위 원과 여덟 방위선 */
    const gd = G('dir'), R = 300, pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * 2 * Math.PI; pts.push(V3(R * Math.cos(a), 0.6, R * Math.sin(a))); }
    gd.add(Line(pts, P.amber, { dash: 12, opacity: 0.8 }));
    const DIRS = [[0, 'Ahead 정선수 000°'], [45, '우현 선수 045°'], [90, 'Abeam 우현 정횡 090°'], [135, '우현 선미 135°'], [180, 'Astern 정선미 180°'], [225, '좌현 선미 225°'], [270, 'Abeam 좌현 정횡 270°'], [315, '좌현 선수 315°']];
    for (const [deg, txt] of DIRS) {
      const a = deg * Math.PI / 180, x = Math.cos(a), z = Math.sin(a); /* +x 선수, +z 우현: 시계 방향(위에서 볼 때) */
      gd.add(Line([V3(x * 40, 0.8, z * 40), V3(x * R, 0.8, z * R)], deg % 90 ? P.muted : P.amber, { opacity: 0.9 }));
      lab('dir', `<b style="color:var(--amber)">${txt}</b>`, x * (R + 34), 2, z * (R + 34));
    }
    lab('dir', '<b>우현 (starboard)</b>', 0, 30, 70); lab('dir', '<b>좌현 (port)</b>', 0, 30, -70);
    /* 가로 단면: 선체 중앙 단면을 선미 뒤쪽(x0)으로 옮겨 그린다(상부 구조물에 가리지 않게) */
    const X0 = XA - 32, gt = G('trans'), sec = []; for (let i = 0; i <= 24; i++) { const y = SH.D * i / 24; sec.push(V3(X0, y - T, hw(0, y))); } const secL = sec.slice().reverse().map(v => V3(v.x, v.y, -v.z));
    gt.add(Line(secL.concat(sec), P.info, { top: true }));
    gt.add(Line([V3(X0, D, -hb), V3(X0, D + 0.86, 0), V3(X0, D, hb)], P.muted, { top: true, dash: 1.2 }));
    const dim = (g, a, b, color, o = {}) => { g.add(Line([a, b], color, { top: true, ...o })); for (const p of [a, b]) { const d = Dot(color, 0.6); d.position.copy(p); g.add(d); } };
    const zx = hb + 6; dim(gt, V3(X0, -T, zx), V3(X0, 0, zx), P.info); dim(gt, V3(X0, 0, zx + 6), V3(X0, D, zx + 6), P.amber);
    dim(gt, V3(X0, -T, -zx), V3(X0, D, -zx), P.deck); dim(gt, V3(X0, D + 5, -hb), V3(X0, D + 5, hb), P.info);
    gt.add(Line([V3(X0, 0, -hb - 20), V3(X0, 0, hb + 20)], P.ink, { dash: 2, opacity: 0.6 }));
    const fill = new ctx.THREE.Shape(); secL.concat(sec).forEach((v, i) => i ? fill.lineTo(v.z, v.y) : fill.moveTo(v.z, v.y)); const fm = new ctx.THREE.Mesh(new ctx.THREE.ShapeGeometry(fill), new ctx.THREE.MeshBasicMaterial({ color: P.info, transparent: true, opacity: 0.16, side: ctx.THREE.DoubleSide, depthWrite: false })); fm.rotation.y = -Math.PI / 2; fm.position.x = X0; gt.add(fm);
    lab('trans', `<b style="color:var(--info)">흘수 Draught ${fmt(T)} m</b>`, X0, -T / 2, zx + 16);
    lab('trans', `<b style="color:var(--amber)">건현 Freeboard ${fmt(D)} m</b>`, X0, D / 2, zx + 22);
    lab('trans', `<b style="color:var(--deck)">깊이 Depth ${fmt(SH.D)} m</b>`, X0, (D - T) / 2, -zx - 16);
    lab('trans', `<b style="color:var(--info)">폭 Breadth ${fmt(SH.B)} m</b>`, X0, D + 10, 0);
    lab('trans', '<i>캠버 (모식, 크게 그림)</i>', X0, D + 2.5, 8); lab('trans', '<i>선체 중앙 단면을 선미 뒤로 옮겨 그림</i>', X0, -T - 6, 0);
    /* 길이 방향 */
    const gl = G('long'), zs = hb + 4, yl = -T - 6;
    dim(gl, V3(XA - 2.5, yl - 10, zs), V3(XF + 4, yl - 10, zs), P.muted, { dash: 3 });
    dim(gl, V3(XA, yl, zs), V3(XF, yl, zs), P.deck);
    dim(gl, V3(XA + 1.5, 0.2, zs + 2), V3(XF - 1, 0.2, zs + 2), P.info);
    lab('long', '<b style="color:var(--muted)">전장 LOA</b><i>위치만 모식</i>', 0, yl - 14, zs);
    lab('long', `<b style="color:var(--deck)">수선간장 LBP ${fmt(SH.L, 0)} m</b>`, 0, yl - 3, zs);
    lab('long', '<b style="color:var(--info)">수선장 LWL</b><i>만재흘수선 위치</i>', -70, 4, zs + 2);
    const sheer = []; for (let i = 0; i <= 40; i++) { const x = XA + (XF - XA) * i / 40, f = (x / (SH.L / 2)) ** 2; sheer.push(V3(x, D + (x > 0 ? 6 : 3) * f + 0.4, zs)); }
    gl.add(Line(sheer, P.amber, { top: true, dash: 2 }));
    lab('long', '<b style="color:var(--amber)">현호 Sheer</b><i>모식, 크게 그림</i>', XF - 30, D + 10, zs);
    const mk = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * 2 * Math.PI; mk.push(V3(5 * Math.cos(a), 5 * Math.sin(a) - 1, hw(0, T) + 0.6)); }
    gl.add(Line(mk, P.bad, { top: true })); gl.add(Line([V3(-8, 0, hw(0, T) + 0.6), V3(8, 0, hw(0, T) + 0.6)], P.bad, { top: true }));
    lab('long', '<b style="color:var(--bad)">만재흘수선 표</b>', 0, 9, zs + 4);
    this.cur = -1; ctx.ship.setOpacity(1);
  },
  apply(t) {
    let k = 0; GROUPS.forEach((g, i) => { if (t >= g.t) k = i; });
    const key = GROUPS[k].key;
    for (const [kk, g] of Object.entries(this.groups)) g.visible = kk === key;
    for (const L of this.labels) L.set(L.key === key ? L.html : '');
    if (k !== this.cur) { this.cur = k; this.ctx.ship.setOpacity(key === 'long' ? 0.75 : 1); const c = GROUPS[k].cam; this.ctx.stage.camTo({ r: c.r, th: c.th, ph: c.ph, target: key === 'trans' ? V3(XA - 32, 2, 0) : V3(0, 0, 0) }, 0.9); }
    this.k = k;
  },
  read() {
    const key = GROUPS[this.k || 0].key;
    if (key === 'dir') return [['기준', '선수 = 000°'], ['재는 방향', '시계 방향'], ['정횡', '090° / 270°'], ['정선미', '180°']];
    if (key === 'trans') return [['흘수 d', fmt(SH.T) + ' m'], ['건현', fmt(SH.D - SH.T) + ' m (D − d)'], ['깊이 D', fmt(SH.D) + ' m'], ['폭 B', fmt(SH.B) + ' m']];
    return [['수선간장 LBP', fmt(SH.L, 0) + ' m (모델 값)'], ['LOA·LWL', '대상선 자료 없음, 위치만 모식'], ['현호 표준', '선수 L/50, 선미 L/100'], ['캠버 표준', '폭로 갑판 B/50']];
  }
};
