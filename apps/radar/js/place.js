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
function trackClear(rings, P, x0, y0, hdg, kn, min, buf) {
  const len = kn * min / 60, sb = Math.sin(hdg * D), cb = Math.cos(hdg * D);
  for (let d = 0; d <= len + 1e-9; d += 0.5) if (!clear(rings, P, x0 + d * sb, y0 + d * cb, buf)) return false;
  return true;
}
function landWithin(rings, lat, lon, nm) {
  const P = makeProj(lat, lon);
  for (const r of rings) for (let i = 0; i < r.length; i += 2) if (Math.hypot(P.x(r[i]), P.y(r[i + 1])) < nm) return true;
  return false;
}

export function pickStart({ def, region, rings, rnd, tries = 40 }) {
  const b = region.box, min = Math.min(def.durationMin || 30, 30);
  for (let i = 0; i < tries; i++) {
    const lat = b.lat0 + rnd() * (b.lat1 - b.lat0), lon = b.lon0 + rnd() * (b.lon1 - b.lon0), dHdg = Math.floor(rnd() * 360);
    const d = rotatePlace(def, { lat, lon, dHdg }), P = makeProj(lat, lon);
    if (!trackClear(rings, P, 0, 0, d.own.hdg, d.own.kn ?? 14, min, 1)) continue;
    if (!d.targets.every((g) => trackClear(rings, P, P.x(g.lon), P.y(g.lat), g.hdg, g.kn, min, 0.3))) continue;
    if (region.nearLand && !landWithin(rings, lat, lon, 12)) continue;
    return { def: d, ok: true, dHdg };
  }
  return { def, ok: false, dHdg: 0 };
}
