/* 현수선: H 수평장력(N), w 물속 체인 무게(N/m), h 해저→호스파이프 높이(m), Lc 내준 체인 길이(m) */
export function catenary(H, w, h, Lc) {
  const a = H / w, s = Math.sqrt(h * h + 2 * h * a);
  if (s <= Lc) return { a, lay: Lc - s, xh: Lc - s + a * Math.asinh(s / a), lift: 0, x0: 0, dx: a * Math.asinh(s / a) };
  const dx = 2 * a * Math.asinh(Math.sqrt(Math.max(0, Lc * Lc - h * h)) / (2 * a));
  const xm = a * Math.atanh(Math.min(0.999, h / Lc)), x0 = xm - dx / 2;
  return { a, lay: 0, xh: dx, lift: Math.atan(Math.sinh(x0 / a)), x0, dx };
}
/* 파주력 = 앵커 무게×2.0 + 해저에 누운 체인 무게×0.7 (강의 S14) */
export function holdingPower(lay, anchorWeightN, chainWeightPerM) { return 2.0 * anchorWeightN + 0.7 * lay * chainWeightPerM; }
export function isDragging(H, hold, lift) { return H > hold || lift > 0.02; }
