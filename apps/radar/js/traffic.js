/* 난이도 = 주변 교통량(ECDIS 시뮬레이터와 같은 뜻). 배경 배는 직진하다가 자선과 위험해지면 우현으로 피함(steerTraffic).
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
const relOf = (own, g) => { const P = makeProj(own.lat, own.lon), x = P.x(g.lon), y = P.y(g.lat), ov = velXY(own.hdg, own.kn), tv = velXY(g.hdg, g.kn); /* 물 기준(조류 빼고) */ return { d: Math.hypot(x, y), closing: x * (tv.vx - ov.vx) + y * (tv.vy - ov.vy) < 0 }; };
export function activeCount(own, targets, dMax = 12) { let n = 0; for (const g of targets) { if (!String(g.id).startsWith('bg')) continue; const r = relOf(own, g); if (r.d <= 6 || (r.d <= dMax && r.closing)) n++; } return n; }
/* 새 배가 나오는 고리·지우는 거리: 지금 화면에 보이는 반경(vis NM)보다 바깥. 기본(6 NM 이하)은 6.5~12 NM, 20 NM 밖에서 지움 */
export function trafficRing(vis = 6) { const dMin = Math.max(6.5, vis + 0.5); return { dMin, dMax: Math.max(12, vis + 6), dDrop: Math.max(20, vis + 3) }; }
/* 모자란 만큼(한 번에 목표의 15%까지) 새 배를 화면 밖 고리(ring, 기본 6.5~12 NM)에서 들여보냄. clear(g)=false면 육지 경로라 버림 */
export function refillTraffic({ level, own, targets, rnd, seq = 0, clear = () => true, ring = trafficRing() }) {
  if (!KEEP[level]) return [];
  const want = Math.min(KEEP[level] - activeCount(own, targets, ring.dMax), Math.ceil(KEEP[level] * 0.15)), out = [], P = makeProj(own.lat, own.lon), k = ring.dMin / 6.5; // 멀리서 나오면 만나는 시각도 그만큼 늦게
  const [c0, c1] = CLOSE[level], pClose = (c0 + c1) / 2 / ((c0 + c1) / 2 + FAR[level]);
  for (let i = 0; i < want; i++) {
    const close = rnd() < pClose; // 배마다 한 번만 정함(재시도로 먼 배 쪽에 쏠리지 않게)
    for (let t = 0; t < 8; t++) {
      const g = oneShip(own, rnd, level, close, (12 + rnd() * 16) * k, 'bg' + (seq + out.length));
      const d = Math.hypot(P.x(g.lon), P.y(g.lat));
      if (d >= ring.dMin && d <= ring.dMax && clear(g)) { out.push(g); break; }
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
  const P = makeProj(own.lat, own.lon);
  for (let i = 0; i < nClose + FAR[level]; i++) {
    const close = i < nClose, ais = rnd() >= NOAIS[level];
    let g = null;
    for (let k = 0; k < 10 && (!g || Math.hypot(P.x(g.lon), P.y(g.lat)) < 2.5); k++) { // 처음부터 자선 코앞(2.5 NM 안)에서 시작하지 않게
      const kn = ais ? Math.round(8 + rnd() * 10) : Math.round(3 + rnd() * 7), hdg = Math.round(rnd() * 360);
      const side = (rnd() < 0.5 ? -1 : 1) * (close ? 0.3 + rnd() * 1.6 : 2.5 + rnd() * 3.5), tc = 8 + rnd() * (minutes - 9);
      g = { id: 'bg' + i, name: ais ? 'VESSEL ' + (100 + i) : '', mmsi: ais ? 441000000 + i : null, ...meet(own, tc, hdg, kn, side), hdg, kn,
        L: ais ? Math.round(60 + rnd() * 160) : Math.round(10 + rnd() * 20), rcs: ais ? null : Math.round(3 + rnd() * 5), h: ais ? null : 3, ais, legs: [] };
    }
    out.push(g);
  }
  return out;
}

/* 주변 배(bg*)의 회피: 자선과 CPA < 1.0 NM(15분 안, 8 NM 안)이면 우현으로 돌려 CPA ≥ 1.2 NM 되는 가장 작은 각을 고름.
   원래 침로(base)로 계속 다시 계산하므로, 지나가고 나면(CPA 충분·멀어짐) 저절로 원래 침로로 돌아감. 10초마다 부름 */
/* 물(대수) 기준으로 계산: 조류는 모든 배를 똑같이 밀어 상대 운동에 영향이 없으므로, 자선도 선수 방위·대수 속력(HDG·STW), 상대선도 HDG·속력으로 */
export function steerTraffic(own, targets) {
  const P = makeProj(own.lat, own.lon), ov = velXY(own.hdg, own.stw ?? own.kn ?? own.sog);
  const cpaAt = (x, y, hdg, kn) => { const v = velXY(hdg, kn), rx = v.vx - ov.vx, ry = v.vy - ov.vy, s2 = rx * rx + ry * ry; const t = s2 < 1e-9 ? 0 : -(x * rx + y * ry) / s2; return { cpa: Math.hypot(x + rx * Math.max(0, t), y + ry * Math.max(0, t)), tcpa: t * 60 }; };
  for (const g of targets) {
    if (!String(g.id).startsWith('bg') || !g.want) continue;
    g.base ||= { hdg: g.want.hdg, kn: g.want.kn };
    const x = P.x(g.lon), y = P.y(g.lat), d = Math.hypot(x, y), b = g.base;
    const c0 = cpaAt(x, y, b.hdg, b.kn), risk = d < 8 && c0.tcpa > 0 && c0.tcpa < 15;
    if (!risk || c0.cpa >= (g.avoiding ? 1.2 : 1.0)) { if (g.avoiding) { g.want.hdg = b.hdg; g.want.kn = b.kn; g.avoiding = false; } continue; }
    let a = 20; while (a <= 90 && cpaAt(x, y, b.hdg + a, b.kn).cpa < 1.2) a += 10;
    if (a > 90) { let best = -1; for (let q = -90; q <= 150; q += 10) for (const k of [b.kn, b.kn / 2]) { const c = cpaAt(x, y, b.hdg + q, k).cpa + (q > 0 ? 0.05 : 0); if (c > best) { best = c; a = q; g.want.kn = k; } } }
    else g.want.kn = b.kn;
    g.want.hdg = (b.hdg + a + 360) % 360; g.avoiding = true;
  }
}
