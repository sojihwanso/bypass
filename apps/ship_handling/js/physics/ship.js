/* 기준선: 6,000TEU 컨테이너선 (교재 Volume 4 시험선 자료) */
export const SH = { L: 301, B: 42.8, D: 24.6, T: 14.0, Cb: 0.63, disp: 116500 };
export const DEG = Math.PI / 180, KN = 0.514444, G9 = 9.81;
export const XA = -150.5, XF = 150.5, XK = -137;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
/* 선체 반폭(용골에서 높이 y, 길이 위치 x) */
export function hullHalfWidth(x, y) {
  const yf = clamp(y / SH.D, 0, 1);
  const s = (x - XA) / SH.L + (1 - yf) * 0.028;
  let bot = 1, dek = 1, g = 1;
  if (s > 0.62) { const t = clamp((s - 0.62) / 0.38, 0, 1), c = Math.cos(t * Math.PI / 2); bot = Math.pow(c, 1.7); dek = Math.pow(c, 0.55); g = Math.pow(yf, 0.85); }
  else if (s < 0.24) { const t = clamp((0.24 - s) / 0.24, 0, 1); bot = Math.pow(1 - t, 1.8); dek = 1 - 0.32 * t * t; g = Math.pow(yf, 0.5); }
  let h = SH.B / 2 * (bot + (dek - bot) * g);
  const r = 3.2; if (y < r && h > r) h = h - r + Math.sqrt(Math.max(0, r * r - (r - y) * (r - y)));
  return Math.max(0.12, h);
}
export function keelHeight(x) { return x < XK - 0.01 ? 12 : (x > XF - 10 ? (x - (XF - 10)) * 0.9 : 0); }
