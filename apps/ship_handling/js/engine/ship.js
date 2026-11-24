/* 6,000TEU 컨테이너선 모델. 좌표: x 선수(+), y 위(용골 0), z 우현(+). 부품은 stage.registerPart로 등록한다. */
import { SH, XA, XF, XK, hullHalfWidth as hw, keelHeight } from '../physics/ship.js';
import { PROP } from '../physics/propeller.js';
export const RUD = { x: -145.4, y0: 0.9, y1: 11.9, le: 1.6, te: 4.9, area: 70 };
export const THR = { x: 128, y: 5.5, r: 1.6 };
export const HAWSE = { x: 132, y: 21.1 };
export const COL = { anti: '#9A3A2D', boot: '#1F2427', hull: '#1E3A55', hullLine: '#E9EEF0', deck: '#3E6F52', hatch: '#4A8459', mark: '#E1B22F', house: '#EEF0EA', win: '#24343D', bronze: '#C79A42', rudder: '#C8462E', thr: '#E0A51C', funnel: '#1E3A55', band: '#E07A2C', steel: '#3A4045', chain: '#7A5440', mast: '#E1B22F', boat: '#E86A1E', rail: '#D8DDD9' };
const LEV = [0, 0.7, 1.6, 3.2, 5, 7.5, 10, 12, 13.4, 14.6, 15.4, 17.5, 19.6, 20.3, 22.5, 24.6];
function band(y) { return y < 13.4 ? COL.anti : y < 15.4 ? COL.boot : (y > 19.6 && y < 20.3) ? COL.hullLine : COL.hull; }
const M = (THREE, color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0.05, flatShading: true }, o));

function hullGeo(THREE) {
  const xs = []; for (let i = 0; i <= 110; i++) xs.push(XA + SH.L * i / 110); xs.push(XK, XK - 0.6); xs.sort((a, b) => a - b);
  const st = xs.map(x => { const yb = keelHeight(x); return LEV.map(l => { const y = Math.max(l, yb); return { x, y, w: hw(x, y) }; }); });
  const pos = [], col = [], c = new THREE.Color();
  const tri = (a, b, d, color) => { c.set(color); for (const p of [a, b, d]) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); } };
  const quad = (a, b, d, e, color) => { tri(a, b, d, color); tri(a, d, e, color); };
  const n = st.length, m = LEV.length;
  for (const s of [1, -1]) for (let i = 0; i < n - 1; i++) for (let j = 0; j < m - 1; j++) {
    const A = st[i][j], B = st[i + 1][j], C = st[i + 1][j + 1], D = st[i][j + 1]; if (A.y === D.y && B.y === C.y) continue;
    quad([A.x, A.y, s * A.w], [B.x, B.y, s * B.w], [C.x, C.y, s * C.w], [D.x, D.y, s * D.w], band((A.y + B.y + C.y + D.y) / 4));
  }
  for (let i = 0; i < n - 1; i++) {
    const A = st[i][0], B = st[i + 1][0]; quad([A.x, A.y, -A.w], [B.x, B.y, -B.w], [B.x, B.y, B.w], [A.x, A.y, A.w], COL.anti);
    const P = st[i][m - 1], Q = st[i + 1][m - 1]; quad([P.x, P.y, -P.w], [Q.x, Q.y, -Q.w], [Q.x, Q.y, Q.w], [P.x, P.y, P.w], COL.deck);
  }
  for (const i of [0, n - 1]) for (let j = 0; j < m - 1; j++) { const A = st[i][j], D = st[i][j + 1]; if (A.y === D.y) continue; quad([A.x, A.y, -A.w], [A.x, A.y, A.w], [D.x, D.y, D.w], [D.x, D.y, -D.w], band((A.y + D.y) / 2)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
/* 프로펠러 날개 하나: 반지름 방향이 +y. 피치 P의 나선면 위 얇은 판. pitchScale로 피치를 바꿀 수 있다. */
export function bladeGeo(THREE, { P = PROP.P, R = PROP.R, r0 = 0.95, skewK = 0.38 } = {}) {
  const nr = 10, nc = 8, pos = [];
  const pt = (i, k, f) => {
    const u = i / nr, rr = r0 + (R - r0) * u; let cw = 2.0 + 1.9 * Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05));
    if (u > 0.8) cw *= 0.35 + 0.65 * Math.sqrt(Math.max(0, (1 - u) / 0.2));
    const cc = (k / nc - 0.5) * cw, th = cc / rr + skewK * u * u, thick = 0.2 * (1 - 0.75 * u) * (1 - Math.pow(2 * k / nc - 1, 2));
    return [P * (cc / rr) / (2 * Math.PI) + f * thick * 0.5, rr * Math.cos(th), rr * Math.sin(th)];
  };
  for (const f of [1, -1]) for (let i = 0; i < nr; i++) for (let k = 0; k < nc; k++) { const a = pt(i, k, f), b = pt(i + 1, k, f), c = pt(i + 1, k + 1, f), d = pt(i, k + 1, f); pos.push(...a, ...b, ...c, ...a, ...c, ...d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
/* 프로펠러: 축은 x. blades[i]는 날개 축(반지름 방향)으로 돌릴 수 있는 피벗 → 가변피치 표현 */
export function makePropeller(THREE, { n = 5, P = PROP.P, R = PROP.R, color = COL.bronze } = {}) {
  const g = new THREE.Group(), mat = M(THREE, color, { metalness: 0.65, roughness: 0.32, flatShading: false, side: THREE.DoubleSide });
  const bg = bladeGeo(THREE, { P, R }); g.blades = [];
  for (let b = 0; b < n; b++) { const arm = new THREE.Group(); arm.rotation.x = b * 2 * Math.PI / n; const piv = new THREE.Group(); piv.add(new THREE.Mesh(bg, mat)); arm.add(piv); g.add(arm); g.blades.push(piv); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.75, 2.6, 18), mat); hub.rotation.z = Math.PI / 2; g.add(hub);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.4, 18), mat); cap.rotation.z = Math.PI / 2; cap.position.x = -2.0; g.add(cap);
  g.mat = mat; return g;
}
export function rudderGeo(THREE) {
  const c = RUD.le + RUD.te, sh = new THREE.Shape(), N = 20, pts = [];
  for (let i = 0; i <= N; i++) { const xx = (1 - Math.cos(Math.PI * i / N)) / 2; const yt = 5 * 0.18 * c * (0.2969 * Math.sqrt(xx) - 0.126 * xx - 0.3516 * xx * xx + 0.2843 * xx ** 3 - 0.1015 * xx ** 4); pts.push([RUD.le - xx * c, yt]); }
  sh.moveTo(pts[0][0], 0); for (const p of pts) sh.lineTo(p[0], p[1]); for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(pts[i][0], -pts[i][1]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: RUD.y1 - RUD.y0, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, RUD.y0, 0); return g;
}
export function makeAnchor(THREE, mat) {
  const g = new THREE.Group();
  const shank = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.6, 0.6), mat); shank.position.y = 2.3; g.add(shank);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 2.8), mat); crown.position.y = 0.3; g.add(crown);
  for (const s of [1, -1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.6, 4), mat); f.position.set(0, 1.3, s * 1.4); f.rotation.x = s * 0.25; g.add(f); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.13, 6, 12), mat); ring.position.y = 4.8; g.add(ring); return g;
}

export function createShip(stage) {
  const THREE = stage.THREE;
  const yaw = new THREE.Group(), root = new THREE.Group(), model = new THREE.Group(); yaw.add(root); root.add(model); stage.scene.add(yaw);
  const S = { yaw, root, model, KG: 16.25 };
  const hullMat = M(THREE, '#ffffff', { vertexColors: true, side: THREE.DoubleSide, roughness: 0.66 });
  const geo = hullGeo(THREE), hull = new THREE.Mesh(geo, hullMat); model.add(hull);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 24), new THREE.LineBasicMaterial({ color: '#0B1820', transparent: true, opacity: 0.22 })); model.add(edge);
  const bulbMat = M(THREE, COL.anti); const bulb = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14), bulbMat); bulb.scale.set(15, 5.2, 4.6); bulb.position.set(XF - 9, 5.6, 0); model.add(bulb);
  S.hullMats = [hullMat, bulbMat]; S.edgeMat = edge.material;
  stage.registerPart(hull, 'hull'); stage.registerPart(bulb, 'hull');
  /* 난간 */
  const railM = new THREE.LineBasicMaterial({ color: COL.rail, transparent: true, opacity: 0.7 });
  for (const s of [1, -1]) { const p = []; for (let i = 0; i <= 60; i++) { const x = XA + 2 + (SH.L - 4) * i / 60; p.push(new THREE.Vector3(x, SH.D + 1.1, s * (hw(x, SH.D) - 0.2))); } model.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), railM)); }
  /* 화물창 덮개, 컨테이너, 래싱 브리지 */
  const deckGrp = new THREE.Group(); model.add(deckGrp); S.deckGrp = deckGrp;
  const bays = []; for (let x = -91.2; x + 6.1 < 118; x += 13.6) bays.push({ x, tiers: x > 85 ? 5 : 6 }); bays.push({ x: -140.2, tiers: 4 });
  const cPal = ['#B5523A', '#2F6C9A', '#3F8A5E', '#C99A3A', '#8C9399', '#245C7A', '#C4C9C2', '#1F5F66', '#A8432F', '#6B7F3A', '#D8D4C8'];
  let cnt = 0; for (const b of bays) { const hwm = Math.min(hw(b.x - 6.2, SH.D), hw(b.x + 6.2, SH.D)) - 0.9; b.rows = Math.min(17, Math.floor(2 * hwm / 2.5)); cnt += b.rows * b.tiers; }
  const cMat = M(THREE, '#ffffff', { roughness: 0.82 }); const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(12.19, 2.59, 2.44), cMat, cnt);
  const mtx = new THREE.Matrix4(), cc = new THREE.Color(); let k = 0, seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hatchM = M(THREE, COL.hatch), markM = M(THREE, COL.mark), lashM = M(THREE, COL.mark, { metalness: 0.2 });
  for (const b of bays) {
    const w = b.rows * 2.5;
    const hc = new THREE.Mesh(new THREE.BoxGeometry(12.8, 1.4, w + 0.8), hatchM); hc.position.set(b.x, SH.D + 0.7, 0); deckGrp.add(hc);
    for (const dz of [-w / 2 - 0.42, w / 2 + 0.42]) { const st = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.25, 0.12), markM); st.position.set(b.x, SH.D + 1.1, dz); deckGrp.add(st); }
    if (b.x > -100) { const lb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.6, w + 0.4), lashM); lb.position.set(b.x + 6.75, SH.D + 1.4 + 2.8, 0); deckGrp.add(lb); }
    for (let r = 0; r < b.rows; r++) for (let t = 0; t < b.tiers; t++) { mtx.makeTranslation(b.x, SH.D + 1.4 + 1.3 + t * 2.62, (r - (b.rows - 1) / 2) * 2.5); inst.setMatrixAt(k, mtx); cc.set(cPal[Math.floor(rnd() * cPal.length)]); cc.offsetHSL(0, 0, (rnd() - 0.5) * 0.06); inst.setColorAt(k, cc); k++; }
    const h = b.tiers * 2.62; const eg = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(12.2, h, w)), new THREE.LineBasicMaterial({ color: '#10181D', transparent: true, opacity: 0.14 })); eg.position.set(b.x, SH.D + 1.4 + h / 2, 0); deckGrp.add(eg);
  }
  inst.instanceMatrix.needsUpdate = true; deckGrp.add(inst); S.cMat = cMat;
  /* 거주구와 선교 */
  const hm = M(THREE, COL.house), wm = M(THREE, COL.win, { roughness: 0.25, metalness: 0.35 }); const house = new THREE.Group(); model.add(house);
  for (let t = 0; t < 7; t++) {
    const top = t === 6, wd = top ? 41.8 : 26 - t * 0.6, lx = top ? 9 : 16 - (t > 4 ? 1 : 0), cx = -108 + (top ? 2.5 : 0);
    const b = new THREE.Mesh(new THREE.BoxGeometry(lx, 2.9, wd), hm); b.position.set(cx, SH.D + 1.45 + t * 2.9, 0); house.add(b);
    if (t >= 1) { const wb = new THREE.Mesh(new THREE.BoxGeometry(0.2, top ? 1.4 : 1.0, wd * 0.9), wm); wb.position.set(cx + lx / 2 + 0.05, SH.D + 1.65 + t * 2.9, 0); house.add(wb); for (const s of [1, -1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(lx * 0.8, 1.0, 0.2), wm); sw.position.set(cx, SH.D + 1.65 + t * 2.9, s * (wd / 2 + 0.05)); house.add(sw); } }
  }
  const roofY = SH.D + 7 * 2.9;
  /* 구명정 */
  for (const s of [1, -1]) { const bt = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 8, 12), M(THREE, COL.boat)); bt.rotation.z = Math.PI / 2; bt.position.set(-112, SH.D + 9, s * 14.2); house.add(bt); }
  const mastM = M(THREE, COL.mast); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 8, 8), mastM); mast.position.set(-106, roofY + 4, 0); house.add(mast);
  const plat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 9), mastM); plat.position.set(-106, roofY + 5.4, 0); house.add(plat);
  const radars = [];
  for (const [z, L] of [[-3, 6.6], [3, 4.2]]) { const g = new THREE.Group(); g.position.set(-106, roofY + 6.1, z); const bar = new THREE.Mesh(new THREE.BoxGeometry(L, 0.45, 0.6), M(THREE, '#F4F4F0')); bar.position.y = 0.5; g.add(bar); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 8), M(THREE, '#4A555C'))); house.add(g); radars.push(g); stage.registerPart(g, 'radar'); }
  S.radars = radars; S.house = house;
  /* 굴뚝 */
  const funnel = new THREE.Group(); model.add(funnel);
  const fg = new THREE.BoxGeometry(10, 16, 8), fp = fg.attributes.position; for (let i = 0; i < fp.count; i++) if (fp.getY(i) > 0) { fp.setX(i, fp.getX(i) * 0.86 - 1.2); fp.setZ(i, fp.getZ(i) * 0.9); } fg.computeVertexNormals();
  const fb = new THREE.Mesh(fg, M(THREE, COL.funnel)); fb.position.set(-126, SH.D + 8, 0); funnel.add(fb);
  const bd = new THREE.Mesh(new THREE.BoxGeometry(9.0, 2.6, 7.5), M(THREE, COL.band)); bd.position.set(-127, SH.D + 12.2, 0); funnel.add(bd);
  const tp = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.2, 7.1), M(THREE, '#15191C')); tp.position.set(-127.3, SH.D + 15.4, 0); funnel.add(tp);
  for (const z of [-1.6, 1.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3, 10), M(THREE, '#555D62')); p.position.set(-127, SH.D + 17, z); funnel.add(p); }
  stage.registerPart(funnel, 'engine'); S.funnel = funnel;
  /* 선수루: 방파벽, 양묘기, 앞 마스트, 앵커 */
  const bwM = M(THREE, COL.house); const bw = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 2 * hw(122, SH.D) - 2), bwM); bw.position.set(122, SH.D + 2, 0); model.add(bw);
  const windl = new THREE.Group(); model.add(windl); const wlM = M(THREE, '#3E5E4C');
  for (const z of [-5, 5]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 16), wlM); d.rotation.x = Math.PI / 2; d.position.set(136, SH.D + 1.3, z); windl.add(d); }
  const fm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 12, 8), mastM); fm.position.set(144, SH.D + 6, 0); model.add(fm);
  const ancMat = M(THREE, COL.steel, { metalness: 0.3 }); S.anchors = [];
  for (const s of [1, -1]) { const a = makeAnchor(THREE, ancMat); a.position.set(HAWSE.x, HAWSE.y - 5.2, s * (hw(HAWSE.x, HAWSE.y - 3) + 0.6)); a.rotation.x = s * 0.12; model.add(a); S.anchors.push(a); stage.registerPart(a, 'anchor'); }
  stage.registerPart(windl, 'anchor');
  /* 선수 쓰러스터 */
  const thr = new THREE.Group(); model.add(thr); const thrM = M(THREE, COL.thr, { flatShading: false });
  /* 터널 양쪽 입구에 짧은 덕트를 두고 그 안에 4날 프로펠러를 보이게 놓는다(실제로는 터널 가운데 한 개. 밖에서 보이도록 입구 쪽에 그린 모식) */
  const ductM = M(THREE, COL.thr, { flatShading: false, side: THREE.DoubleSide }), holeM = M(THREE, '#1C2428', { side: THREE.DoubleSide }); S.thrProps = [];
  for (const s of [1, -1]) {
    const zz = hw(THR.x, THR.y) + 0.05;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(THR.r + 0.15, 28), holeM); hole.position.set(THR.x, THR.y, s * (zz + 0.02)); thr.add(hole);
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(THR.r + 0.2, THR.r + 0.2, 1.5, 28, 1, true), ductM); duct.rotation.x = Math.PI / 2; duct.position.set(THR.x, THR.y, s * (zz + 0.75)); thr.add(duct);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(THR.r + 0.2, 0.22, 8, 28), thrM); lip.position.set(THR.x, THR.y, s * (zz + 1.5)); thr.add(lip);
    const w = new THREE.Group(); w.position.set(THR.x, THR.y, s * (zz + 0.8)); w.rotation.y = -Math.PI / 2;
    const pr = makePropeller(THREE, { n: 4 }); pr.scale.setScalar((THR.r + 0.08) / PROP.R); w.add(pr); thr.add(w); S.thrProps.push(pr);
  }
  /* a: 쓰러스터 축 회전각(rad). 양쪽 그림은 같은 축이라 같은 각도로 돈다 */
  S.setThr = a => { for (const pr of S.thrProps) pr.rotation.x = a; };
  stage.registerPart(thr, 'thruster');
  /* 프로펠러, 보스, 타 */
  const prop = makePropeller(THREE); prop.position.set(PROP.x, PROP.y, 0); model.add(prop); stage.registerPart(prop, 'propeller'); S.prop = prop;
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 2.0, 3.6, 16), M(THREE, COL.anti)); boss.rotation.z = Math.PI / 2; boss.position.set(-138.9, PROP.y, 0); model.add(boss);
  const rp = new THREE.Group(); rp.position.set(RUD.x, 0, 0); model.add(rp);
  const rm = new THREE.Mesh(rudderGeo(THREE), M(THREE, COL.rudder)); rp.add(rm);
  rp.add(new THREE.LineSegments(new THREE.EdgesGeometry(rm.geometry, 30), new THREE.LineBasicMaterial({ color: '#5A1C12', transparent: true, opacity: 0.5 })));
  const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.4, 10), M(THREE, '#555')); stock.position.y = RUD.y1 + 1.1; rp.add(stock);
  stage.registerPart(rp, 'rudder'); S.rudder = rp;

  S.setKG = kg => { S.KG = kg; model.position.y = -kg; };
  S.setOpacity = a => { for (const m of S.hullMats) { m.transparent = a < 1; m.opacity = a; m.depthWrite = a >= 1; m.needsUpdate = true; } cMat.transparent = a < 1; cMat.opacity = Math.min(1, a + 0.15); cMat.depthWrite = a >= 1; cMat.needsUpdate = true; S.edgeMat.opacity = a < 1 ? 0.35 : 0.22; };
  S.pose = (X = 0, Z = 0, psi = 0, phi = 0, theta = 0, heave = 0) => { yaw.position.set(X, 0, Z); yaw.rotation.y = -psi; root.rotation.set(phi, 0, theta); root.position.y = S.KG - SH.T + heave; };
  /* 선체 윤곽 모드: 선체·갑판·상부 구조를 거의 투명하게 하고 단면선과 선체 길이 방향 선만 남긴다.
     타·프로펠러·보스·쓰러스터·앵커는 그대로 보여 확대해도 가려지지 않는다. */
  let outlineObj = null, saved = null;
  const keep = new Set([prop, rp, boss, thr, windl, ...S.anchors]);
  /* 윤곽선 색: 단면선(늑골 위치)은 회색, 갑판선은 초록, 만재흘수선은 파랑, 용골선은 주황, 선수·선미 끝선은 빨강 */
  const OCOL = { st: 'muted', deck: 'deck', wl: 'info', keel: 'amber', end: 'bad' };
  function buildOutline() {
    const pos = [], col = [], P = stage.palette || {}, c = new THREE.Color(), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const push = (a, b, key) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z); c.set(P[OCOL[key]] || '#EAF1F4'); col.push(c.r, c.g, c.b, c.r, c.g, c.b); };
    const ys = []; for (let i = 0; i <= 14; i++) ys.push(SH.D * i / 14);
    const stations = []; for (let x = XA + 2; x <= XF - 1; x += 15) stations.push(x);
    stations.forEach((x, n) => { const key = n === 0 || n === stations.length - 1 ? 'end' : 'st'; for (const s of [1, -1]) { let prev = null; for (const y of ys) { const w = hw(x, y); if (w <= 0.05) { prev = null; continue; } const p = V(x, y, s * w); if (prev) push(prev, p, key); prev = p; } } const wd = hw(x, SH.D); if (wd > 0.05) push(V(x, SH.D, wd), V(x, SH.D, -wd), key); });
    /* 길이 방향 선은 WebGL 선 굵기가 1px로 고정이라 조금씩 띄운 세 겹으로 그려 굵고 진하게 보이게 한다 */
    for (const [y0, key] of [[0.6, 'keel'], [SH.T, 'wl'], [SH.D, 'deck']]) for (const dy of [-0.35, 0, 0.35]) for (const s of [1, -1]) { const y = y0 + dy; let prev = null; for (let i = 0; i <= 120; i++) { const x = XA + (XF - XA) * i / 120, w = hw(x, y); if (w <= 0.05) { prev = null; continue; } const p = V(x, y, s * w); if (prev) push(prev, p, key); prev = p; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const o = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    o.renderOrder = 4; return o;
  }
  S.setOutline = on => {
    if (on) {
      if (!saved) { saved = new Map(); model.traverse(o => { if (o === outlineObj) return; for (let p = o; p && p !== model; p = p.parent) if (keep.has(p)) return; const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (!saved.has(m)) saved.set(m, { t: m.transparent, o: m.opacity, d: m.depthWrite }); }); }
      for (const m of saved.keys()) { m.transparent = true; m.opacity = m.isLineBasicMaterial ? 0.08 : 0.06; m.depthWrite = false; m.needsUpdate = true; }
      if (outlineObj) { model.remove(outlineObj); outlineObj.geometry.dispose(); }
      outlineObj = buildOutline(); model.add(outlineObj);
    } else {
      if (saved) { for (const [m, v] of saved) { m.transparent = v.t; m.opacity = v.o; m.depthWrite = v.d; m.needsUpdate = true; } saved = null; }
      if (outlineObj) outlineObj.visible = false;
    }
  };
  S.reset = () => { S.setThr(0); S.setOutline(false); S.setKG(16.25); S.setOpacity(1); S.anchors.forEach(a => a.visible = true); rp.rotation.y = 0; yaw.visible = true; model.visible = true; deckGrp.visible = true; S.pose(); };
  S.reset();
  return S;
}

export function makeTug(stage) {
  const THREE = stage.THREE, g = new THREE.Group();
  const plan = new THREE.Shape(); plan.moveTo(-15, -5.6); plan.lineTo(9, -5.8); plan.quadraticCurveTo(16, -5, 17, 0); plan.quadraticCurveTo(16, 5, 9, 5.8); plan.lineTo(-15, 5.6); plan.lineTo(-15, -5.6);
  const hg = new THREE.ExtrudeGeometry(plan, { depth: 7.5, bevelEnabled: false }); hg.rotateX(-Math.PI / 2); hg.translate(0, -5, 0); g.add(new THREE.Mesh(hg, M(THREE, '#A23A2C')));
  const fg = new THREE.ExtrudeGeometry(plan, { depth: 1.3, bevelEnabled: false }); fg.rotateX(-Math.PI / 2); fg.scale(1.06, 1, 1.1); fg.translate(0, 1.0, 0); g.add(new THREE.Mesh(fg, M(THREE, '#1E1F21')));
  const dk = new THREE.Mesh(new THREE.BoxGeometry(31, 0.3, 11), M(THREE, '#5D6E63')); dk.position.set(0.5, 2.6, 0); g.add(dk);
  const h1 = new THREE.Mesh(new THREE.BoxGeometry(11, 3, 8), M(THREE, COL.house)); h1.position.set(2, 4.2, 0); g.add(h1);
  const h2 = new THREE.Mesh(new THREE.BoxGeometry(7, 2.6, 9), M(THREE, COL.house)); h2.position.set(3, 7, 0); g.add(h2);
  const w = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.9, 9.2), M(THREE, COL.win)); w.position.set(3, 7.3, 0); g.add(w);
  const fu = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3, 3.4), M(THREE, COL.thr)); fu.position.set(-3.2, 7, 0); g.add(fu);
  const pods = [];
  for (const z of [-3.2, 3.2]) { const p = new THREE.Group(); p.position.set(-11, -6.4, z); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.6, 8), M(THREE, '#4A4F52')); s.position.y = 1.5; p.add(s); const noz = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.28, 8, 18), M(THREE, '#4A4F52')); noz.rotation.y = Math.PI / 2; p.add(noz); const pr = new THREE.Group(); for (let b = 0; b < 4; b++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 0.5), M(THREE, COL.bronze, { metalness: 0.6 })); bl.position.y = 0.55; bl.rotation.y = 0.5; const ww = new THREE.Group(); ww.rotation.x = b * Math.PI / 2; ww.add(bl); pr.add(ww); } p.add(pr); g.add(p); pods.push(pr); }
  g.userData.pods = pods; stage.registerPart(g, 'tug'); g.visible = false; stage.scene.add(g); return g;
}
