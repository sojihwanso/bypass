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
