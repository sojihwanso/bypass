/* 화살표, 점, 선, 항적 띠, 선박 윤곽 */
import { SH, XA, hullHalfWidth } from '../physics/ship.js';
const T = () => window.THREE;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const V3 = (x = 0, y = 0, z = 0) => new (T().Vector3)(x, y, z);

export function Arrow(color, rad = 0.8, o = {}) {
  const THREE = T(), g = new THREE.Group(), UP = V3(0, 1, 0);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 1, depthTest: !o.top });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 1, 10), m), head = new THREE.Mesh(new THREE.ConeGeometry(rad * 2.6, 1, 16), m);
  g.add(shaft, head); g.mat = m; if (o.top) { g.renderOrder = shaft.renderOrder = head.renderOrder = 6; }
  g.set = (from, dir, len) => {
    if (!(len > 0.05)) { g.visible = false; return g; } g.visible = true;
    const hl = Math.min(len * 0.4, rad * 7); shaft.scale.set(1, Math.max(0.01, len - hl), 1); shaft.position.y = (len - hl) / 2;
    head.scale.set(1, hl, 1); head.position.y = len - hl / 2; g.position.copy(from);
    const d = dir.clone().normalize(); if (d.y < -0.9999) g.quaternion.set(1, 0, 0, 0); else g.quaternion.setFromUnitVectors(UP, d);
    return g;
  };
  g.visible = false; return g;
}
export function Dot(color, r = 1.6, top = true) { const THREE = T(); const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), new THREE.MeshBasicMaterial({ color, depthTest: !top, transparent: true })); m.renderOrder = 7; return m; }
export function Line(pts, color, o = {}) {
  const THREE = T(), g = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = o.dash ? new THREE.LineDashedMaterial({ color, dashSize: o.dash, gapSize: o.gap || o.dash * 0.7, transparent: true, opacity: o.opacity ?? 1, depthTest: !o.top })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 1, depthTest: !o.top });
  const l = new THREE.Line(g, mat); if (o.dash) l.computeLineDistances(); l.renderOrder = o.top ? 6 : 4; l.frustumCulled = false; return l;
}
export function setLine(l, pts) { l.geometry.setFromPoints(pts); if (l.material.isLineDashedMaterial) l.computeLineDistances(); l.geometry.computeBoundingSphere(); }
export function Ribbon(pts, width, color, y = 0.6, opacity = 0.95) {
  const THREE = T(), pos = [], n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * width / 2, nz = dx / l * width / 2;
    pos.push(x0 + nx, y, z0 + nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz, x0 + nx, y, z0 + nz, x1 - nx, y, z1 - nz, x0 - nx, y, z0 - nz);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
  m.renderOrder = 4; m.frustumCulled = false; m.setCount = k => g.setDrawRange(0, clamp(Math.floor(k), 0, n - 1) * 6); m.setCount(n); return m;
}
let FOOT = null;
export function footprint() {
  if (FOOT) return FOOT;
  const pts = []; for (let i = 0; i <= 28; i++) { const x = XA + SH.L * i / 28; pts.push([x, hullHalfWidth(x, SH.D)]); }
  const out = pts.map(p => V3(p[0], 0, p[1])); for (let i = pts.length - 1; i >= 0; i--) out.push(V3(pts[i][0], 0, -pts[i][1])); out.push(out[0].clone());
  return (FOOT = out);
}
export function Ghost(X, Z, psi, color, opacity = 0.45) { const l = Line(footprint(), color, { opacity }); l.position.set(X, 0.8, Z); l.rotation.y = -psi; return l; }
export function arcPts(cx, cz, r, a0, a1, y = 0.7, n = 40) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push(V3(cx + r * Math.cos(a), y, cz + r * Math.sin(a))); } return p; }
/* 3D 위 글자판(항상 카메라를 보는 스프라이트) */
export function TextSprite(text, { color = '#fff', bg = 'rgba(0,0,0,.55)', size = 28, scale = 1 } = {}) {
  const THREE = T(), c = document.createElement('canvas'), g = c.getContext('2d'); g.font = `700 ${size}px Pretendard, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 24, h = size + 18; c.width = w; c.height = h;
  g.font = `700 ${size}px Pretendard, sans-serif`; g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 12, h / 2);
  const tex = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false })); s.scale.set(w / h * 6 * scale, 6 * scale, 1); s.renderOrder = 8; return s;
}
