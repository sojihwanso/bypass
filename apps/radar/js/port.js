/* 입출항 히든 시나리오(이스터에그 전용): 항구 정의, 항로 판정(XTD), 기록·평가(순수 계산).
   항로·변침점: 실제 항로계획(광양→부산, 포트클랑→부산)의 부산 구간. 등화: OSM 좌표 + 등질은 등대 목록·ECDIS(Iso 4s).
   합격 = 좌초·충돌 없음 + 상대선 최소 거리 ≥ 0.15 NM + 30초 넘는 항로 이탈 없음 + 제한 시간 안 도착(사용자 결정). */
import { makeProj } from './geo.js';
import { pointInLand } from './coast.js';
import { COLLIDE_NM, nearTrack } from './scenarios.js';

export const PORT_PASS_NM = 0.15, OFF_LIMIT_S = 30, ARRIVE_KN = 3;
const isBg = (g) => String(g.id).startsWith('bg');

const WPS = [
  { lat: 35.02500, lon: 129.15833, name: 'WP.17' },
  { lat: 35.06967, lon: 129.14667, name: 'P/S' },
  { lat: 35.07833, lon: 129.11167, name: 'B/W' },
  { lat: 35.09100, lon: 129.09000, name: '항내점' },
];
/* A→B 구간에서 along 비율 u, 오른쪽 off NM 지점 */
function legPoint(A, B, u, off) { const P = makeProj(A.lat, A.lon), bx = P.x(B.lon), by = P.y(B.lat), L = Math.hypot(bx, by), x = bx * u + (by / L) * off, y = by * u - (bx / L) * off; return { lat: P.lat(y), lon: P.lon(x) }; }

export const PORTS = {
  BUSAN: {
    id: 'BUSAN', ko: '부산 북항', en: 'Busan North Port',
    wps: WPS, legHalfNM: [0.30, 0.25, 0.15],
    basin: { lat: 35.09100, lon: 129.09000, rNM: 0.25 },
    timeMin: { IN: 60, OUT: 45 },
    lights: [ /* 실제 위치(OSM)·색 */
      { lat: 35.08453, lon: 129.10588, col: 'R', ch: 'Iso R 4s', ko: '중앙 방파제 남서단', en: 'Middle B/W SW end' },
      { lat: 35.09086, lon: 129.11319, col: 'Y', ch: 'Fl Y 5s', ko: '중앙 방파제 북동단', en: 'Middle B/W NE end' },
      { lat: 35.07911, lon: 129.10514, col: 'G', ch: 'Iso G 4s', ko: '조도 방파제 동단', en: 'Jodo B/W E end' },
      { lat: 35.07856, lon: 129.09769, col: 'Y', ch: 'Fl Y 5s', ko: '조도 방파제 서단', en: 'Jodo B/W W end' },
      { lat: 35.09131, lon: 129.12692, col: 'W', ch: 'Fl W 10s', ko: '오륙도 등대', en: 'Oryukdo Lt' },
    ],
    buoys: [ /* 훈련용 가상 배치: 도선점 남쪽 RACON, 도선점→B/W 구간 가운데 측방 한 쌍(IALA B, 입항 기준 오른쪽 빨강) */
      { lat: 35.06467, lon: 129.14667, col: 'Y', racon: 'B', ko: 'RACON 부표(가상)', en: 'RACON buoy (training)' },
      { ...legPoint(WPS[1], WPS[2], 0.5, 0.30), col: 'R', ko: '우현 표지(가상)', en: 'Starboard mark (training)' },
      { ...legPoint(WPS[1], WPS[2], 0.5, -0.30), col: 'G', ko: '좌현 표지(가상)', en: 'Port mark (training)' },
    ],
  },
};

/* 진행 방향 경로: IN = 정의 순서, OUT = 뒤집음. half[i] = 구간 i(wps[i]→wps[i+1]) 반폭 */
export function pathOf(port, mode) {
  const wps = mode === 'OUT' ? [...port.wps].reverse() : [...port.wps], half = mode === 'OUT' ? [...port.legHalfNM].reverse() : [...port.legHalfNM];
  return { wps, half, mode };
}

/* 항로 판정: along이 구간 안인 구간 중 |xtd| 최소(같으면 뒤 구간). 어느 구간에도 안 걸치면 앞이면 첫 구간, 뒤면 마지막 구간 */
export function crossTrack(path, lat, lon) {
  let best = null; const n = path.wps.length - 1, all = [];
  for (let i = 0; i < n; i++) {
    const A = path.wps[i], B = path.wps[i + 1], P = makeProj(A.lat, A.lon), bx = P.x(B.lon), by = P.y(B.lat), L = Math.hypot(bx, by), x = P.x(lon), y = P.y(lat);
    const along = (x * bx + y * by) / L, xtd = (x * by - y * bx) / L; /* 오른쪽 + */
    const c = { leg: i, xtdNM: xtd, alongNM: along, lenNM: L, halfNM: path.half[i] }; all.push(c);
    if (along >= 0 && along <= L && (!best || Math.abs(xtd) <= Math.abs(best.xtdNM))) best = c;
  }
  if (!best) best = all[0].alongNM < 0 ? all[0] : all[n - 1];
  return best;
}
export function inChannel(path, lat, lon) { const c = crossTrack(path, lat, lon); return Math.abs(c.xtdNM) <= c.halfNM; }
const dist = (a, lat, lon) => { const P = makeProj(a.lat, a.lon); return Math.hypot(P.x(lon), P.y(lat)); };

/* 기록: w = {t, own:{lat,lon,sog,hdg}, targets, land:{rings}} 를 표본마다 */
export function createPortLog(port, mode) {
  const path = pathOf(port, mode), limit = port.timeMin[mode] * 60;
  const min = {}, near = {}, wpTimes = [], seen = new Set();
  let grounding = false, collision = false, collisionWith = null, maxSog = 0, arrived = false, arriveT = null, timeout = false, lastT = 0;
  let offStart = null, offN = 0, longest = 0, maxXtd = 0, offFail = false, maxLeg = 0, rule9 = false;
  const closeOff = (t) => { if (offStart === null) return; const L = t - offStart; if (L > longest) longest = L; if (L > OFF_LIMIT_S) offFail = true; offStart = null; };
  return {
    path,
    sample(w) {
      const o = w.own, t = w.t; lastT = t;
      if (o.sog > maxSog) maxSog = o.sog;
      const c = crossTrack(path, o.lat, o.lon);
      if (c.leg >= maxLeg && c.alongNM >= 0 && !seen.has(c.leg)) { for (let i = maxLeg; i <= c.leg; i++) if (!seen.has(i)) { seen.add(i); wpTimes.push({ name: path.wps[i].name, t }); } maxLeg = c.leg; }
      const off = Math.abs(c.xtdNM) > c.halfNM;
      if (off) { if (offStart === null) { offStart = t; offN++; } if (Math.abs(c.xtdNM) > maxXtd) maxXtd = Math.abs(c.xtdNM); if (t - offStart > OFF_LIMIT_S) offFail = true; } else closeOff(t);
      for (const g of w.targets) {
        const d = dist(o, g.lat, g.lon);
        if (d <= COLLIDE_NM) { collision = true; collisionWith = g.name || g.id; }
        if (isBg(g)) continue;
        if (!min[g.id] || d < min[g.id].nm) min[g.id] = { id: g.id, nm: d, t };
        near[g.id] = nearTrack(near[g.id], d, t);
        if (d < 1 && c.xtdNM < -c.halfNM / 2) rule9 = true;
      }
      if (w.land && w.land.rings && w.land.rings.length && pointInLand(w.land.rings, o.lat, o.lon)) grounding = true;
      if (!arrived) {
        if (mode === 'IN' && dist(port.basin, o.lat, o.lon) <= port.basin.rNM && o.sog <= ARRIVE_KN) arrived = true;
        const ps = path.wps[path.wps.length - 2];
        if (mode === 'OUT' && c.leg === path.wps.length - 2 && c.alongNM > 0 && dist(ps, o.lat, o.lon) >= 1) arrived = true;
        if (arrived) arriveT = t; else if (t >= limit) timeout = true;
      }
    },
    result() {
      if (offStart !== null && lastT - offStart > longest) longest = lastT - offStart;
      const m = Object.values(min).sort((a, b) => a.nm - b.nm)[0] || null;
      const nr = Object.values(near).reduce((s, x) => ({ n: s.n + x.n, sec: s.sec + x.sec }), { n: 0, sec: 0 });
      return { port: port.id, mode, grounding, collision, collisionWith, minRange: m, off: { n: offN, longestS: longest, maxXtd }, offFail, wpTimes: [...wpTimes], maxSog, arrived, arriveT, timeout, near03: nr, rule9 };
    },
  };
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
export function evaluatePort(r) {
  const reasons = [], notes = [], R = (ko, en) => reasons.push({ ko, en });
  if (r.grounding) R('좌초했어요. 항로 폭과 방파제까지의 거리를 VRM·PI로 계속 확인하세요.', 'Grounded. Keep checking the channel width and the breakwater distance with VRM and PI.');
  if (r.collision) R(`충돌했어요(${COLLIDE_NM} NM 이내).`, `Collision (within ${COLLIDE_NM} NM).`);
  if (r.minRange && r.minRange.nm < PORT_PASS_NM) R(`상대선과 ${r.minRange.nm.toFixed(2)} NM까지 가까워졌어요(기준 ${PORT_PASS_NM} NM).`, `Came within ${r.minRange.nm.toFixed(2)} NM of the other vessel (limit ${PORT_PASS_NM} NM).`);
  if (r.offFail) R(`항로를 ${OFF_LIMIT_S}초 넘게 벗어났어요(가장 길게 ${mmss(r.off.longestS)}).`, `Left the channel for more than ${OFF_LIMIT_S} s (longest ${mmss(r.off.longestS)}).`);
  if (!r.arrived) R(r.timeout ? '시간 안에 도착하지 못했어요.' : '아직 도착하지 않았어요.', r.timeout ? 'Did not arrive within the time limit.' : 'Not arrived yet.');
  if (r.rule9) notes.push({ ko: '규칙 주의(제9조): 좁은 수로에서 마주 오는 배가 있을 때 항로 왼쪽으로 붙었어요. 오른쪽에 붙어 가세요.', en: 'Rule check (Rule 9): you kept to the left of the channel with a vessel approaching. Keep to the starboard side of a narrow channel.', warn: true });
  if (r.near03 && r.near03.n) notes.push({ ko: `참고: 상대선이 0.3 NM 안으로 ${r.near03.n}번, 모두 ${mmss(r.near03.sec)} 들어왔어요.`, en: `Note: other vessels came within 0.3 NM ${r.near03.n} time(s), ${mmss(r.near03.sec)} in total.` });
  const pass = reasons.length === 0;
  return { ...r, pass, reasons, notes, warnN: notes.filter((n) => n.warn).length };
}
