/* 난이도 = 주변 교통량(ECDIS 시뮬레이터와 같은 뜻). 배경 배는 피하지 않고 직진.
   N척은 30분 안에 자선 2 NM 안으로 들어오게(측방 0.3~1.9 NM), 나머지는 멀리 지나감(2.5~6 NM) */
import { makeProj, velXY } from './geo.js';

export const LEVELS = ['none', 'easy', 'medium', 'hard'];
export const NOAIS = { easy: 0.2, medium: 0.4, hard: 0.6 };
const CLOSE = { easy: [1, 2], medium: [15, 20], hard: [45, 55] }, FAR = { easy: 2, medium: 8, hard: 15 };

/* 자선이 tc분 직진한 점에서 오른쪽 side NM 떨어진 곳에 tc분 뒤 오는 배의 시작 위치 */
function meet(own, tcMin, hdg, kn, side) {
  const P = makeProj(own.lat, own.lon), h = tcMin / 60, ov = velXY(own.hdg, own.kn), tv = velXY(hdg, kn), a = own.hdg * Math.PI / 180;
  const x = ov.vx * h + Math.cos(a) * side - tv.vx * h, y = ov.vy * h - Math.sin(a) * side - tv.vy * h;
  return { lat: P.lat(y), lon: P.lon(x) };
}

/* 시간이 지나도 난이도만큼: 12 NM 안에서 다가오거나 6 NM 안에 있는 배경 배 수를 이만큼 유지 */
export const KEEP = { easy: 3, medium: 22, hard: 56 };
const relOf = (own, g) => { const P = makeProj(own.lat, own.lon), x = P.x(g.lon), y = P.y(g.lat), ov = velXY(own.hdg, own.kn), tv = velXY(g.cog ?? g.hdg, g.sog ?? g.kn); return { d: Math.hypot(x, y), closing: x * (tv.vx - ov.vx) + y * (tv.vy - ov.vy) < 0 }; };
export function activeCount(own, targets) { let n = 0; for (const g of targets) { if (!String(g.id).startsWith('bg')) continue; const r = relOf(own, g); if (r.d <= 6 || (r.d <= 12 && r.closing)) n++; } return n; }
/* 모자란 만큼(한 번에 목표의 15%까지) 새 배를 화면 밖 6.5~12 NM에서 들여보냄. clear(g)=false면 육지 경로라 버림 */
export function refillTraffic({ level, own, targets, rnd, seq = 0, clear = () => true }) {
  if (!KEEP[level]) return [];
  const want = Math.min(KEEP[level] - activeCount(own, targets), Math.ceil(KEEP[level] * 0.15)), out = [], P = makeProj(own.lat, own.lon);
  const [c0, c1] = CLOSE[level], pClose = (c0 + c1) / 2 / ((c0 + c1) / 2 + FAR[level]);
  for (let i = 0; i < want; i++) {
    for (let k = 0; k < 8; k++) {
      const close = rnd() < pClose, g = oneShip(own, rnd, level, close, 12 + rnd() * 16, 'bg' + (seq + out.length));
      const d = Math.hypot(P.x(g.lon), P.y(g.lat));
      if (d >= 6.5 && d <= 12 && clear(g)) { out.push(g); break; }
    }
  }
  return out;
}
function oneShip(own, rnd, level, close, tc, id) {
  const ais = rnd() >= NOAIS[level], n = id.slice(2);
  const kn = ais ? Math.round(8 + rnd() * 10) : Math.round(3 + rnd() * 7), hdg = Math.round(rnd() * 360);
  const side = (rnd() < 0.5 ? -1 : 1) * (close ? 0.3 + rnd() * 1.6 : 2.5 + rnd() * 3.5);
  return { id, name: ais ? 'VESSEL ' + (100 + +n) : '', mmsi: ais ? 441000000 + +n : null, ...meet(own, tc, hdg, kn, side), hdg, kn,
    L: ais ? Math.round(60 + rnd() * 160) : Math.round(10 + rnd() * 20), rcs: ais ? null : Math.round(3 + rnd() * 5), h: ais ? null : 3, ais, legs: [] };
}

export function makeTraffic({ level, own, rnd, minutes = 30 }) {
  if (!CLOSE[level]) return [];
  const [c0, c1] = CLOSE[level], nClose = c0 + Math.floor(rnd() * (c1 - c0 + 1)), out = [];
  for (let i = 0; i < nClose + FAR[level]; i++) {
    const close = i < nClose, ais = rnd() >= NOAIS[level];
    const kn = ais ? Math.round(8 + rnd() * 10) : Math.round(3 + rnd() * 7), hdg = Math.round(rnd() * 360);
    const side = (rnd() < 0.5 ? -1 : 1) * (close ? 0.3 + rnd() * 1.6 : 2.5 + rnd() * 3.5), tc = 3 + rnd() * (minutes - 4);
    out.push({ id: 'bg' + i, name: ais ? 'VESSEL ' + (100 + i) : '', mmsi: ais ? 441000000 + i : null, ...meet(own, tc, hdg, kn, side), hdg, kn,
      L: ais ? Math.round(60 + rnd() * 160) : Math.round(10 + rnd() * 20), rcs: ais ? null : Math.round(3 + rnd() * 5), h: ais ? null : 3, ais, legs: [] });
  }
  return out;
}
