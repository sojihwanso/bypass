/* 시작 해역과 무작위 배치: 자선 기준 상대 기하를 통째로 돌려 다른 해역으로 옮김(순수 계산) */
import { makeProj, wrap360 } from './geo.js';
import { pointInLand } from './coast.js';

export const REGIONS = [
  { id: 'busan', ko: '부산 앞바다', en: 'Off Busan', box: { lat0: 34.85, lat1: 35.0, lon0: 128.95, lon1: 129.3 }, nearLand: true },
  { id: 'tongyeong', ko: '통영 남쪽', en: 'South of Tongyeong', box: { lat0: 34.45, lat1: 34.62, lon0: 128.3, lon1: 128.7 }, nearLand: true },
  { id: 'yeosu', ko: '여수 앞바다', en: 'Off Yeosu', box: { lat0: 34.3, lat1: 34.5, lon0: 127.6, lon1: 128.0 }, nearLand: true },
  { id: 'mokpo', ko: '목포·진도 바깥', en: 'Off Mokpo/Jindo', box: { lat0: 34.25, lat1: 34.6, lon0: 125.6, lon1: 125.9 }, nearLand: true },
  { id: 'jejuN', ko: '제주 북쪽', en: 'North of Jeju', box: { lat0: 33.65, lat1: 33.9, lon0: 126.2, lon1: 126.8 }, nearLand: true },
  { id: 'jejuW', ko: '제주 서쪽', en: 'West of Jeju', box: { lat0: 33.35, lat1: 33.55, lon0: 124.4, lon1: 124.65 }, nearLand: false },
  { id: 'hongdo', ko: '홍도 동쪽', en: 'East of Hongdo', box: { lat0: 34.45, lat1: 34.6, lon0: 125.25, lon1: 125.4 }, nearLand: true },
  { id: 'incheon', ko: '인천 바깥', en: 'Off Incheon', box: { lat0: 37.0, lat1: 37.3, lon0: 125.8, lon1: 126.2 }, nearLand: true },
  { id: 'ulsan', ko: '울산·포항 앞', en: 'Off Ulsan/Pohang', box: { lat0: 35.3, lat1: 35.6, lon0: 129.5, lon1: 129.8 }, nearLand: true },
];

export function rotatePlace(def, { lat, lon, dHdg }) {
  const P0 = makeProj(def.own.lat, def.own.lon), P1 = makeProj(lat, lon), a = dHdg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const mv = (o) => { const x = P0.x(o.lon), y = P0.y(o.lat); return { ...o, lat: P1.lat(-x * s + y * c), lon: P1.lon(x * c + y * s) }; };
  const turn = (h) => wrap360(h + dHdg);
  return {
    ...def, own: { ...def.own, lat, lon, hdg: turn(def.own.hdg) },
    targets: def.targets.map((g) => ({ ...mv(g), hdg: turn(g.hdg), legs: (g.legs || []).map((l) => (l.hdg === undefined ? { ...l } : { ...l, hdg: turn(l.hdg) })) })),
    weather: def.weather ? { ...def.weather, rain: (def.weather.rain || []).map(mv), windFrom: turn(def.weather.windFrom || 0) } : def.weather,
    aids: (def.aids || []).map(mv), marks: (def.marks || []).map(mv),
  };
}

const D = Math.PI / 180;
/* 점 둘레 r NM(8방향)과 점 자체가 바다인지 */
function clear(rings, P, x, y, r) {
  if (pointInLand(rings, P.lat(y), P.lon(x))) return false;
  if (r > 0) for (let k = 0; k < 8; k++) if (pointInLand(rings, P.lat(y + r * Math.cos(k * 45 * D)), P.lon(x + r * Math.sin(k * 45 * D)))) return false;
  return true;
}
/* cur(조류)가 있으면 대지 항적(선수 방향 속력 + 조류)으로 확인 */
/* 선분(x0,y0)→(x1,y1)(NM, P 투영)이 육지와 buf NM 넘게 떨어져 있는지: 해안선 꼭짓점이 선분에서 buf 안이거나 해안선 변이 선분과 만나면 실패.
   점을 띄엄띄엄 찍어 보는 방식은 100 m 암초를 놓치므로 기하로 정확히 확인 */
const ringBox = new WeakMap();
function bboxOf(r) { let b = ringBox.get(r); if (!b) { b = [Infinity, Infinity, -Infinity, -Infinity]; for (let i = 0; i < r.length; i += 2) { b[0] = Math.min(b[0], r[i]); b[1] = Math.min(b[1], r[i + 1]); b[2] = Math.max(b[2], r[i]); b[3] = Math.max(b[3], r[i + 1]); } ringBox.set(r, b); } return b; }
function segClear(rings, P, x0, y0, x1, y1, buf) {
  const lonA = P.lon(Math.min(x0, x1) - buf - 0.1), lonB = P.lon(Math.max(x0, x1) + buf + 0.1), latA = P.lat(Math.min(y0, y1) - buf - 0.1), latB = P.lat(Math.max(y0, y1) + buf + 0.1);
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-12, b2 = buf * buf;
  const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  for (const r of rings) {
    const bb = bboxOf(r); if (bb[2] < lonA || bb[0] > lonB || bb[3] < latA || bb[1] > latB) continue;
    let px = P.x(r[r.length - 2]), py = P.y(r[r.length - 1]);
    for (let i = 0; i < r.length; i += 2) {
      const qx = P.x(r[i]), qy = P.y(r[i + 1]);
      if (buf > 0) { const u = Math.max(0, Math.min(1, ((qx - x0) * dx + (qy - y0) * dy) / L2)), ex = x0 + u * dx - qx, ey = y0 + u * dy - qy; if (ex * ex + ey * ey < b2) return false; }
      if (buf > 0) { const ex = qx - px, ey = qy - py, e2 = ex * ex + ey * ey || 1e-12; for (const [sx, sy] of [[x0, y0], [x1, y1]]) { const u = Math.max(0, Math.min(1, ((sx - px) * ex + (sy - py) * ey) / e2)), fx = px + u * ex - sx, fy = py + u * ey - sy; if (fx * fx + fy * fy < b2) return false; } } // 두 선분 사이 최소 거리 = 네 끝점-선분 거리 중 최소
      const d1 = cross(x0, y0, x1, y1, px, py), d2 = cross(x0, y0, x1, y1, qx, qy), d3 = cross(px, py, qx, qy, x0, y0), d4 = cross(px, py, qx, qy, x1, y1);
      if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return false;
      px = qx; py = qy;
    }
  }
  return true;
}
function trackClear(rings, P, x0, y0, hdg, kn, min, buf, cur = null) {
  let vx = kn * Math.sin(hdg * D), vy = kn * Math.cos(hdg * D); if (cur && cur.drift > 0) { vx += cur.drift * Math.sin(cur.set * D); vy += cur.drift * Math.cos(cur.set * D); }
  const sp = Math.hypot(vx, vy) || 1e-9, len = sp * min / 60, sb = vx / sp, cb = vy / sp;
  if (pointInLand(rings, P.lat(y0), P.lon(x0))) return false;
  return segClear(rings, P, x0, y0, x0 + len * sb, y0 + len * cb, buf);
}
/* 위경도 (lat,lon)에서 hdg로 kn 속력 min분 가는 길(둘레 buf NM 포함)이 바다로만 가는지 */
export function routeClear(rings, lat, lon, hdg, kn, min, buf = 0, cur = null) { const P = makeProj(lat, lon); return trackClear(rings, P, 0, 0, hdg, kn, min, buf, cur); }
function landWithin(rings, lat, lon, nm) {
  const P = makeProj(lat, lon);
  for (const r of rings) for (let i = 0; i < r.length; i += 2) if (Math.hypot(P.x(r[i]), P.y(r[i + 1])) < nm) return true;
  return false;
}

/* 자선은 시나리오 시간 내내(최소 30분, 자유 항해 60분) 1 NM 여유로 육지에 닿지 않는 침로, 상대선도 같은 시간 0.3 NM 여유 */
export const AHEAD_NM = 30; // 시작 침로 앞으로 육지가 없어야 하는 거리
export function pickStart({ def, region, rings, rnd, tries = 80, cur = null }) {
  const b = region.box, min = Math.max(def.durationMin || 30, 30);
  for (let i = 0; i < tries; i++) {
    const lat = b.lat0 + rnd() * (b.lat1 - b.lat0), lon = b.lon0 + rnd() * (b.lon1 - b.lon0), dHdg = Math.floor(rnd() * 360);
    const d = rotatePlace(def, { lat, lon, dHdg }), P = makeProj(lat, lon);
    // 자선: 침로선 앞 30 NM(또는 시나리오 시간 동안 가는 거리 중 긴 쪽)이 육지에 닿지 않게 — 선수 방향 그대로와 조류에 밀리는 대지 항적 둘 다
    const kn = d.own.kn ?? 14, ahead = Math.max(min, (AHEAD_NM / kn) * 60);
    if (!trackClear(rings, P, 0, 0, d.own.hdg, kn, ahead, 1) || (cur && cur.drift > 0 && !trackClear(rings, P, 0, 0, d.own.hdg, kn, ahead, 1, cur))) continue;
    if (!d.targets.every((g) => trackClear(rings, P, P.x(g.lon), P.y(g.lat), g.hdg, g.kn, min, 0.3, cur))) continue;
    if (region.nearLand && !landWithin(rings, lat, lon, 12)) continue;
    return { def: d, ok: true, dHdg };
  }
  return { def, ok: false, dHdg: 0 };
}

/* 무작위 항로(변침점 3~5개): 첫 변침점은 시작 침로 위(시나리오 조우가 첫 구간에서 끝나도록 firstNM 이상),
   다음 구간은 20~70° 좌우로 꺾고 길이 5~10 NM. 구간마다 둘레 1 NM 안에 육지가 없어야 함(rings 없으면 확인 생략) */
export function makeRoute({ lat, lon, hdg, rnd, rings = null, firstNM = 8, n = null }) {
  const want = n ?? 3 + Math.floor(rnd() * 3), P = makeProj(lat, lon), out = [];
  const ok = (x0, y0, h, len) => !rings || trackClear(rings, P, x0, y0, h, 60, len, 1); // 60 kn × len분 = len NM
  let x = 0, y = 0, h = hdg, len = Math.min(28, Math.max(firstNM, 6 + rnd() * 4));
  while (len > 3 && !ok(x, y, h, len)) len -= 1; // 앞에 육지가 있으면 첫 구간을 줄임(보통은 시작 때 30 NM 앞이 확인돼 있음)
  x += len * Math.sin(h * D); y += len * Math.cos(h * D); out.push({ lat: P.lat(y), lon: P.lon(x) });
  for (let k = 1; k < want; k++) {
    let found = null;
    for (let t = 0; t < 24 && !found; t++) { const turn = (20 + rnd() * 50) * (rnd() < 0.5 ? -1 : 1), nh = wrap360(h + turn), L = 5 + rnd() * 5 - (t > 12 ? 2 : 0); if (ok(x, y, nh, L)) found = { nh, L }; }
    if (!found) break;
    h = found.nh; x += found.L * Math.sin(h * D); y += found.L * Math.cos(h * D); out.push({ lat: P.lat(y), lon: P.lon(x) });
  }
  return out;
}
