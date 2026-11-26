/* 충돌 회피 시나리오 5개 + 자유 항해, 기록·평가(순수 계산)
   합격 = 모든 상대선과의 실제 최소 거리 ≥ 0.3 NM, 충돌·좌초 없음. TCPA·조치 시점은 기록만(사용자 결정).
   상대선 위치는 '자선이 그대로 가면 tc분 뒤 부딪히는 점'에서 거꾸로 계산한다. */
import { makeProj, velXY, cpaTcpa, brgRng, angDiff, wrap360 } from './geo.js';
import { createShip, createTarget, stepShip, stepTarget, TELEGRAPH } from './sim.js';
import { pointInLand } from './coast.js';

export const PASS_NM = 0.3;
const tele = (k) => TELEGRAPH.findIndex((x) => x.k === k);
/* 자선 (lat,lon,hdg,kn)이 tc분 동안 직진한 점 + 오프셋(오른쪽 +NM)에 tc분 뒤 도착하는 상대선의 시작 위치 */
function collide(own, { tcMin, hdg, kn, side = 0 }) {
  const P = makeProj(own.lat, own.lon), h = tcMin / 60, ov = velXY(own.hdg, own.kn), tv = velXY(hdg, kn);
  const rx = Math.cos(own.hdg * Math.PI / 180) * side, ry = -Math.sin(own.hdg * Math.PI / 180) * side; // 오른쪽 수직 방향
  const x = ov.vx * h + rx - tv.vx * h, y = ov.vy * h + ry - tv.vy * h;
  return { lat: P.lat(y), lon: P.lon(x), hdg, kn };
}
const T = (own, id, o) => ({ id, name: o.name, mmsi: o.mmsi, L: o.L ?? 150, rcs: o.rcs ?? null, h: o.h ?? null, ais: o.ais ?? true, cls: o.cls || 'A', legs: o.legs || [], ...collide(own, o) });

const O1 = { lat: 33.45, lon: 124.55, hdg: 0, kn: 14 };
const O2 = { lat: 33.35, lon: 124.4, hdg: 20, kn: 14 };
const O3 = { lat: 33.55, lon: 124.45, hdg: 90, kn: 14 };
const O4 = { lat: 33.4, lon: 124.65, hdg: 0, kn: 14 };
const O5 = { lat: 34.52, lon: 125.29, hdg: 0, kn: 11 };

export const SCENARIOS = [
  { id: 'S1', ko: '마주치는 상태', en: 'Head-on situation', rule: '14', durationMin: 25,
    brief: { ko: '맑은 낮, 넓은 바다입니다. 정선수 쪽에서 큰 배 한 척이 거의 반대 침로로 다가와요. 상대선은 피하지 않습니다. 레이더를 켜고 EBL·VRM과 TT로 위험을 확인한 뒤, 제14조에 따라 우현으로 피하세요.', en: 'Clear day, open sea. A large vessel approaches nearly reciprocal, dead ahead, and will not give way. Switch on the radar, confirm risk with EBL/VRM and TT, then alter to starboard under Rule 14.' },
    own: { ...O1, tele: tele('FA') }, weather: { sea: 2, windFrom: 30, windMs: 6, rain: [] }, aids: [],
    targets: [T(O1, 'h1', { name: 'OCEAN PIONEER', mmsi: 440211000, tcMin: 18, hdg: 181, kn: 12, L: 200 }), T(O1, 'n1', { name: '', tcMin: 14, hdg: 120, kn: 4, L: 14, rcs: 5, h: 3, ais: false, side: -2.6 })] },
  { id: 'S2', ko: '우현 횡단선 · 본선 피항선', en: 'Crossing from starboard · give-way', rule: '15·16', durationMin: 30,
    brief: { ko: '우현 앞쪽에서 화물선이 횡단해 와요. 본선이 피항선입니다. TT로 포착해 벡터가 안정될 때까지(약 1분) 기다린 뒤, Trial maneuver로 피항 계획을 확인하고 크게, 일찍 우현으로 피해 상대선 선미 쪽으로 지나가세요.', en: 'A cargo ship crosses from your starboard bow; you are the give-way vessel. Acquire it, wait for a stable vector, check a trial manoeuvre, then make an early, substantial alteration to starboard and pass astern.' },
    own: { ...O2, tele: tele('FA') }, weather: { sea: 3, windFrom: 60, windMs: 9, rain: [] }, aids: [],
    targets: [T(O2, 'c1', { name: 'HANBADA STAR', mmsi: 440322000, tcMin: 20, hdg: 300, kn: 13, L: 170 }), T(O2, 'n1', { name: '', tcMin: 16, hdg: 200, kn: 5, L: 16, rcs: 5, h: 3, ais: false, side: -2.6 })] },
  { id: 'S3', ko: '좌현 횡단선 · 본선 유지선', en: 'Crossing from port · stand-on', rule: '17', durationMin: 30,
    brief: { ko: '좌현 앞쪽에서 배가 횡단해 옵니다. 본선은 유지선이라 침로·속력을 지켜야 해요. 그런데 상대선이 피하지 않습니다. 언제 혼자서 피해야 할지(제17조) 판단하고, 이때 좌현으로 돌리지 마세요.', en: 'A vessel crosses from your port bow; you are the stand-on vessel and must keep course and speed. It does not give way. Decide when to act alone under Rule 17, and do not turn to port.' },
    own: { ...O3, tele: tele('FA') }, weather: { sea: 2, windFrom: 0, windMs: 5, rain: [] }, aids: [],
    targets: [T(O3, 'p1', { name: 'JINDO CARRIER', mmsi: 440433000, tcMin: 20, hdg: 30, kn: 12, L: 140 }), T(O3, 'n1', { name: '', tcMin: 12, hdg: 260, kn: 4, L: 12, rcs: 4, h: 3, ais: false, side: -2.8 })] },
  { id: 'S4', ko: '추월 · 여러 척', en: 'Overtaking · multiple ships', rule: '13', durationMin: 35,
    brief: { ko: '앞에 같은 방향으로 가는 느린 배를 추월하는 중이에요(본선이 추월선). 앞쪽에서 마주 오는 배와 우현에서 횡단하는 배도 있어요. 물표를 모두 포착하고, 진·상대 벡터를 바꿔 보며 누구를 먼저 피할지 정하세요.', en: 'You are overtaking a slower ship ahead. Another vessel approaches from ahead and a third crosses from starboard. Acquire all, switch between true and relative vectors, and decide your plan.' },
    own: { ...O4, tele: tele('FA') }, weather: { sea: 3, windFrom: 200, windMs: 8, rain: [] }, aids: [],
    targets: [T(O4, 'o1', { name: 'SLOW TRADER', mmsi: 440544000, tcMin: 26, hdg: 0, kn: 7, L: 120, side: 0.05 }), T(O4, 'o2', { name: 'NORTH WIND', mmsi: 440555000, tcMin: 16, hdg: 182, kn: 13, L: 180, side: -0.7 }), T(O4, 'o3', { name: 'SEA ROSE', mmsi: 440566000, tcMin: 22, hdg: 290, kn: 11, L: 110, side: 0.2 }), T(O4, 'n1', { name: '', tcMin: 18, hdg: 90, kn: 5, L: 15, rcs: 5, h: 3, ais: false, side: -2.8 })] },
  { id: 'S5', ko: '제한 시계 · 홍도 인근', en: 'Restricted visibility · off Hongdo', rule: '19', durationMin: 35, needsCoast: true, fixedWeather: true,
    brief: { ko: '홍도 동쪽 해역, 안개와 비로 눈으로는 아무것도 보이지 않아요. 레이더만으로 판단해야 합니다. Gain·Sea·Rain을 맞춰 반사가 약한 어선을 찾고, 정횡 앞쪽 배에 대해서는 좌현 변침을 피하세요(제19조). 안전한 속력도 생각하세요.', en: 'East of Hongdo in fog and rain; nothing is visible by eye. Tune gain, sea and rain to find a weak fishing boat, avoid turning to port for vessels forward of the beam (Rule 19), and keep a safe speed.' },
    own: { ...O5, tele: tele('HA') }, weather: { kind: 'showers', fog: true, visNM: 0.5, sea: 3, windFrom: 220, windMs: 11, interference: true, rain: [{ lat: 34.62, lon: 125.36, rNM: 1.6, rate: 8 }, { lat: 34.70, lon: 125.27, rNM: 1.2, rate: 5 }] },
    aids: [{ type: 'racon', letter: 'K', lat: 34.6455, lon: 125.2235 }],
    marks: [{ type: 'buoy', lat: 34.6455, lon: 125.2235, name: 'RACON K' }],
    message: { from: 440700001, text: 'SECURITE · 홍도 동방 어구 설치 해역, 소형 어선 조업 중 / fishing gear and small fishing boats east of Hongdo' },
    targets: [T(O5, 'f1', { name: '', tcMin: 14, hdg: 265, kn: 3, L: 18, rcs: 6, h: 3, ais: false, side: 0.05 }), T(O5, 'x1', { name: 'GAGEO EXPRESS', mmsi: 440777000, tcMin: 24, hdg: 245, kn: 12, L: 150, side: 0.1 })] },
];

/* 자유 항해: 시드로 같은 배치를 다시 만듦 */
export function freeSetup({ lat = 33.5, lon = 124.6, nTargets = 4, sea = 2, rain = false, seed = 1 }) {
  let s = seed >>> 0 || 1; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const own = { lat, lon, hdg: 0, kn: 14 }, targets = [];
  for (let i = 0; i < nTargets; i++) targets.push(T(own, 'r' + i, { name: 'VESSEL ' + (i + 1), mmsi: 440900000 + i, tcMin: 12 + r() * 25, hdg: Math.round(r() * 360), kn: Math.round(6 + r() * 12), L: Math.round(60 + r() * 160), side: (r() - 0.5) * 3, ais: r() > 0.2 }));
  return { id: 'FREE', ko: '자유 항해', en: 'Free navigation', rule: '-', durationMin: 60, brief: { ko: '목표 없이 레이더를 자유롭게 연습해요.', en: 'Practise freely.' }, own: { ...own, tele: tele('FA') }, weather: { sea, windFrom: 0, windMs: 6, rain: rain ? [{ lat: lat + 0.05 + r() * 0.05, lon: lon + (r() - 0.5) * 0.1, rNM: 1.5, rate: 6 }] : [] }, aids: [], targets };
}

/* 기록: 1초마다 표본 */
export function createLog(scn) {
  const min = {}; let collision = false, grounding = false, first = null, own0 = null, t0Act = null, after = null;
  return {
    sample(w) {
      const o = w.own, P = makeProj(o.lat, o.lon), ov = velXY(o.cog ?? o.hdg, o.sog ?? o.stw);
      if (!own0) own0 = { hdg: o.hdg, tele: o.tele };
      let near = null;
      for (const g of w.targets) {
        const x = P.x(g.lon), y = P.y(g.lat), d = Math.hypot(x, y);
        if (!min[g.id] || d < min[g.id].nm) min[g.id] = { id: g.id, nm: d, t: w.t };
        if (d * 1852 < ((o.spec?.L ?? 190) + (g.L ?? 100)) / 2) collision = true;
        const c = cpaTcpa({ x: 0, y: 0 }, ov, { x, y }, velXY(g.cog ?? g.hdg, g.sog ?? g.kn));
        if (c.tcpa >= 0 && (!near || c.cpa < near.cpa)) near = { id: g.id, cpa: c.cpa, tcpa: c.tcpa, rng: d };
      }
      if (w.land && w.land.rings && w.land.rings.length && pointInLand(w.land.rings, o.lat, o.lon)) grounding = true;
      if (!first && (Math.abs(angDiff(o.hdg, own0.hdg)) > 5 || o.tele !== own0.tele)) { first = { t: w.t, tcpa: near ? near.tcpa : null, rng: near ? near.rng : null, dHdg: 0, dSpd: 0 }; t0Act = { hdg: o.hdg, stw: o.stw, t: w.t, hdg0: own0.hdg, stw0: o.stw }; }
      if (first && w.t - t0Act.t <= 300) { const dh = angDiff(o.hdg, t0Act.hdg0); if (Math.abs(dh) > Math.abs(first.dHdg)) first.dHdg = dh; first.dSpd = o.stw - (scnKn(scn) ?? o.stw); }
    },
    result() { const m = Object.values(min).sort((a, b) => a.nm - b.nm)[0] || null; return { minRange: m, collision, grounding, firstAction: first, scn }; },
  };
}
const scnKn = (scn) => (scn && scn.own ? TELEGRAPH[scn.own.tele]?.kn : null);

/* 평가: 합격 여부 + 해설(한국어/영어) */
export function evaluate(r) {
  const pass = !!r.minRange && r.minRange.nm >= PASS_NM && !r.collision && !r.grounding;
  const s = r.scn || {}, notes = [];
  const fa = r.firstAction;
  if (r.collision) notes.push({ ko: '충돌했어요. 상대선의 방위가 거의 변하지 않으면(같은 방위·거리 감소) 충돌 위험이 있어요(제7조).', en: 'Collision. A steady bearing with decreasing range means risk of collision (Rule 7).' });
  if (r.grounding) notes.push({ ko: '좌초했어요. 피항할 때도 주변 수심과 육지를 같이 봐야 해요.', en: 'Grounded. Check the surrounding land and depths when manoeuvring.' });
  if (s.rule === '14') notes.push({ ko: '제14조: 마주치는 상태에서는 두 배 모두 우현으로 변침해 서로 좌현을 마주 보고 지나가요.', en: 'Rule 14: in a head-on situation each vessel alters to starboard so they pass port to port.' });
  if (s.rule === '15·16') notes.push({ ko: '제15·16조: 상대선을 우현에 둔 배가 피항선이에요. 가능하면 상대선 선수 쪽을 지나지 말고, 일찍 크게 피하세요.', en: 'Rules 15-16: the vessel with the other on her starboard side keeps out of the way, avoids crossing ahead, and acts early and substantially.' });
  if (s.rule === '17') { notes.push({ ko: '제17조: 유지선은 침로·속력을 지키되, 피항선이 적절히 피하지 않으면 혼자서 피할 수 있어요. 충돌을 피할 수 없을 만큼 가까워지면 반드시 최선의 협력 동작을 해야 해요.', en: 'Rule 17: the stand-on vessel keeps course and speed but may act alone when the give-way vessel fails to act, and must act when collision can no longer be avoided by the give-way vessel alone.' });
    if (fa && fa.dHdg < -5) notes.push({ ko: '제17조(c): 좌현 쪽 횡단선에 대해 좌현으로 변침하면 안 돼요.', en: 'Rule 17(c): do not alter to port for a vessel on your own port side.' }); }
  if (s.rule === '13') notes.push({ ko: '제13조: 추월선은 추월이 끝날 때까지 피해야 해요. 다른 배와의 관계도 함께 보세요.', en: 'Rule 13: the overtaking vessel keeps out of the way until finally past and clear.' });
  if (s.rule === '19') { notes.push({ ko: '제19조: 제한 시계에서는 안전한 속력으로, 레이더로만 탐지한 정횡 앞쪽 배에 대해서는 좌현 변침을 피해요.', en: 'Rule 19: in restricted visibility proceed at a safe speed and avoid altering to port for a vessel detected by radar alone forward of the beam.' });
    if (fa && fa.dHdg < -5) notes.push({ ko: '좌현으로 변침했어요. 제19조(d)에서 피하라고 하는 동작이에요.', en: 'You altered to port, which Rule 19(d) says to avoid.' }); }
  notes.push({ ko: '참고(제8조): 피항 동작은 충분히 일찍, 상대선이 레이더로 알아볼 만큼 크게 하세요. 이번 평가에서 조치 시점은 기록만 하고 합격 조건에는 넣지 않았어요.', en: 'Note (Rule 8): act early and make alterations large enough to be readily apparent on radar. Timing is recorded but not graded here.' });
  return { ...r, pass, notes };
}

/* 시뮬레이션(테스트·검증용): actions = [{t, fn(own)}] 또는 [{when(world,{t:{rng}}), fn(own)}] 한 번씩 */
export function simulate(scn, actions = [], { rings = [], dt = 1 } = {}) {
  const own = createShip({ lat: scn.own.lat, lon: scn.own.lon, hdg: scn.own.hdg, tele: scn.own.tele });
  const targets = scn.targets.map((g) => createTarget(g)), w = { t: 0, own, targets, land: { rings } }, log = createLog(scn), done = new Set();
  for (let t = 0; t <= scn.durationMin * 60; t += dt) {
    w.t = t; const P = makeProj(own.lat, own.lon);
    let near = null; for (const g of targets) { const d = Math.hypot(P.x(g.lon), P.y(g.lat)); if (!near || d < near.rng) near = { rng: d, id: g.id }; }
    actions.forEach((a, i) => { if (done.has(i)) return; if ((a.t !== undefined && t >= a.t) || (a.when && a.when(w, { t: near }))) { a.fn(own); done.add(i); } });
    log.sample(w);
    for (let k = 0; k < dt / 0.25; k++) { stepShip(own, 0.25); for (const g of targets) stepTarget(g, 0.25, t + k * 0.25); }
  }
  return evaluate(log.result());
}
export { brgRng, wrap360 };
