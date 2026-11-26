/* TT(ARPA) 추적: 알파-베타 필터(초기엔 최소제곱 이득, 이후 하한) · CPA/TCPA · 자동 포착 · 분실 · Trial maneuver · 기준 물표
   근거: 교재 5장(3초마다 데이터 추출·평활화, 1분 경향/3분 정확), 매뉴얼 3장(포착 후 벡터 안정까지 지연, 3.17 Trial) */
import { cpaTcpa, bcrBct, brgRng, wrap360, D2R } from './geo.js';
import { inZone } from './tools.js';

const GATE = 0.3, GATE0 = 0.5, ACQ_SEC = 60, WIN = 150, MAN_KN = 3;
const courseOf = (vx, vy) => wrap360(Math.atan2(vx, vy) / D2R);

export function createTracker({ max = 100 } = {}) {
  let list = [], seq = 0, zones = [], cand = [], lim = { cpa: 2, tcpa: 12, on: true }, pastInt = 60, lastUpd = -Infinity;
  const live = () => list.filter((g) => g.state !== 'lost');
  function make(x, y, t, auto) {
    if (live().length >= max) return null;
    seq++; const g = { id: 'T' + seq, no: seq, x, y, vx: 0, vy: 0, fvx: 0, fvy: 0, meas: [], k: 0, t0: t, lastT: t, miss: 0, state: 'acq', auto: !!auto, past: [], lastPast: -1e9, course: 0, speed: 0, cpa: null, tcpa: null, bcr: null, bct: null, danger: false, ref: false };
    list.push(g); return g.id;
  }
  function update(dets, own, t) {
    if (t <= lastUpd) return; // 일시정지 중 같은 시각의 스캔은 무시(dt=0이면 필터 속도가 튐)
    lastUpd = t;
    const abs = dets.map((d) => ({ x: own.x + d.x, y: own.y + d.y, rel: d, used: false }));
    for (const g of list) {
      if (g.state === 'lost') continue;
      const dt = Math.max(1e-6, (t - g.lastT) / 3600), px = g.x + g.fvx * dt, py = g.y + g.fvy * dt;
      let best = null, bd = g.k < 3 ? GATE0 : GATE;
      for (const d of abs) if (!d.used) { const r = Math.hypot(d.x - px, d.y - py); if (r < bd) { bd = r; best = d; } }
      if (best) {
        best.used = true; g.k++;
        if (g.k === 1) { g.x = best.x; g.y = best.y; }
        else {
          const k = g.k, a = Math.max(0.15, (2 * (2 * k - 1)) / (k * (k + 1))), b = Math.max(0.01, 6 / (k * (k + 1)));
          const rx = best.x - px, ry = best.y - py; g.x = px + a * rx; g.y = py + a * ry; g.fvx += (b * rx) / dt; g.fvy += (b * ry) / dt;
        }
        g.miss = 0; g.meas.push({ t, x: best.x, y: best.y });
        while (g.meas.length && t - g.meas[0].t > WIN) g.meas.shift();
        lsVel(g);
        // 변침 감지: 필터 속도와 최소제곱 속도가 크게 다르면 최근 30 s만 남김
        if (g.k > 12 && Math.hypot(g.fvx - g.vx, g.fvy - g.vy) > MAN_KN) { while (g.meas.length > 2 && t - g.meas[0].t > 30) g.meas.shift(); lsVel(g); }
      } else { g.x = px; g.y = py; if (g.k > 0) g.miss++; }
      if (g.k < 2) { g.vx = g.fvx; g.vy = g.fvy; }
      g.lastT = t;
      g.state = g.miss >= 3 ? 'lost' : t - g.t0 >= ACQ_SEC ? 'track' : 'acq';
      g.course = courseOf(g.vx, g.vy); g.speed = Math.hypot(g.vx, g.vy);
      if (t - g.lastPast >= pastInt) { g.past.push({ x: g.x, y: g.y, t }); if (g.past.length > 10) g.past.shift(); g.lastPast = t; }
      const c = cpaTcpa(own, own, g, g), bb = bcrBct(own, g);
      g.cpa = c.cpa; g.tcpa = c.tcpa; g.bcr = bb.bcr; g.bct = bb.bct;
      g.danger = lim.on && g.state === 'track' && g.cpa < lim.cpa && g.tcpa >= 0 && g.tcpa <= lim.tcpa;
    }
    // 자동 포착: 구역 안의 쓰이지 않은 탐지가 2스캔 연속
    if (zones.length) {
      const next = [];
      for (const d of abs) {
        if (d.used) continue;
        const r = brgRng(0, 0, d.rel.x, d.rel.y);
        if (!zones.some((z) => z && inZone(z, r))) continue;
        const prev = cand.find((c) => Math.hypot(c.x - d.x, c.y - d.y) < GATE);
        if (prev && prev.t < t) { const id = make(d.x, d.y, t, true); if (id) { const g = list.find((q) => q.id === id); g.k = 1; } }
        else next.push({ x: d.x, y: d.y, t });
      }
      cand = next;
    }
  }
  return {
    acquire: (x, y, t) => make(x, y, t, false),
    cancel(id) { list = list.filter((g) => g.id !== id); },
    cancelAll() { list = []; },
    removeLost() { list = list.filter((g) => g.state !== 'lost'); },
    update, targets: () => list, setZones(z) { zones = z || []; cand = []; },
    setLimits(cpa, tcpa, on = true) { lim = { cpa, tcpa, on }; },
    setPastInterval(s) { pastInt = s; },
    get lostCount() { return list.filter((g) => g.state === 'lost').length; },
    setReference(id) { for (const g of list) g.ref = g.id === id; const g = list.find((q) => q.id === id); return g ? { set: wrap360(g.course + 180), drift: g.speed } : null; },
  };
}

/* 화면용 침로·속력: 창 안 측정값의 최소제곱 기울기(kn) */
function lsVel(g) {
  const m = g.meas, n = m.length; if (n < 2) return;
  let st = 0, sx = 0, sy = 0; for (const q of m) { st += q.t; sx += q.x; sy += q.y; } st /= n; sx /= n; sy /= n;
  let tt = 0, tx = 0, ty = 0; for (const q of m) { const d = q.t - st; tt += d * d; tx += d * (q.x - sx); ty += d * (q.y - sy); }
  if (tt < 1e-9) return; g.vx = (tx / tt) * 3600; g.vy = (ty / tt) * 3600;
}
/* 구간 [T0,T1](h) 동안 상대 운동 p + v·t 의 최소 거리 */
function segMin(px, py, vx, vy, T0, T1) {
  const vv = vx * vx + vy * vy; let t = vv < 1e-12 ? T0 : -(px * vx + py * vy) / vv; t = Math.max(T0, Math.min(T1, t));
  return { d: Math.hypot(px + vx * t, py + vy * t), t };
}
/* Trial maneuver(정적): delayMin 동안 현재 침로·속력, 그 뒤 새 침로·속력 */
export function trial(own, tts, { course, speed, delayMin = 0 }) {
  const d = delayMin / 60, nv = { vx: speed * Math.sin(course * D2R), vy: speed * Math.cos(course * D2R) };
  return tts.filter((g) => g.state !== 'lost').map((g) => {
    const px = g.x - own.x, py = g.y - own.y;
    const a = segMin(px, py, g.vx - own.vx, g.vy - own.vy, 0, d);
    const qx = px + (g.vx - own.vx) * d, qy = py + (g.vy - own.vy) * d, b = segMin(qx, qy, g.vx - nv.vx, g.vy - nv.vy, 0, 1e3);
    const best = d > 0 && a.d < b.d ? a : { d: b.d, t: b.t + d };
    return { id: g.id, cpa: best.d, tcpa: best.t * 60 };
  });
}
