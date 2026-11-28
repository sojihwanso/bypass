/* 항구 정밀 해안선(히든 시나리오): ports/*-coast.js 해독 + ECDIS 해안선과 합치기.
   형식: base64 → varint 스트림 [고리 수, (점 수, zigzag 차분 x,y …)…], 단위 1/FULLQ°, 원점 = bbox 남서 모서리(lon0, lat0).
   합치기: ECDIS 고리는 bbox 바깥 조각만 남기고(bbox 안은 정밀 데이터가 맡음) 정밀 고리를 더함. */
import { reader, FULLQ } from './coast.js';

export function decodePortCoast(pc) {
  const bin = atob(pc.data.trim()), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const d = reader(u, 0), n = d.rv(), out = [];
  for (let k = 0; k < n; k++) {
    const cnt = d.rv(), r = new Float64Array(cnt * 2); let x = 0, y = 0;
    for (let i = 0; i < cnt; i++) { x += d.zz(d.rv()); y += d.zz(d.rv()); r[i * 2] = pc.bbox.lon0 + x / FULLQ; r[i * 2 + 1] = pc.bbox.lat0 + y / FULLQ; }
    out.push(r);
  }
  return out;
}

/* 반평면 하나로 자르기(Sutherland–Hodgman). inside(x,y)·cut(ax,ay,bx,by)→[x,y] */
function clipHalf(pts, inside, cut) {
  const out = [], n = pts.length / 2; if (!n) return out;
  for (let i = 0; i < n; i++) {
    const ax = pts[((i + n - 1) % n) * 2], ay = pts[((i + n - 1) % n) * 2 + 1], bx = pts[i * 2], by = pts[i * 2 + 1], ia = inside(ax, ay), ib = inside(bx, by);
    if (ib) { if (!ia) out.push(...cut(ax, ay, bx, by)); out.push(bx, by); } else if (ia) out.push(...cut(ax, ay, bx, by));
  }
  return out;
}
const atX = (X) => (ax, ay, bx, by) => [X, ay + ((X - ax) * (by - ay)) / (bx - ax)];
const atY = (Y) => (ax, ay, bx, by) => [ax + ((Y - ay) * (bx - ax)) / (by - ay), Y];

/* 고리(lon,lat 번갈아, 닫힌 고리: 첫 점 = 끝 점)에서 bbox 바깥 부분만 조각으로. 바깥 = 겹치지 않는 볼록 띠 4개(왼쪽·오른쪽 전체, 가운데 열의 아래·위) */
export function clipOutsideRect(ring, b) {
  let open = Array.from(ring); if (open.length >= 4 && open[0] === open[open.length - 2] && open[1] === open[open.length - 1]) open = open.slice(0, -2);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < open.length; i += 2) { x0 = Math.min(x0, open[i]); x1 = Math.max(x1, open[i]); y0 = Math.min(y0, open[i + 1]); y1 = Math.max(y1, open[i + 1]); }
  if (x1 <= b.lon0 || x0 >= b.lon1 || y1 <= b.lat0 || y0 >= b.lat1) return [ring]; /* 전혀 안 걸침 */
  const L = (x) => x < b.lon0, R = (x) => x > b.lon1;
  const regions = [
    (p) => clipHalf(p, (x) => L(x), atX(b.lon0)),
    (p) => clipHalf(p, (x) => R(x), atX(b.lon1)),
    (p) => clipHalf(clipHalf(clipHalf(p, (x) => x >= b.lon0, atX(b.lon0)), (x) => x <= b.lon1, atX(b.lon1)), (x, y) => y < b.lat0, atY(b.lat0)),
    (p) => clipHalf(clipHalf(clipHalf(p, (x) => x >= b.lon0, atX(b.lon0)), (x) => x <= b.lon1, atX(b.lon1)), (x, y) => y > b.lat1, atY(b.lat1)),
  ];
  const out = [];
  for (const f of regions) { const q = f(open); if (q.length >= 6) { q.push(q[0], q[1]); out.push(Float64Array.from(q)); } }
  return out;
}

export function mergePortLand(ecdisRings, pc) {
  return [...ecdisRings.flatMap((r) => clipOutsideRect(r, pc.bbox)), ...decodePortCoast(pc)];
}
