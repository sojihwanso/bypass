/* 선박 운동: 자선(Nomoto 1차 선회 + 속력 1차 지연 + 오토파일럿), 타선(구간 스크립트), 센서 */
import { wrap360, angDiff, D2R } from './geo.js';

/* 40K Bulk Carrier (교재 6-1 실습선 급).
   K0: FA(14 kn)에서 타 35°일 때 정상 선회 지름 ≈ 3.5L(약 665 m)이 되도록 정함 (r = Kδ, R = V/r).
   K는 속력에 비례(K = K0·V/V0)해 선회 반경이 속력과 거의 무관하게 함.
   T: 선회 응답 시정수(무차원 T' = T·V/L ≈ 1.7, 비대선 범위). rudderRate 3.6°/s: ECDIS 앱과 같음(SOLAS 28 s 이내). */
export const SHIP_40K = { L: 190, B: 32, antH: 25, K: 0.0354, T: 45, V0: 14, maxRudder: 35, rudderRate: 3.6, speedTau: 180, maxRpm: 105 };

export const TELEGRAPH = [
  { k: 'FAH', kn: -7 }, { k: 'HAH', kn: -5 }, { k: 'SAH', kn: -3.5 }, { k: 'DSAH', kn: -2 },
  { k: 'STOP', kn: 0 }, { k: 'DSA', kn: 5 }, { k: 'SA', kn: 8 }, { k: 'HA', kn: 11 }, { k: 'FA', kn: 14 },
];
const MAX_DT = 0.25;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createShip({ lat, lon, hdg = 0, tele = TELEGRAPH.findIndex((t) => t.k === 'FA'), spec = SHIP_40K }) {
  const kn = TELEGRAPH[tele].kn;
  return {
    lat, lon, hdg: wrap360(hdg), rot: 0, r: 0, rudder: 0, rudderOrder: 0, tele, stw: kn, sog: Math.abs(kn), cog: wrap360(kn < 0 ? hdg + 180 : hdg),
    rpm: (kn / spec.V0) * spec.maxRpm, auto: { on: false, setHdg: wrap360(hdg) }, spec,
  };
}
export function setRudderOrder(s, deg) { s.rudderOrder = clamp(deg, -s.spec.maxRudder, s.spec.maxRudder); }
export function setTelegraph(s, idx) { s.tele = clamp(idx, 0, TELEGRAPH.length - 1); }
export function setAuto(s, on, setHdg = s.hdg) { s.auto.on = !!on; s.auto.setHdg = wrap360(setHdg); }

/* 위치 적분: 속도(kn) 성분을 위경도로 */
function move(o, vx, vy, dt) {
  const h = dt / 3600;
  o.lat += (vy * h) / 60;
  o.lon += (vx * h) / (60 * Math.cos(o.lat * D2R));
}

export function stepShip(s, dt, env = { set: 0, drift: 0 }) {
  dt = Math.min(dt, MAX_DT);
  if (dt <= 0) return;
  const sp = s.spec;
  if (s.auto.on) { // PD 오토파일럿: 침로 오차와 선회 각속도
    const e = angDiff(s.auto.setHdg, s.hdg);
    s.rudderOrder = s.stw < 0.5 ? 0 : clamp(1.5 * e - 40 * s.r, -20, 20); // 후진·정지 중에는 타가 반대로 듣거나 안 들으므로 타 중앙(발산 방지)
  }
  const dr = s.rudderOrder - s.rudder, step = sp.rudderRate * dt;
  s.rudder = Math.abs(dr) <= step ? s.rudderOrder : s.rudder + Math.sign(dr) * step;
  const tk = TELEGRAPH[s.tele].kn, target = Math.sign(tk) * Math.max(0, Math.abs(tk) - (env.loss || 0)); // 높은 파도: 속력 손실
  s.stw += (target - s.stw) * (1 - Math.exp(-dt / sp.speedTau));
  s.rpm = (target / sp.V0) * sp.maxRpm;
  const K = sp.K * (s.stw / sp.V0);
  s.r += ((K * s.rudder - s.r) / sp.T) * dt; // °/s
  s.hdg = wrap360(s.hdg + s.r * dt);
  s.rot = s.r * 60; // °/min
  const vx = s.stw * Math.sin(s.hdg * D2R) + env.drift * Math.sin(env.set * D2R);
  const vy = s.stw * Math.cos(s.hdg * D2R) + env.drift * Math.cos(env.set * D2R);
  s.sog = Math.hypot(vx, vy);
  if (s.sog > 1e-9) s.cog = wrap360(Math.atan2(vx, vy) / D2R);
  move(s, vx, vy, dt);
}

/* 타선: legs[i].t(초)가 되면 hdg·kn 목표를 바꾸고 최대 30°/min으로 선회 */
export function createTarget({ id, lat, lon, hdg, kn, L = 150, rcs = null, hAnt = 20, h = null, ais = true, legs = [], behavior = 'scripted', name = '', mmsi = null, cls = 'A' }) {
  return { id, lat, lon, hdg: wrap360(hdg), kn, L, rcs, hAnt, h: h ?? Math.max(3, L / 10), ais, legs: [...legs].sort((a, b) => a.t - b.t), behavior, name, mmsi, cls, want: { hdg: wrap360(hdg), kn }, sog: kn, cog: wrap360(hdg), rot: 0 };
}
/* cur = 조류 {set, drift}: 모든 배가 같이 밀리므로(자선도) 상대 운동은 그대로, 대지 침로·속력(COG·SOG)만 바뀜 */
export function stepTarget(g, dt, tNow, cur = null) {
  dt = Math.min(dt, 1);
  for (const lg of g.legs) if (tNow >= lg.t) { g.want.hdg = wrap360(lg.hdg); g.want.kn = lg.kn; }
  const e = angDiff(g.want.hdg, g.hdg), maxTurn = 0.5 * dt; // 30°/min
  const turn = clamp(e, -maxTurn, maxTurn);
  g.hdg = wrap360(g.hdg + turn); g.rot = (turn / dt) * 60;
  g.kn += clamp(g.want.kn - g.kn, -0.05 * dt, 0.05 * dt);
  let vx = g.kn * Math.sin(g.hdg * D2R), vy = g.kn * Math.cos(g.hdg * D2R);
  if (cur && cur.drift > 0) { vx += cur.drift * Math.sin(cur.set * D2R); vy += cur.drift * Math.cos(cur.set * D2R); }
  g.sog = Math.hypot(vx, vy); g.cog = cur && cur.drift > 0 ? wrap360(Math.atan2(vx, vy) / D2R) : g.hdg;
  move(g, vx, vy, dt);
}

/* 센서: 자이로 오차(°), LOG 오차(%), GPS 잡음(m, rnd 0..1 두 개로 정규분포 근사) */
export function sensors(s, err = { gyro: 0, logPct: 0, gpsM: 5 }, rnd = Math.random) {
  let dLat = 0, dLon = 0;
  if (err.gpsM > 0) {
    const g = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rnd()))) * Math.cos(2 * Math.PI * rnd());
    dLat = (g() * err.gpsM) / 1852 / 60;
    dLon = (g() * err.gpsM) / 1852 / 60 / Math.cos(s.lat * D2R);
  }
  return { hdg: wrap360(s.hdg + err.gyro), stw: s.stw * (1 + err.logPct / 100), sog: s.sog, cog: s.cog, lat: s.lat + dLat, lon: s.lon + dLon, rot: s.rot };
}
