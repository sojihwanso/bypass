import { SH, hullHalfWidth, XA, XF, keelHeight } from './ship.js';
/* 선체 중앙 단면 [z(우현+), y(용골 기준)] */
export function sectionPoly() {
  const ys = []; for (let y = 0; y < SH.D; y += 0.8) ys.push(y); ys.push(SH.D);
  const pts = ys.map(y => [hullHalfWidth(0, y), y]);
  for (let i = ys.length - 1; i >= 0; i--) pts.push([-hullHalfWidth(0, ys[i]), ys[i]]);
  return pts;
}
export const SEC = sectionPoly();
export function clipBelow(poly) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], ain = a[1] <= 0, bin = b[1] <= 0;
    if (ain) out.push(a);
    if (ain !== bin) { const t = a[1] / (a[1] - b[1]); out.push([a[0] + (b[0] - a[0]) * t, 0]); }
  }
  return out;
}
export function polyAC(p) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], c = a[0] * b[1] - b[0] * a[1]; A += c; cx += (a[0] + b[0]) * c; cy += (a[1] + b[1]) * c; }
  A /= 2; return A ? { A: Math.abs(A), z: cx / (6 * A), y: cy / (6 * A) } : { A: 0, z: 0, y: 0 };
}
/* 경사 φ, 무게중심 KG, 상하 이동 hv일 때 단면의 월드 좌표 (G를 중심으로 회전) */
export function sectionWorld(phi, KG, hv) {
  const s = Math.sin(phi), c = Math.cos(phi), Gy = KG - SH.T + hv;
  return SEC.map(([z, y]) => [(y - KG) * s + z * c, Gy + (y - KG) * c - z * s]);
}
export const SEC0 = (() => {
  const ac = polyAC(clipBelow(SEC.map(([z, y]) => [z, y - SH.T])));
  const bwl = 2 * hullHalfWidth(0, SH.T), BM = bwl ** 3 / 12 / ac.A;
  return { A: ac.A, KB: ac.y + SH.T, BM, KM: ac.y + SH.T + BM };
})();
/* 잠긴 넓이를 일정하게 맞춘 평형 상태 */
export function equilibrium(phi, KG) {
  let lo = -12, hi = 12;
  for (let it = 0; it < 28; it++) { const m = (lo + hi) / 2; const a = polyAC(clipBelow(sectionWorld(phi, KG, m))).A; if (a > SEC0.A) lo = m; else hi = m; }
  const hv = (lo + hi) / 2, poly = clipBelow(sectionWorld(phi, KG, hv)), ac = polyAC(poly);
  return { hv, poly, Bz: ac.z, By: ac.y, GZ: ac.z };
}
/* 수선면 기준 관성 모멘트와 배수 용적 */
export function waterplane() {
  const n = 600, dx = SH.L / n; let A = 0, Mx = 0, IT = 0;
  const xs = [];
  for (let i = 0; i < n; i++) { const x = XA + (i + 0.5) * dx; const yb = keelHeight(x); const w = yb < SH.T ? hullHalfWidth(x, SH.T) : 0; xs.push([x, w]); A += 2 * w * dx; Mx += 2 * w * x * dx; IT += (2 * w) ** 3 / 12 * dx; }
  const lcf = Mx / A; let IL = 0; for (const [x, w] of xs) IL += 2 * w * (x - lcf) ** 2 * dx;
  const V = SH.L * SH.B * SH.T * SH.Cb;
  return { A, lcf, IT, IL, V };
}
export function bmLong() { const w = waterplane(); return w.IL / w.V; }
export function bmTrans() { const w = waterplane(); return w.IT / w.V; }
void XF;
