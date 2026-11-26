/* 기하 계산: 국지 평면(NM), 진방위, CPA/TCPA, 선수 횡단 */
export const NM_M = 1852;
export const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const wrap360 = (d) => ((d % 360) + 360) % 360;
export const angDiff = (a, b) => { const d = wrap360(a - b); return d > 180 ? d - 360 : d; };
const mercM = (lat) => Math.log(Math.tan(Math.PI / 4 + Math.max(-89, Math.min(89, lat)) * D2R / 2));
/* ECDIS 앱과 같은 메르카토르 국지 투영: x 동(+), y 북(+), 단위 NM */
export function makeProj(lat0, lon0) {
  const c0 = Math.cos(lat0 * D2R), M0 = mercM(lat0), K = 60 * R2D * c0;
  return {
    lat0, lon0,
    x: (lon) => (lon - lon0) * 60 * c0,
    y: (lat) => (mercM(lat) - M0) * K,
    lon: (x) => lon0 + x / (60 * c0),
    lat: (y) => (2 * Math.atan(Math.exp(y / K + M0)) - Math.PI / 2) * R2D,
  };
}
export function brgRng(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return { brg: wrap360(Math.atan2(dx, dy) * R2D), rng: Math.hypot(dx, dy) };
}
/* 침로·속력(kn) → 속도 성분(kn) */
export const velXY = (course, kn) => ({ vx: kn * Math.sin(course * D2R), vy: kn * Math.cos(course * D2R) });
/* p:{x,y} NM, v:{vx,vy} kn → cpa NM, tcpa 분 */
export function cpaTcpa(p1, v1, p2, v2) {
  const rx = p2.x - p1.x, ry = p2.y - p1.y, vx = v2.vx - v1.vx, vy = v2.vy - v1.vy;
  const vv = vx * vx + vy * vy;
  if (vv < 1e-12) return { cpa: Math.hypot(rx, ry), tcpa: 0 };
  const th = -(rx * vx + ry * vy) / vv; // 시간(h)
  return { cpa: Math.hypot(rx + vx * th, ry + vy * th), tcpa: th * 60 };
}
/* 선수 횡단 거리·시간: 물표가 자선 침로선(진행 방향)을 지날 때 그 지점까지 자선의 거리 */
export function bcrBct(own, tgt) {
  const sp = Math.hypot(own.vx, own.vy);
  if (sp < 1e-9) return { bcr: null, bct: null };
  const ux = own.vx / sp, uy = own.vy / sp;
  // 자선 기준 좌표: a = 앞쪽 성분, c = 옆 성분
  const rx = tgt.x - own.x, ry = tgt.y - own.y, vx = tgt.vx - own.vx, vy = tgt.vy - own.vy;
  const c0 = rx * uy - ry * ux, cv = vx * uy - vy * ux; // 옆 거리와 그 변화율(상대)
  if (Math.abs(cv) < 1e-12) return { bcr: null, bct: null };
  const th = -c0 / cv;
  if (th < 0) return { bcr: null, bct: null };
  const a = (rx + vx * th) * ux + (ry + vy * th) * uy; // 그때 자선 앞쪽 거리
  if (a < 0) return { bcr: null, bct: null };
  return { bcr: a, bct: th * 60 };
}
