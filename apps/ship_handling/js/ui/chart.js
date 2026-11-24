/* 작은 선 그래프. series마다 범위(min,max)를 따로 가질 수 있다(두 번째 축은 axis:true). */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export function chartBegin(cv) {
  const g = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  g.font = '12px ' + getComputedStyle(document.body).fontFamily; return { g, w, h };
}
export function lineChart(cv, P, o) {
  const { g, w, h } = chartBegin(cv); const L = 38, R = o.right ? 38 : 10, T = 22, B = 22, pw = w - L - R, ph = h - T - B;
  const X = x => L + (x - o.x0) / (o.x1 - o.x0) * pw;
  g.strokeStyle = P.rule; g.lineWidth = 1; g.fillStyle = P.muted; g.textAlign = 'center';
  g.beginPath(); g.moveTo(L, T + ph + 0.5); g.lineTo(L + pw, T + ph + 0.5); g.stroke();
  for (const tx of o.xt || []) { g.fillText(tx[1], clamp(X(tx[0]), L + 10, L + pw - 10), h - 6); }
  if (o.bands) for (const b of o.bands) { g.fillStyle = b[2]; g.fillRect(X(b[0]), T, X(b[1]) - X(b[0]), ph); }
  o.series.forEach((s, si) => {
    const Y = y => T + ph - (clamp(y, s.min, s.max) - s.min) / (s.max - s.min) * ph;
    if (si === 0 || s.axis) {
      g.fillStyle = s.color; g.textAlign = si === 0 ? 'right' : 'left';
      for (const yt of s.yt || []) { const yy = Y(yt); g.fillText(String(yt), si === 0 ? L - 6 : L + pw + 6, yy + 4); if (si === 0) { g.strokeStyle = P.rule; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(L, Math.round(yy) + 0.5); g.lineTo(L + pw, Math.round(yy) + 0.5); g.stroke(); g.setLineDash([]); } }
    }
    for (const hl of s.hlines || []) { g.strokeStyle = s.color; g.globalAlpha = 0.45; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(L, Y(hl)); g.lineTo(L + pw, Y(hl)); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
    g.strokeStyle = s.color; g.lineWidth = s.width || 2; if (s.dash) g.setLineDash(s.dash);
    g.beginPath(); let first = true;
    for (const [x, y] of s.data) { if (o.upto != null && x > o.upto && !s.full) break; const px = X(x), py = Y(y); if (first) { g.moveTo(px, py); first = false; } else g.lineTo(px, py); }
    g.stroke(); g.setLineDash([]);
    if (s.mark) { g.fillStyle = s.color; g.beginPath(); g.arc(X(s.mark[0]), Y(s.mark[1]), 4.5, 0, 7); g.fill(); }
  });
  if (o.cursor != null) { g.strokeStyle = P.ink; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(X(o.cursor) + 0.5, T); g.lineTo(X(o.cursor) + 0.5, T + ph); g.stroke(); g.globalAlpha = 1; }
  let lx = L; g.textAlign = 'left';
  for (const s of o.series) if (s.label) { g.fillStyle = s.color; g.fillRect(lx, 6, 12, 3); g.fillStyle = P.muted; g.fillText(s.label, lx + 16, 12); lx += g.measureText(s.label).width + 32; }
}
