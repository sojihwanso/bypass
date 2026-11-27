/* AIS 물표: 보고 간격(ITU-R M.1371 Class A/B), 표시 필터, 휴면·활성·위험·분실, TT 연관, 받은 메시지 — 매뉴얼 4장 */
import { makeProj, cpaTcpa, velXY, angDiff, brgRng } from './geo.js';

export const AIS_RANGE_NM = 25;
export function reportInterval(kn, rot = 0, cls = 'A', nav = 'underway') {
  if (cls === 'B') return 30;
  if (nav === 'anchored' || nav === 'moored') return 180;
  const turning = Math.abs(rot) > 5; // °/min
  if (kn > 23) return 2;
  if (kn >= 14) return turning ? 2 : 6;
  return turning ? 3.3 : 10;
}

/* 정적·항해 정보(ITU-R M.1371 메시지 5, Class B는 18·24): 시나리오에 없으면 MMSI로 정해지는 그럴듯한 값.
   Class B는 IMO 번호·흘수·목적지·ETA를 보내지 않음 */
const DESTS = ['BUSAN', 'ULSAN', 'GWANGYANG', 'INCHEON', 'MOKPO', 'YEOSU', 'PYEONGTAEK', 'SHANGHAI', 'QINGDAO', 'TOKYO', 'KOBE', 'KAOHSIUNG'];
export const NAV_TEXT = { underway: 'UNDER WAY USING ENGINE', anchored: 'AT ANCHOR', moored: 'MOORED', nuc: 'NOT UNDER COMMAND', ram: 'RESTRICTED MANOEUVRABILITY', cbd: 'CONSTRAINED BY DRAUGHT', aground: 'AGROUND', fishing: 'ENGAGED IN FISHING', sailing: 'UNDER WAY SAILING' };
export function aisStatic(g, a) {
  const m = a.mmsi >>> 0, h = (k) => (Math.imul(m ^ Math.imul(k, 2654435761), 2246822519) >>> 0) / 4294967296, L = g.L ?? 100, B = g.B ?? Math.max(3, Math.round(L / 6.5)), clsB = a.cls === 'B';
  const type = g.shipType || (L < 25 ? 'FISHING' : L < 60 ? 'PASSENGER' : h(1) < 0.45 ? 'CARGO' : h(1) < 0.75 ? 'TANKER' : 'CONTAINER');
  const refA = Math.round(L * (0.75 + 0.1 * h(2))), refC = Math.round(B / 2);
  const eta = new Date(Date.UTC(2026, 10, 27) + (6 + Math.floor(h(3) * 60)) * 3600e3);
  const pad = (n) => String(n).padStart(2, '0'), letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return {
    imo: clsB ? null : g.imo ?? 9100000 + Math.floor(h(4) * 899999), call: g.call ?? 'D' + letters[Math.floor(h(5) * 26)] + letters[Math.floor(h(6) * 26)] + Math.floor(h(7) * 90 + 10),
    shipType: type, L, B, refA, refB: L - refA, refC, refD: B - refC, epfs: 'GPS', posAcc: h(8) < 0.7 ? 'HIGH' : 'LOW', raim: h(9) < 0.5 ? 'IN USE' : 'NOT IN USE',
    draught: clsB ? null : g.draught ?? Math.round((L / 22 + 1 + h(10) * 3) * 10) / 10, dest: clsB ? '' : g.dest || DESTS[Math.floor(h(11) * DESTS.length)],
    eta: clsB ? '' : `${pad(eta.getUTCMonth() + 1)}-${pad(eta.getUTCDate())} ${pad(eta.getUTCHours())}:${pad(Math.floor(h(12) * 6) * 10)} UTC`,
    cargo: clsB ? '' : type === 'TANKER' ? (h(13) < 0.5 ? 'HAZ CAT X (Y)' : 'HAZ CAT A') : '-',
  };
}

export function createAIS() {
  const map = new Map(); let lim = { cpa: 2, tcpa: 12, on: true }, msgs = [], P = null;
  function update(targets, own, t) {
    P = makeProj(own.lat, own.lon);
    const ov = velXY(own.cog || 0, own.sog || 0);
    for (const g of targets) {
      if (!g.ais) continue;
      const x = P.x(g.lon), y = P.y(g.lat); if (Math.hypot(x, y) > AIS_RANGE_NM) continue;
      let a = map.get(g.id);
      if (!a) { a = { id: g.id, mmsi: g.mmsi ?? 440000000 + map.size + 1, name: g.name || g.id, cls: g.cls || 'A', status: 'sleep', reports: 0, lastRep: -1e9, past: [], navStatus: g.nav || 'underway', assoc: null }; Object.assign(a, aisStatic(g, a)); map.set(g.id, a); }
      if (t - a.lastRep >= reportInterval(g.sog ?? g.kn, g.rot || 0, a.cls, a.navStatus) - 1e-9) {
        a.lat = g.lat; a.lon = g.lon; a.cog = g.cog ?? g.hdg; a.sog = g.sog ?? g.kn; a.hdg = g.hdg; a.rot = g.rot || 0; a.lastRep = t; a.reports++;
        if (!a.past.length || t - a.past[a.past.length - 1].t >= 60) { a.past.push({ lat: g.lat, lon: g.lon, t }); if (a.past.length > 10) a.past.shift(); }
        if (a.status === 'lost') a.status = 'sleep';
      }
    }
    for (const a of map.values()) {
      if (a.lastRep < -1e8) continue;
      const iv = reportInterval(a.sog, a.rot, a.cls, a.navStatus);
      if (t - a.lastRep > Math.max(20, 3.5 * iv)) { // 분실: 마지막 보고 위치에 머물고(자선 기준 좌표만 다시 계산), 5분 지나면 지움
        if (t - a.lastRep > Math.max(20, 3.5 * iv) + 300) { map.delete(a.id); continue; }
        a.status = 'lost'; a.x = P.x(a.lon); a.y = P.y(a.lat); const bl = brgRng(0, 0, a.x, a.y); a.brg = bl.brg; a.rng = bl.rng; a.cpa = null; a.tcpa = null; continue; }
      // 마지막 보고에서 추측 항법으로 현재 위치
      const dt = (t - a.lastRep) / 3600, v = velXY(a.cog, a.sog);
      a.x = P.x(a.lon) + v.vx * dt; a.y = P.y(a.lat) + v.vy * dt;
      const c = cpaTcpa({ x: 0, y: 0 }, ov, { x: a.x, y: a.y }, v); a.cpa = c.cpa; a.tcpa = c.tcpa;
      const br = brgRng(0, 0, a.x, a.y); a.brg = br.brg; a.rng = br.rng;
      /* 위험 판정은 활성 물표만(IEC 62388). 휴면 물표는 'CPA 자동 활성'이 켜져 있고 정한 거리 안일 때만 자동 활성 */
      const danger = lim.on && a.cpa < lim.cpa && a.tcpa >= 0 && a.tcpa <= lim.tcpa, canAuto = lim.auto && lim.auto.on && a.rng <= lim.auto.rng;
      if (a.status === 'sleep' && !(danger && canAuto)) continue;
      if (danger) a.status = 'danger'; else if (a.status === 'danger') a.status = 'active';
    }
  }
  function list(f) {
    const out = [...map.values()].filter((a) => a.lastRep > -1e8);
    if (!f) return out;
    return out.filter((a) => a.status === 'danger' || (!(f.maxRngOn && a.rng > f.maxRng) && !(f.minSpdOn && a.sog < f.minSpd) && !(f.exceptB && a.cls === 'B')));
  }
  return {
    update, list, setLimits(cpa, tcpa, on = true, auto = null) { lim = { cpa, tcpa, on, auto }; },
    activate(id) { const a = map.get(id); if (a && a.status === 'sleep') a.status = 'active'; },
    sleep(id) { const a = map.get(id); if (a && a.status === 'active') a.status = 'sleep'; },
    sleepAll() { for (const a of map.values()) if (a.status === 'active') a.status = 'sleep'; },
    /* tts: {id,x,y,course,speed,state}, toXY(lat,lon) → TT와 같은 좌표계 */
    associate(tts, crit = { rng: 0.05, spd: 2, crs: 15 }, toXY) {
      for (const a of map.values()) a.assoc = null; for (const g of tts) g.assoc = null;
      for (const a of map.values()) {
        if (a.status === 'lost' || a.lat === undefined) continue;
        const p = toXY(a.lat, a.lon);
        const g = tts.find((q) => q.state !== 'lost' && !q.assoc && Math.hypot(q.x - p.x, q.y - p.y) <= crit.rng && Math.abs(q.speed - a.sog) <= crit.spd && (a.sog < 1 || Math.abs(angDiff(q.course, a.cog)) <= crit.crs));
        if (g) { a.assoc = g.id; g.assoc = a.id; }
      }
    },
    addMessage(m) { msgs.push(m); }, messages: () => msgs, clear() { map.clear(); msgs = []; },
  };
}
