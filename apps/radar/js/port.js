/* 입출항 히든 시나리오(이스터에그 전용): 항구 정의, 항로 판정(XTD), 기록·평가(순수 계산).
   항로·변침점: 실제 항로계획(광양→부산, 포트클랑→부산)의 부산 구간. 등화: OSM 좌표 + 등질은 등대 목록·ECDIS(Iso 4s).
   합격 = 좌초·충돌 없음 + 상대선 최소 거리 ≥ 0.15 NM + 30초 넘는 항로 이탈 없음 + 제한 시간 안 도착(사용자 결정). */
import { makeProj, wrap360, cpaTcpa, velXY } from './geo.js';
import { createShip, createTarget, stepShip, stepTarget, TELEGRAPH } from './sim.js';
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
    wps: WPS, legHalfNM: [0.30, 0.25, 0.11], /* 입구 구간: 방파제 끝이 중심선에서 우현 0.128·좌현 0.142 NM이라 0.11(점선 안은 늘 바다, 검토 반영) */
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
  if (!best) { /* 변침점 바깥 쐐기 등 어느 구간에도 안 걸치면: 잘린 선분까지 거리가 가장 가까운 구간, XTD = 그 거리(부호는 그 구간 기준) */
    let bd = Infinity; for (const c of all) { const u = Math.max(0, Math.min(c.lenNM, c.alongNM)), d = Math.hypot(c.alongNM - u, c.xtdNM); if (d < bd) { bd = d; best = { ...c, xtdNM: Math.sign(c.xtdNM || 1) * d }; } }
  }
  return best;
}
export function inChannel(path, lat, lon, basin = null) { const c = crossTrack(path, lat, lon); return Math.abs(c.xtdNM) <= c.halfNM || (!!basin && dist(basin, lat, lon) <= basin.rNM); } /* 선회장 원 안은 항로로 봄 */
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
      const off = Math.abs(c.xtdNM) > c.halfNM && dist(port.basin, o.lat, o.lon) > port.basin.rNM; /* 선회장 원 안은 항로로 봄 */
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
  if (!r.arrived && !r.grounding && !r.collision) R(r.timeout ? '시간 안에 도착하지 못했어요.' : '아직 도착하지 않았어요.', r.timeout ? 'Did not arrive within the time limit.' : 'Not arrived yet.');
  if (r.rule9) notes.push({ ko: '규칙 주의(제9조): 좁은 수로에서 마주 오는 배가 있을 때 항로 왼쪽으로 붙었어요. 오른쪽에 붙어 가세요.', en: 'Rule check (Rule 9): you kept to the left of the channel with a vessel approaching. Keep to the starboard side of a narrow channel.', warn: true });
  if (r.near03 && r.near03.n) notes.push({ ko: `참고: 상대선이 0.3 NM 안으로 ${r.near03.n}번, 모두 ${mmss(r.near03.sec)} 들어왔어요.`, en: `Note: other vessels came within 0.3 NM ${r.near03.n} time(s), ${mmss(r.near03.sec)} in total.` });
  const pass = reasons.length === 0;
  return { ...r, pass, reasons, notes, warnN: notes.filter((n) => n.warn).length };
}

/* ---- 경로 위치(s = 경로 처음부터 간 거리 NM) ---- */
function cumOf(path) { const c = [0]; for (let i = 0; i < path.wps.length - 1; i++) { const A = path.wps[i], B = path.wps[i + 1], P = makeProj(A.lat, A.lon); c.push(c[i] + Math.hypot(P.x(B.lon), P.y(B.lat))); } return c; }
export function sOf(path, lat, lon) { const c = crossTrack(path, lat, lon), cum = path.cum || (path.cum = cumOf(path)); return cum[c.leg] + c.alongNM; }
/* s가 속한 구간 번호(처음 앞이면 0, 끝을 지나면 마지막 구간) */
export function legAt(path, s) { const cum = path.cum || (path.cum = cumOf(path)), n = path.wps.length - 1; if (s <= 0) return 0; for (let i = 0; i < n; i++) if (s < cum[i + 1]) return i; return n - 1; }
export function pointAt(path, s, off = 0) {
  const cum = path.cum || (path.cum = cumOf(path)), n = path.wps.length - 1; let i = 0; while (i < n - 1 && s > cum[i + 1]) i++;
  return legPoint(path.wps[i], path.wps[i + 1], (s - cum[i]) / (cum[i + 1] - cum[i]), off);
}
const brgTo = (lat, lon, q) => { const P = makeProj(lat, lon); return wrap360((Math.atan2(P.x(q.lon), P.y(q.lat)) * 180) / Math.PI); };
/* 경로 따라가기 침로: 지금 위치에서 look NM 앞, 오른쪽 off NM 점을 향함 */
export function steerOnPath(path, lat, lon, look = 0.4, off = 0) { return brgTo(lat, lon, pointAt(path, sOf(path, lat, lon) + look, off)); }

/* ---- 교통(난이도 = 교통량, 설계 5.5) ---- */
const N = { easy: [1, 0, 0, 3], medium: [1, 1, 1, 4], hard: [2, 1, 3, 5] };
const NAMES = [['HANA', 440123001], ['SEJIN', 440123002]];
const TUG = [{ lat: 35.0960, lon: 129.0820 }, { lat: 35.0985, lon: 129.0760 }];
const FISH_BOX = { lat0: 35.035, lat1: 35.06, lon0: 129.105, lon1: 129.135 };
const ANC = [[35.040, 129.185], [35.052, 129.192], [35.064, 129.180], [35.078, 129.172], [35.090, 129.168]];
export const COUNTER_KN = 10, OWN_IN_KN = 11;
export function portTraffic(port, mode, level = 'medium', rnd = Math.random) {
  const [nP, nT, nF, nA] = N[level] || N.medium, out = [];
  const cp = pathOf(port, mode === 'IN' ? 'OUT' : 'IN'), cum = cumOf(cp), tot = cum[cum.length - 1];
  for (let k = 0; k < nP; k++) {
    let s0, kn, hold;
    if (mode === 'IN') { /* 출항선: 자선이 WP.17~P/S 구간 가운데에 올 때 마주침 */
      const own = pathOf(port, 'IN'), meetOwn = cumOf(own)[1] / 2, tMeet = meetOwn / OWN_IN_KN; s0 = tot - meetOwn - COUNTER_KN * tMeet - 1.2 * k; kn = COUNTER_KN; hold = null;
    } else if (k === 0) { s0 = 0; kn = 0; hold = 'release'; } /* 입항선: WP.17에서 기다리다 자선이 B/W를 지나면 출발(입구 밖 넓은 구간에서 마주침) */
    else { s0 = cum[1] + 0.16; kn = COUNTER_KN; hold = null; } /* 어려움 2번째 입항선: 바로 출발해 자선이 입구에 있는 동안 입구 밖에서 대기(입구 한 척 규칙) */
    cp.cum = cum; const p = pointAt(cp, s0, 0.6 * cp.half[legAt(cp, s0)]), hdg = steerOnPath(cp, p.lat, p.lon, 0.4, 0);
    out.push({ id: 'p' + (k + 1), name: NAMES[k][0], mmsi: NAMES[k][1], L: 170 + 20 * k, ais: true, lat: p.lat, lon: p.lon, hdg, kn, meta: { kind: 'counter', path: cp.mode, hold } });
  }
  for (let k = 0; k < nT; k++) out.push({ id: 'bgTug' + (k + 1), name: '', L: 32, ais: false, rcs: 60, ...TUG[0], hdg: brgTo(TUG[0].lat, TUG[0].lon, TUG[1]), kn: 5, meta: { kind: 'tug' } });
  for (let k = 0; k < nF; k++) { const lat = FISH_BOX.lat0 + rnd() * (FISH_BOX.lat1 - FISH_BOX.lat0), lon = FISH_BOX.lon0 + rnd() * (FISH_BOX.lon1 - FISH_BOX.lon0); out.push({ id: 'bgFish' + (k + 1), name: '', L: 15, ais: false, rcs: 8, lat, lon, hdg: rnd() * 360, kn: 3 + rnd() * 3, meta: { kind: 'fish' } }); }
  for (let k = 0; k < nA; k++) out.push({ id: 'bgAnc' + (k + 1), name: `ANCHOR ${k + 1}`, mmsi: 440200001 + k, L: 180, ais: true, lat: ANC[k][0], lon: ANC[k][1], hdg: 200 + 20 * k, kn: 0, meta: { kind: 'anc' } });
  return out;
}

const seeded = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
export function portDef(id, mode, level = 'medium', seed = 1) {
  const port = PORTS[id], rnd = seeded((seed >>> 0) || 1), path = pathOf(port, mode), tk = (k) => TELEGRAPH.findIndex((x) => x.k === k);
  const own = mode === 'IN' ? { lat: path.wps[0].lat, lon: path.wps[0].lon, hdg: 348, tele: tk('HA') } : { lat: port.basin.lat, lon: port.basin.lon, hdg: 125, tele: tk('SA'), state: { stw: 0, sog: 0, auto: { on: false, setHdg: 125 } } };
  const aids = [...port.lights.map((l) => ({ type: 'light', lat: l.lat, lon: l.lon, col: l.col, ko: l.ko, en: l.en })), ...port.buoys.map((b) => (b.racon ? { type: 'racon', letter: b.racon, lat: b.lat, lon: b.lon, col: b.col, ko: b.ko, en: b.en } : { type: 'buoy', lat: b.lat, lon: b.lon, col: b.col, ko: b.ko, en: b.en }))];
  return {
    id: `PORT-${id}-${mode}`, ko: `${port.ko} ${mode === 'IN' ? '입항' : '출항'}`, en: `${port.en} ${mode === 'IN' ? 'arrival' : 'departure'}`, portId: id, mode, level, seed,
    own, targets: portTraffic(port, mode, level, rnd), aids, weather: { current: { set: Math.round(rnd() * 360), drift: Math.round(rnd() * 10) / 10 } },
    durationMin: port.timeMin[mode], coastOverride: id, landFine: { cell: 0.01, half: 8 }, iala: 'B', save: false,
  };
}

/* ---- 진행(교통 조종·입구 한 척 규칙·VTS 사건) ---- */
export function createPortState(def) {
  const port = PORTS[def.portId], own = pathOf(port, def.mode), ownCum = cumOf(own); own.cum = ownCum;
  const ent = (p) => (p.mode === 'IN' ? [p.cum[2], p.cum[3]] : [0, p.cum[1]]);
  const paths = { IN: pathOf(port, 'IN'), OUT: pathOf(port, 'OUT') }; for (const k in paths) paths[k].cum = cumOf(paths[k]);
  const ships = {}; for (const g of def.targets) ships[g.id] = { ...(g.meta || {}), base: { hdg: g.hdg, kn: g.kn }, waiting: false, released: !(g.meta && g.meta.hold), leg: 1, nextTurn: 180 };
  const marks = def.mode === 'IN' ? [['ps', ownCum[1]], ['bw', ownCum[2]]] : [['bw', ownCum[1]], ['ps', ownCum[2]]];
  return { port, mode: def.mode, own, ownEnt: ent(own), paths, ent, ships, marks, done: new Set(), started: false, rnd: seeded(((def.seed || 1) * 7919) >>> 0 || 1) };
}
export function portTick(w, st, dt) {
  const ev = [], o = w.own, so = sOf(st.own, o.lat, o.lon);
  if (!st.started) { st.started = true; ev.push({ kind: 'vts', key: 'start' }); }
  for (const [key, s] of st.marks) if (!st.done.has(key) && so >= s) { st.done.add(key); ev.push({ kind: 'vts', key }); }
  const busy = so >= st.ownEnt[0] - 1.0 && so <= st.ownEnt[1] + 0.3;
  const Po = makeProj(o.lat, o.lon), ov = velXY(o.cog ?? o.hdg, o.sog ?? 0);
  for (const g of w.targets) {
    const m = st.ships[g.id]; if (!m || !g.want) continue;
    if (m.kind === 'anc') { g.want.kn = 0; if (!m.pos) m.pos = { lat: g.lat, lon: g.lon }; else { g.lat = m.pos.lat; g.lon = m.pos.lon; } continue; } /* 묘박: 조류에 밀리지 않음 */
    if (m.kind === 'counter') {
      const cp = st.paths[m.path], sc = sOf(cp, g.lat, g.lon), [e0, e1] = st.ent(cp), tot = cp.cum[cp.cum.length - 1];
      if (!m.released && st.mode === 'OUT' && so >= st.own.cum[1]) m.released = true; /* 출항: 자선이 B/W를 지나면 입항선 출발 */
      const nearEnt = sc < e0 && e0 - sc < 0.8; /* 정지 거리(10 kn→0 약 0.28 NM)+여유: 입구 0.5 NM 밖에서 멈춤 */
      if (m.released && nearEnt && busy && !m.waiting) { m.waiting = true; if (!m.waitSaid) { m.waitSaid = true; ev.push({ kind: 'vts', key: 'wait', shipName: g.name }); } }
      if (m.waiting && !busy) m.waiting = false;
      const stop = !m.released || m.waiting || (cp.mode === 'IN' && sc >= tot - 0.3);
      g.want.kn = stop ? 0 : COUNTER_KN;
      if (stop && g.kn < 0.5) { if (!m.holdPos) m.holdPos = { lat: g.lat, lon: g.lon }; else { g.lat = m.holdPos.lat; g.lon = m.holdPos.lon; } } else m.holdPos = null; /* 대기 중에는 기관으로 제자리 유지(조류에 밀려 항로로 들어오지 않게) */
      const leg = legAt(cp, sc);
      if (!stop) g.want.hdg = steerOnPath(cp, g.lat, g.lon, 0.4, 0.6 * cp.half[leg]);
      continue;
    }
    if (m.kind === 'tug') { const tgt = TUG[m.leg % 2], P = makeProj(g.lat, g.lon); if (Math.hypot(P.x(tgt.lon), P.y(tgt.lat)) < 0.05) m.leg++; m.base.hdg = brgTo(g.lat, g.lon, TUG[m.leg % 2]); }
    if (m.kind === 'fish') { m.nextTurn -= dt; if (m.nextTurn <= 0) { m.nextTurn = 180; m.base.hdg = wrap360(m.base.hdg + (st.rnd() - 0.5) * 80); } const b = FISH_BOX; if (g.lat < b.lat0 || g.lat > b.lat1 || g.lon < b.lon0 || g.lon > b.lon1) m.base.hdg = brgTo(g.lat, g.lon, { lat: (b.lat0 + b.lat1) / 2, lon: (b.lon0 + b.lon1) / 2 }); }
    /* 주변 배 간단 회피: 자선과 CPA < 0.3 NM, 0 < TCPA < 6분이면 우현 30°까지 */
    const c = cpaTcpa({ x: 0, y: 0 }, ov, { x: Po.x(g.lon), y: Po.y(g.lat) }, velXY(g.cog ?? g.hdg, g.sog ?? g.kn));
    g.want.hdg = c.cpa < 0.3 && c.tcpa > 0 && c.tcpa < 6 ? wrap360(m.base.hdg + 30) : m.base.hdg; g.want.kn = m.base.kn;
  }
  return ev;
}

/* ---- VTS 문구(설계 5.6) ---- */
export function vtsText(key, mode, en, ship = '') {
  const T = {
    IN: { start: ['부산VTS(Ch.16): 북항 입항선, Sector 3 진입. 항로 우측 통항 바랍니다.', 'Busan VTS (Ch.16): inbound North Port, entering Sector 3. Keep to the starboard side of the channel.'],
      ps: ['부산VTS(Ch.12): Sector 1 진입. 방파제 입구 통과 때 보고 바랍니다.', 'Busan VTS (Ch.12): entering Sector 1. Report when passing the breakwater entrance.'],
      bw: ['방파제 입구 통과 — 빨강 등(중앙 방파제)은 우현, 초록 등(조도 방파제)은 좌현.', 'Passing the entrance — red light (Middle B/W) to starboard, green light (Jodo B/W) to port.'] },
    OUT: { start: ['부산VTS(Ch.12): 북항 출항선, Sector 1. 항로 우측 통항 바랍니다.', 'Busan VTS (Ch.12): outbound North Port, Sector 1. Keep to the starboard side of the channel.'],
      bw: ['방파제 입구 통과 — 출항이라 초록 등(조도 방파제)이 우현, 빨강 등(중앙 방파제)이 좌현.', 'Passing the entrance — outbound, so the green light (Jodo B/W) is to starboard and the red light (Middle B/W) to port.'],
      ps: ['부산VTS(Ch.16): Sector 3 진입. 입항선 주의 바랍니다.', 'Busan VTS (Ch.16): entering Sector 3. Watch for inbound vessels.'] },
  };
  if (key === 'wait') return en ? `Busan VTS: ${ship || 'the other vessel'} is holding outside the entrance. Proceed through the entrance.` : `부산VTS: ${ship || '상대선'}호가 입구 밖에서 대기 중. 입구를 통과하세요.`;
  const x = (T[mode] || T.IN)[key]; return x ? x[en ? 1 : 0] : '';
}

/* ---- 무인 시뮬레이션(테스트·검증용): actions = [{every:true|t, fn(own)}] ---- */
export function simulatePort(def, actions = [], { rings = [], dt = 1, watch = null } = {}) {
  const own = createShip({ lat: def.own.lat, lon: def.own.lon, hdg: def.own.hdg, tele: def.own.tele }); if (def.own.state) Object.assign(own, def.own.state);
  const targets = def.targets.map((g) => createTarget(g)), st = createPortState(def), log = createPortLog(PORTS[def.portId], def.mode), cur = (def.weather && def.weather.current) || { set: 0, drift: 0 }, events = [], done = new Set();
  for (let t = 0; t <= def.durationMin * 60; t += dt) {
    const w = { t, own, targets, land: { rings } };
    actions.forEach((a, i) => { if (a.every) a.fn(own); else if (!done.has(i) && a.t !== undefined && t >= a.t) { a.fn(own); done.add(i); } });
    log.sample(w); events.push(...portTick(w, st, dt)); if (watch) watch(w);
    const r = log.result(); if (r.arrived || r.collision || r.grounding) break;
    for (let k = 0; k < dt / 0.25; k++) { stepShip(own, 0.25, cur); for (const g of targets) stepTarget(g, 0.25, t + k * 0.25, cur); }
  }
  return { ...evaluatePort(log.result()), events };
}

/* 레이더 맵용 항로 경계선: 구간마다 좌우(반폭 위치) 선분 {leg, side:-1|1, a, b} */
export function channelBounds(port) {
  const out = []; for (let i = 0; i < port.wps.length - 1; i++) for (const side of [-1, 1]) out.push({ leg: i, side, a: legPoint(port.wps[i], port.wps[i + 1], 0, side * port.legHalfNM[i]), b: legPoint(port.wps[i], port.wps[i + 1], 1, side * port.legHalfNM[i]) });
  return out;
}
