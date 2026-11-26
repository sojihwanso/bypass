/* 레이더 시뮬레이터 진입점: 세계(자선·타선·날씨) → 선박 운동 → 안테나 스윕 → 영상 → TT·AIS·경보 → PPI·위층·UI */
import { S, loadSettings, saveSettings, resetSettings, on } from './state.js';
import { createPPI } from './ppi.js';
import { buildScene, updateScene, rawLine, processLine, detect, N_BRG, RANGES, RING_INT, PULSE_BY_RANGE } from './echo.js';
import { createShip, createTarget, stepShip, stepTarget, sensors, setRudderOrder, setTelegraph, setAuto, TELEGRAPH } from './sim.js';
import { makeProj, brgRng, velXY, cpaTcpa, bcrBct, wrap360 } from './geo.js';
import { loadLand, pointInLand } from './coast.js';
import { createTools, createTrails, createRoute, inZone, anchorWatch, vrmTTG, toUnit } from './tools.js';
import { createTracker, trial } from './tt.js';
import { createAIS } from './ais.js';
import { createAlerts } from './alerts.js';
import { MENU, applyPreset, savedPresets, loadSavedPresets } from './menu.js';
import { initUI } from './ui.js';
import { initConning } from './conning.js';
import { initKeys, KEYMAP } from './keys.js';
import { drawOverlay } from './overlay.js';
import { t, lang } from './i18n.js';
import { initStart } from './start.js';
import { initHelp } from './help.js';
import { COL, piColor } from './overlay.js';
import { stepWeather, windDrift, speedLoss, weatherLabel } from './weather.js';

const TEST = new URLSearchParams(location.search).has('test');
loadSettings();
try { loadSavedPresets(JSON.parse(localStorage.getItem('radar-presets') || 'null')); } catch (e) {}
const app = document.getElementById('app');
const WARM_SEC = 5; // 실제 마그네트론 예열은 약 90 s — 시뮬레이터는 5 s로 줄임(도움말에 적음)
const DEFAULT_PULSE = { 0.125: 'S1', 0.25: 'S1', 0.5: 'S1', 0.75: 'S1', 1.5: 'S2', 3: 'M1', 6: 'M2', 12: 'M3', 24: 'L', 48: 'L', 96: 'L' };

/* ---------- 상태 ---------- */
let W = null, P = null, scene = null, tracker = createTracker({ max: 100 }), ais = createAIS(), tools = createTools(), trails = createTrails(), route = createRoute();
const realNow = () => performance.now() / 1000;
let alerts = createAlerts(realNow, () => (W ? W.t : 0));
const radar = { state: 'stby', warmLeft: 0 };
const V = { rangeNM: S.disp.rangeNM, orient: S.disp.orient, motion: S.disp.motion, hdg: 0, crs: 0, offset: { x: 0, y: 0 }, palette: S.disp.palette, videoColor: S.disp.videoColor, rings: S.disp.rings, hlHidden: false };
let antAcc = 0, paused = false, hiddenPause = false, speed = 1, ant = 0, last = performance.now(), frames = 0, prevRaw = null, prevScan = new Array(N_BRG);
let offCenter = null, tmOff = { x: 0, y: 0 }, cursor = null, selected = [], uiMode = null, rulerA = null, ruler = null, piOn = false, lastUser = performance.now(), trialSet = { course: 0, speed: 14 };
let logFn = null, onScenarioTick = null, coastScreen = null, coastKey = '';
const rnd = Math.random;
const SPEEDS = [1, 2, 4, 8, 16, 32], MARKS = ['tri', 'circle', 'square', 'cross', 'anchor'], MARK_SYM = { tri: '▲', circle: '○', square: '□', cross: '✕', anchor: '⚓' };
let markShape = 0, tgtSort = 'rng', tgtTimer = null;
let wxRun = null, wxPend = [], wxN = 0;

/* ---------- UI ---------- */
const actions = {};
const ui = initUI(app, actions);
const ppi = createPPI(ui.echoCanvas, ui.overCanvas);
const fit = () => { ui.relayout(); ppi.setShift(ui.shift(), ui.rmax()); ppi.resize(); coastKey = ''; };
fit(); addEventListener('resize', fit);
document.documentElement.dataset.theme = S.disp.palette;

/* ---------- 세계 ---------- */
/* def: {name, own:{lat,lon,hdg,tele}, targets:[createTarget 인자], weather, aids, marks, needsCoast, durationMin, t?} */
export function startWorld(def) {
  const own = createShip({ lat: def.own.lat, lon: def.own.lon, hdg: def.own.hdg, tele: def.own.tele ?? TELEGRAPH.findIndex((x) => x.k === 'FA') });
  own.antH = own.spec.antH;
  if (def.own.state) Object.assign(own, def.own.state, { spec: own.spec, auto: { ...def.own.state.auto } });
  W = { def, name: def.name || '', own, targets: def.targets.map((g) => (g.want ? { ...g, legs: [...(g.legs || [])], want: { ...g.want } } : createTarget(g))), weather: { sea: 0, windFrom: 0, windMs: 0, rain: [], ducting: false, interference: false, current: { set: 0, drift: 0 }, ...(def.weather || {}) }, aids: def.aids || [], marks: def.marks || [], t: def.t || 0, land: { rings: [], ok: false, heightM: 100 }, needsCoast: !!def.needsCoast };
  P = makeProj(def.own.lat, def.own.lon);
  tracker = createTracker({ max: 100 }); ais = createAIS(); alerts = createAlerts(realNow, () => W.t); tools = createTools(); route = createRoute(); trails.reset(V.rangeNM, S.disp.trails.mode);
  W.userMarks = []; selected = []; tmOff = { x: 0, y: 0 }; ruler = null; rulerA = null; uiMode = null; azZones = []; piOn = false; speed = 1; offCenter = null; prevScan = new Array(N_BRG); prevRaw = null; ppi.clear();
  scene = buildScene({ own: ownScene(), targets: W.targets, weather: W.weather, aids: W.aids, band: S.ctrl.band, pulse: S.ctrl.pulse, seed: (Math.random() * 1e6) | 0 });
  trialSet = { course: own.hdg, speed: own.stw };
  const bb = { lat0: def.own.lat - 0.6, lat1: def.own.lat + 0.6, lon0: def.own.lon - 0.75, lon1: def.own.lon + 0.75 };
  const myW = W;
  loadLand(bb).then((L) => { if (W !== myW) return; W.land = { rings: L.rings, ok: L.ok, tried: true, heightM: 100 }; if (L.ok) alerts.resolve('coastfail'); coastKey = ''; scene = buildScene({ own: ownScene(), targets: W.targets, land: W.land, weather: W.weather, aids: W.aids, band: S.ctrl.band, pulse: S.ctrl.pulse, seed: scene.seed }); if (!L.ok) alerts.raise('coastfail', 'C', lang() === 'en' ? 'Coastline data unavailable' : '해안선 데이터 없음'); });
  return W;
}
const ownScene = () => ({ lat: W.own.lat, lon: W.own.lon, hdg: W.own.hdg, antH: W.own.antH });
const ownXY = () => ({ x: P.x(W.own.lon), y: P.y(W.own.lat) });
function setSpeed(n) { if (SPEEDS.includes(n)) speed = n; }
/* 배에 미치는 바깥 힘: 조류 + (날씨 켬 또는 시나리오 고정 날씨일 때) 바람 표류·높은 파도 속력 손실 */
function shipEnv() {
  const c = W.weather.current || { set: 0, drift: 0 }, wxOn = S.sim.weatherOn || W.weather.fixed;
  if (!wxOn) return { set: c.set, drift: c.drift, loss: 0 };
  const w = windDrift(W.weather.windFrom || 0, W.weather.windMs || 0, W.own.hdg), D2 = Math.PI / 180;
  const vx = c.drift * Math.sin(c.set * D2) + w.drift * Math.sin(w.set * D2), vy = c.drift * Math.cos(c.set * D2) + w.drift * Math.cos(w.set * D2);
  return { set: wrap360(Math.atan2(vx, vy) / D2), drift: Math.hypot(vx, vy), loss: speedLoss(W.weather.sea || 0) };
}
function syncSceneWeather() { if (scene) Object.assign(scene.weather, W.weather); }
/* 물표 목록(TGT LIST): TT·AIS 전부, 정렬, 위험은 빨강, 줄 누르면 선택. 열려 있는 동안 1초마다 갱신 */
function tgtRows() {
  const o = W.own, ov = velXY(o.cog, o.sog), rows = [], f1 = (v, d = 1) => (v === null || v === undefined || !isFinite(v) ? '-' : v.toFixed(d));
  for (const g of tracker.targets()) { const r = relOf(g.x, g.y), tr = g.state === 'track'; rows.push({ id: g.id, name: 'TT ' + g.no + (g.assoc ? ' · AIS' : ''), brg: r.brg, rng: r.rng, crs: tr ? g.course : null, spd: tr ? g.speed : null, cpa: tr ? g.cpa : null, tcpa: tr ? g.tcpa : null, ais: !!g.assoc, danger: g.danger, state: g.state }); }
  for (const a of ais.list()) if (a.x !== undefined && a.status !== 'lost') rows.push({ id: 'A:' + a.id, name: a.name || String(a.mmsi || a.id), brg: a.brg, rng: a.rng, crs: a.cog, spd: a.sog, cpa: a.cpa, tcpa: a.tcpa, ais: true, danger: a.status === 'danger', state: a.status });
  const key = { rng: (x) => x.rng, cpa: (x) => (x.cpa ?? 1e9), tcpa: (x) => (x.tcpa === null || x.tcpa === undefined || x.tcpa < 0 ? 1e9 : x.tcpa) }[tgtSort];
  rows.sort((a, b) => key(a) - key(b));
  return { rows, f1 };
}
function openTgtList() {
  if (!W) return; const en = lang() === 'en', { rows, f1 } = tgtRows(), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const th = (k, ko, e) => `<button type="button" class="btn${tgtSort === k ? ' on' : ''}" data-act="tgtSort" data-sort="${k}">${en ? e : ko}</button>`;
  const body = `<div class="tgl-sort">${en ? 'Sort' : '정렬'} ${th('rng', '거리', 'Range')}${th('cpa', 'CPA', 'CPA')}${th('tcpa', 'TCPA', 'TCPA')}</div>
  <table class="tgl"><thead><tr><th>${en ? 'Target' : '물표'}</th><th>BRG</th><th>RNG</th><th>CRS</th><th>SPD</th><th>CPA</th><th>TCPA</th><th>AIS</th></tr></thead><tbody>${rows.map((x) => `<tr class="${x.danger ? 'danger' : ''}${selected.includes(x.id) ? ' sel' : ''}" data-act="tgtSel" data-id="${esc(x.id)}"><td>${esc(x.name)}</td><td>${f1(x.brg)}°</td><td>${f1(x.rng, 2)}</td><td>${x.crs === null ? '-' : f1(x.crs) + '°'}</td><td>${f1(x.spd)}</td><td>${f1(x.cpa, 2)}</td><td>${x.tcpa === null || x.tcpa === undefined ? '-' : f1(x.tcpa)}</td><td>${x.ais ? '●' : '—'}</td></tr>`).join('') || `<tr><td colspan="8">${en ? 'No targets' : '물표가 없어요'}</td></tr>`}</tbody></table>`;
  const d = ui.dialog(en ? 'Target list' : '물표 목록', body);
  clearInterval(tgtTimer); tgtTimer = setInterval(() => { if (!d.open) { clearInterval(tgtTimer); return; } openTgtList(); }, 1000);
}
function weatherTick(run) {
  if (!wxRun) return;
  const ev = stepWeather(wxRun, W.weather, run, W.own);
  if (ev.length || W.weather.rain.length) syncSceneWeather();
  for (const e of ev) { const id = 'wx:' + (++wxN); alerts.raise(id, 'C', lang() === 'en' ? e.en : e.ko); wxPend.push({ id, t: W.t + 60 }); }
  wxPend = wxPend.filter((p) => { if (W.t < p.t) return true; alerts.resolve(p.id); return false; });
}
function freeDef(o = {}) {
  const lat = o.lat ?? 34.35, lon = o.lon ?? 125.6, Pq = makeProj(lat, lon), at = (b, r) => ({ lat: Pq.lat(r * Math.cos(b * D)), lon: Pq.lon(r * Math.sin(b * D)) });
  return { name: o.name || '', own: { lat, lon, hdg: o.hdg ?? 0, tele: o.tele }, targets: (o.targets || []).map((x, i) => ({ id: x.id || 't' + i, ...at(x.brg, x.rng), hdg: x.hdg, kn: x.kn, L: x.L ?? 120, ais: x.ais ?? true, name: x.name || 'SHIP ' + (i + 1), legs: x.legs || [] })), weather: o.weather || { sea: 2 }, aids: o.aids || [] };
}
const D = Math.PI / 180;

/* ---------- 레이더 송신 ---------- */
function setRadar(s) { radar.state = s; radar.warmLeft = s === 'warm' ? WARM_SEC : 0; S.ctrl.tx = s === 'tx'; if (s !== 'tx') ppi.clear(); }
function toggleTx() { setRadar(radar.state === 'stby' ? 'warm' : 'stby'); }

/* ---------- 프레임 ---------- */
function frame(now) { frameAt(now); requestAnimationFrame(frame); }
function frameAt(now) { const dt = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now; tick(dt); }
function tick(dt) {
  frames++;
  if (!W) return;
  if (radar.state === 'warm') { radar.warmLeft -= dt; if (radar.warmLeft <= 0) setRadar('tx'); }
  const run = paused || hiddenPause ? 0 : dt * speed;
  // 물리: 0.2 s 이하로 나눠 적분
  const n = Math.ceil(run / 0.2), env = shipEnv();
  for (let i = 0; i < n; i++) { const h = run / n; W.t += h; stepShip(W.own, h, env); for (const g of W.targets) stepTarget(g, h, W.t); }
  if (run > 0) weatherTick(run);
  if (run > 0 && onScenarioTick) onScenarioTick(W, run);
  if (run > 0 && logFn) logFn(W);
  V.hdg = W.own.hdg; V.rangeNM = S.disp.rangeNM; V.orient = S.disp.orient; V.motion = S.disp.motion; V.palette = S.disp.palette; V.videoColor = S.disp.videoColor; V.colorSet = S.disp.colorSet; V.rings = S.disp.rings;
  if (V.orient !== 'CU') V.crs = W.own.hdg;
  // TM: 자선이 화면에서 움직이고, 가장자리 가까우면 되돌림
  if (V.motion === 'TM') {
    const v = velXY(W.own.cog, W.own.sog), up = V.orient === 'NU' ? 0 : V.crs, a = -up * D, sx = v.vx * Math.cos(a) + v.vy * Math.sin(a), sy = -v.vx * Math.sin(a) + v.vy * Math.cos(a);
    tmOff.x += (sx * run / 3600) / V.rangeNM; tmOff.y -= (sy * run / 3600) / V.rangeNM;
    if (Math.hypot(tmOff.x, tmOff.y) > 0.7) { const m = Math.hypot(sx, sy) || 1; tmOff = { x: -0.5 * sx / m, y: 0.5 * sy / m }; }
    V.offset = { ...tmOff };
  } else V.offset = offCenter ? { ...offCenter } : { x: 0, y: 0 };
  scene.band = S.ctrl.band; scene.pulse = S.ctrl.pulse;
  updateScene(scene, ownScene(), W.targets, W.t);
  // 안테나 스윕(실시간 2.5 s/회전)
  // 버퍼 거리는 오프셋 크기와 상관없이 고정(매 프레임 바뀌면 PPI가 매번 지워짐) — 오프셋 최대 0.75 R
  const bufR = V.rangeNM * (V.motion === 'TM' || offCenter ? 1.75 : 1);
  antAcc += (dt / 2.5) * N_BRG; const nl = Math.floor(antAcc); antAcc -= nl; const oxy = ownXY(), trailOn = S.disp.trails.time > 0, tl = S.disp.trails.level;
  for (let k = 0; k < nl; k++) {
    const bi = (ant + k) & (N_BRG - 1), raw = rawLine(scene, bi, 512, bufR);
    const lv = processLine(raw, S.ctrl, { brgIdx: bi, prevRaw, prevScan: prevScan[bi], maxRng: bufR, nBins: 512 });
    prevRaw = raw; prevScan[bi] = lv.pre || lv; ppi.writeLine(bi, lv);
    if (trailOn && S.ctrl.tx) { const b = (bi / N_BRG) * 360 * D, sb = Math.sin(b), cb = Math.cos(b), dr = bufR / 512, rel = S.disp.trails.mode === 'REL';
      for (let i = S.disp.trails.suppressOS ? 40 : 2; i < 512; i += 2) if (lv[i] >= tl + 1) { const r = (i + 0.5) * dr; rel ? trails.mark(r * sb, r * cb, W.t) : trails.mark(oxy.x + r * sb, oxy.y + r * cb, W.t); } }
    if (bi === N_BRG - 1 && run > 0) onScan();
  }
  ant = (ant + nl) & (N_BRG - 1);
  ppi.setPersistence(S.disp.persistence);
  ppi.render(V, bufR);
  drawOverlay(ui.overCanvas, ppi, V, overlayModel());
  if (frames % 6 === 0) refreshUI();
  if (frames % 30 === 0) beep();
}

/* 한 바퀴마다: 탐지 → TT, AIS, 경보 */
function onScan() {
  if (!W) return;
  const o = W.own, ov = velXY(o.cog, o.sog), own = { ...ownXY(), ...ov };
  tracker.setLimits(S.tt.cpa, S.tt.tcpa, S.tt.cpaOn); tracker.setPastInterval(S.tt.pastInt);
  const dets = S.ctrl.tx ? detect(scene, S.ctrl, rnd) : [];
  tracker.update(dets, own, W.t);
  ais.setLimits(S.tt.cpa, S.tt.tcpa, S.tt.cpaOn);
  ais.update(W.targets, { lat: o.lat, lon: o.lon, sog: o.sog, cog: o.cog }, W.t);
  ais.associate(tracker.targets(), { rng: 0.1, spd: 2, crs: 15 }, (la, lo) => ({ x: P.x(lo), y: P.y(la) }));
  // 경보
  const en = lang() === 'en';
  for (const g of tracker.targets()) {
    if (g.danger) alerts.raise('cpa:' + g.id, 'A', `CPA/TCPA TT${g.no}`); else alerts.resolve('cpa:' + g.id);
    const far = S.tt.lostFilter && Math.hypot(g.x - own.x, g.y - own.y) > S.tt.lostMaxRng;
    if (g.state === 'lost' && !far) alerts.raise('lost:' + g.id, 'W', `LOST TT${g.no}`);
  }
  for (const a of ais.list()) { if (a.status === 'danger' && !a.assoc) alerts.raise('acpa:' + a.id, 'A', `CPA/TCPA AIS ${a.name}`); else alerts.resolve('acpa:' + a.id); }
  // 표적 경보 구역: 구역 안 영상(탐지)
  [0, 1].forEach((i) => {
    const z = tools.zones[i], onA = S.alert['ta' + (i + 1) + 'On'], mode = S.alert['ta' + (i + 1) + 'Mode'];
    if (!z || !onA) { alerts.resolve('ta' + i); return; }
    const inside = dets.some((d) => inZone(z, brgRng(0, 0, d.x, d.y)));
    if ((mode === 'IN' && inside) || (mode === 'OUT' && !inside && z.had)) alerts.raise('ta' + i, 'A', `TARGET ALARM ${i + 1}`); else alerts.resolve('ta' + i);
    z.had = inside;
  });
  if (S.alert.anchorOn && tools.anchor) { const a = { x: P.x(tools.anchor.lon), y: P.y(tools.anchor.lat) }; if (anchorWatch(a, S.alert.anchorR, ownXY())) alerts.raise('anchor', 'A', 'ANCHOR WATCH'); else alerts.resolve('anchor'); } else alerts.resolve('anchor');
  if (S.alert.watch > 0 && (performance.now() - lastUser) / 60000 > S.alert.watch) alerts.raise('watch', 'W', en ? 'WATCH ALERT: confirm watch' : '당직 경보: 확인해 주세요');
  if (W.needsCoast && W.land.tried && !W.land.ok) alerts.raise('coastfail', 'C', en ? 'Coastline data unavailable' : '해안선 데이터 없음');
}

/* ---------- 위층 모델 ---------- */
function relOf(x, y) { const o = ownXY(); return brgRng(o.x, o.y, x, y); }
function overlayModel() {
  const o = W.own, oxy = ownXY(), ov = velXY(o.cog, o.sog), vecRel = S.tt.vector === 'REL';
  const relV = (c, s) => { const v = velXY(c, s), rx = v.vx - ov.vx, ry = v.vy - ov.vy; return { course: wrap360(Math.atan2(rx, ry) / D), speed: Math.hypot(rx, ry) }; };
  let trialMap = null;
  if (S.tt.trialMode !== 'OFF') { trialMap = new Map(trial({ ...oxy, ...ov }, tracker.targets(), { course: trialSet.course, speed: trialSet.speed, delayMin: S.tt.trialDelay }).map((r) => [r.id, r])); }
  const tts = tracker.targets().filter((g) => !g.assoc || g.state !== 'track').map((g) => { const r = relOf(g.x, g.y);
    const pastS = g.past.slice(-S.tt.pastPts).map((q) => { const rr = relOf(q.x, q.y); return ppi.toScreen(rr.brg, rr.rng); });
    const tr = trialMap && trialMap.get(g.id);
    return { ...g, brg: r.brg, rng: r.rng, relVec: relV(g.course, g.speed), pastS, selected: selected.includes(g.id), trialDanger: tr && tr.cpa < S.tt.cpa && tr.tcpa >= 0 }; });
  const aisL = S.ais.disp ? ais.list({ maxRngOn: S.ais.maxRngOn, maxRng: S.ais.maxRng, minSpdOn: S.ais.minSpdOn, minSpd: S.ais.minSpd, exceptB: S.ais.exceptB }).filter((a) => a.x !== undefined).map((a) => ({ ...a, relVec: relV(a.cog, a.sog), selected: selected.includes('A:' + a.id) })) : [];
  const toBR = (lat, lon) => relOf(P.x(lon), P.y(lat));
  // 해안선(레이더 맵): 범위가 바뀌거나 자선이 움직이면 다시 투영
  let coast = null;
  if (S.disp.map.on && S.disp.map.coast && W.land.rings.length) {
    const key = [V.rangeNM, V.orient, Math.round(V.hdg), V.offset.x.toFixed(2), V.offset.y.toFixed(2), oxy.x.toFixed(2), oxy.y.toFixed(2), ppi.geom().R].join('|');
    if (key !== coastKey) { coastKey = key; coastScreen = W.land.rings.map((r) => { const pts = []; const step = Math.max(2, Math.floor(r.length / 2 / 400) * 2); for (let i = 0; i < r.length; i += step) { const q = toBR(r[i + 1], r[i]); pts.push(ppi.toScreen(q.brg, q.rng)); } return pts; }); }
    coast = coastScreen;
  }
  const grid = S.disp.grid ? latLonGrid() : null;
  return {
    own: { L: o.spec.L, B: o.spec.B, scaled: S.disp.osMark === 'SCALED', vec: { course: o.cog, speed: o.sog }, vecMin: S.tt.vecMin }, stern: S.disp.stern,
    trails: S.disp.trails.time > 0 ? { cell: trails.cell, multi: S.disp.trails.grad === 'MULTI', cells: (fn) => trails.forEach(W.t, S.disp.trails.time, (x, y, a) => (trails.mode === 'REL' ? fn(x, y, a) : fn(x - oxy.x, y - oxy.y, a))) } : null,
    coast, marks: S.disp.map.on && S.disp.map.marks ? W.marks.map((m) => ({ ...m, ...toBR(m.lat, m.lon) })) : null,
    route: S.disp.route ? route.wpts.map((w) => toBR(w.lat, w.lon)) : null,
    zones: [...tools.zones.filter(Boolean).map((z) => ({ ...z, kind: 'ta' })), ...(azZones.map((z) => ({ ...z, kind: 'az' })))],
    pi: piOn ? { n: S.disp.piMax, brg: tools.pi.brg, interval: tools.pi.interval, mode: S.disp.piMode } : null,
    ebl: tools.ebl.map((e) => ({ on: e.on, brgTrue: tools.eblTrue(tools.ebl.indexOf(e), o.hdg), origin: e.origin ? toBR(e.origin.lat, e.origin.lon) : null })),
    vrm: tools.vrm.map((v) => ({ on: v.on, rng: v.rng, origin: v.origin ? toBR(v.origin.lat, v.origin.lon) : null })),
    drops: tools.drops.map((d) => toBR(d.lat, d.lon)), userMarks: W.userMarks.map((k) => ({ ...k, ...toBR(k.lat, k.lon) })), iala: S.disp.iala, tts, ais: aisL, vecRel, vecMin: S.tt.vecMin, symColor: S.tt.symColor,
    trial: S.tt.trialMode !== 'OFF' ? trialSet : null, cursor, ruler, grid,
  };
}
function latLonGrid() {
  const rr = V.rangeNM * 1.6, dLat = rr / 60, step = [1, 2, 5, 10, 15, 30, 60].find((m) => (rr * 2) / m <= 8) / 60 || 1, lines = [];
  const la0 = Math.floor((W.own.lat - dLat) / step) * step, lo0 = Math.floor((W.own.lon - dLat * 1.3) / step) * step;
  for (let la = la0; la <= W.own.lat + dLat; la += step) { const l = []; for (let lo = W.own.lon - dLat * 1.4; lo <= W.own.lon + dLat * 1.4; lo += dLat / 20) l.push(relOf(P.x(lo), P.y(la))); lines.push(l); }
  for (let lo = lo0; lo <= W.own.lon + dLat * 1.3; lo += step) { const l = []; for (let la = W.own.lat - dLat; la <= W.own.lat + dLat; la += dLat / 20) l.push(relOf(P.x(lo), P.y(la))); lines.push(l); }
  return lines;
}
let azZones = [], refPt = 'CCRP';

/* ---------- UI 갱신 ---------- */
const pad = (n) => String(n).padStart(2, '0');
function refreshUI() {
  if (!W) return;
  const o = W.own, sn = sensors(o, { gyro: 0, logPct: 0, gpsM: 0 });
  const ov = velXY(o.cog, o.sog), oxy = ownXY();
  const slot = (id) => {
    if (!id) return null;
    if (id.startsWith('A:')) { const a = ais.list().find((x) => 'A:' + x.id === id); if (!a || a.x === undefined) return null; const r = { brg: a.brg, rng: a.rng }, bb = bcrBct({ x: 0, y: 0, ...ov }, { x: a.x, y: a.y, ...velXY(a.cog, a.sog) });
      return { label: `AIS ${a.name}`, brg: r.brg, rng: r.rng, cog: a.cog, sog: a.sog, cpa: a.cpa, tcpa: a.tcpa, bcr: bb.bcr, bct: bb.bct, danger: a.status === 'danger' }; }
    const g = tracker.targets().find((x) => x.id === id); if (!g) return null; const r = relOf(g.x, g.y), tr = g.state === 'track';
    return { label: `TT ${g.no}${g.assoc ? ' · AIS' : ''}${g.state === 'acq' ? ' (ACQ)' : g.state === 'lost' ? ' (LOST)' : ''}`, brg: r.brg, rng: r.rng, cog: tr ? g.course : null, sog: tr ? g.speed : null, cpa: tr ? g.cpa : null, tcpa: tr ? g.tcpa : null, bcr: tr ? g.bcr : null, bct: tr ? g.bct : null, danger: g.danger };
  };
  const top = alerts.top(), el = W.t, d = new Date();
  const cur = cursor && cursorInfo(cursor);
  ui.refresh({
    mark: { on: uiMode === 'mark', sym: MARK_SYM[MARKS[markShape]] },
    wx: { on: S.sim.weatherOn || !!W.weather.fixed, label: weatherLabel(W.weather, lang()) },
    rangeNM: V.rangeNM, ringInt: RING_INT[V.rangeNM], orient: V.orient, motion: V.motion, tx: radar.state, warmLeft: radar.warmLeft, speed, paused: paused || hiddenPause, offCenter: !!offCenter, piOn, azOn: azZones.length > 0, connOn: conn && conn.shown,
    own: { hdg: sn.hdg, stw: sn.stw, sog: sn.sog, cog: sn.cog, rot: o.rot, lat: sn.lat, lon: sn.lon }, clock: `${pad(d.getHours())}:${pad(d.getMinutes())}`, elapsed: `${pad((el / 3600) | 0)}:${pad(((el % 3600) / 60) | 0)}:${pad((el % 60) | 0)}`,
    cursor: cur, ebl: tools.ebl.map((e, i) => ({ on: e.on, brg: S.disp.eblRef === 'REL' ? wrap360(tools.eblTrue(i, o.hdg) - o.hdg) : tools.eblTrue(i, o.hdg) })),
    vrm: tools.vrm.map((v) => ({ on: v.on, rng: toUnit(v.rng, S.disp.vrmUnit), ttg: S.disp.vrmTTG && v.on ? vrmTTG(v.rng, o.sog) : null })),
    tgt: [slot(selected[0]), slot(selected[1])], ttN: tracker.targets().filter((g) => g.state !== 'lost').length, aisN: ais.list().filter((a) => a.status !== 'lost').length,
    alertTop: top ? { ...top, time: `${pad(((top.tSim % 86400) / 3600) | 0)}:${pad(((top.tSim % 3600) / 60) | 0)}:${pad((top.tSim % 60) | 0)}` } : null, alertN: alerts.list().length, scnName: W.name, msgN: ais.messages().length, ref: refPt, piText: `${tools.pi.brg.toFixed(0).padStart(3, '0')}° · ${tools.pi.interval} NM`, watchLeft: S.alert.watch ? (() => { const s = Math.max(0, S.alert.watch * 60 - (performance.now() - lastUser) / 1000); return `${pad((s / 60) | 0)}:${pad((s % 60) | 0)}`; })() : '',
  });
  conn && conn.refresh();
  const tb = document.getElementById('bxTrial'); if (tb) { tb.hidden = S.tt.trialMode === 'OFF'; tb.querySelector('#trC').textContent = trialSet.course.toFixed(0).padStart(3, '0') + '°'; tb.querySelector('#trS').textContent = trialSet.speed.toFixed(1) + ' kn'; tb.querySelector('#trD').textContent = S.tt.trialDelay + ' min'; }
}
function cursorInfo(c) {
  const p = ppi.fromScreen(c.x, c.y), o = W.own, rel = S.disp.cursorBrg === 'REL', oxy = ownXY(), x = oxy.x + p.rng * Math.sin(p.brg * D), y = oxy.y + p.rng * Math.cos(p.brg * D);
  return { brg: rel ? wrap360(p.brg - o.hdg) : p.brg, rel, rng: p.rng, lat: P.lat(y), lon: P.lon(x), ttg: vrmTTG(p.rng, o.sog) };
}

/* ---------- 경보음 ---------- */
let actx = null;
const shouldBeep = () => !(paused || hiddenPause) && S.alert.volume !== 'OFF' && alerts.sounding();
function beep() {
  if (TEST || !shouldBeep()) return;
  try { actx ||= new AudioContext(); const os = actx.createOscillator(), gn = actx.createGain(); os.frequency.value = 1050; gn.gain.value = { LOW: 0.04, MID: 0.09, HIGH: 0.18 }[S.alert.volume] || 0.09; os.connect(gn).connect(actx.destination); os.start(); os.stop(actx.currentTime + 0.18); } catch (e) {}
}

/* ---------- 조작 ---------- */
const own = () => W && W.own;
function rangeStep(d) { const i = RANGES.indexOf(S.disp.rangeNM); setRange(RANGES[Math.max(0, Math.min(RANGES.length - 1, i + d))]); }
function setRange(r) { S.disp.rangeNM = r; if (!PULSE_BY_RANGE[r].includes(S.ctrl.pulse)) S.ctrl.pulse = DEFAULT_PULSE[r]; trails.reset(r, S.disp.trails.mode, trails.mode === 'TRUE' ? trails.origin() : undefined); tmOff = { x: 0, y: 0 }; coastKey = ''; saveSettings(); }
function screenToWorld(pos) { const p = ppi.fromScreen(pos.sx ?? pos.x, pos.sy ?? pos.y), oxy = ownXY(); const x = oxy.x + p.rng * Math.sin(p.brg * D), y = oxy.y + p.rng * Math.cos(p.brg * D); return { ...p, x, y, lat: P.lat(y), lon: P.lon(x) }; }
function nearestTarget(pos, px = 16) {
  let best = null, bd = px; const s = (b, r) => ppi.toScreen(b, r), q = { x: pos.sx ?? pos.x, y: pos.sy ?? pos.y };
  for (const g of tracker.targets()) { const r = relOf(g.x, g.y), p = s(r.brg, r.rng), d = Math.hypot(p.x - q.x, p.y - q.y); if (d < bd) { bd = d; best = { kind: 'tt', id: g.id }; } }
  for (const a of ais.list()) if (a.x !== undefined) { const p = s(a.brg, a.rng), d = Math.hypot(p.x - q.x, p.y - q.y); if (d < bd) { bd = d; best = { kind: 'ais', id: a.id }; } }
  return best;
}
function select(id) { selected = [id, ...selected.filter((x) => x !== id)].slice(0, 2); }
function acquireAt(pos) {
  const w = screenToWorld(pos), id = tracker.acquire(w.x, w.y, W.t);
  if (!id) alerts.raise('ttfull', 'W', 'TT FULL'); else select(id);
  return id;
}
const PRESET_ORDER = ['NEAR', 'FAR', 'ROUGH SEA', 'SHIP', 'HARBOR', 'COAST', 'CUSTOM1', 'CUSTOM2', 'CUSTOM3'];
const TRAIL_ORDER = [0, 30, 180, 360, 900];
Object.assign(actions, {
  tx: toggleTx,
  band: () => { S.ctrl.band = S.ctrl.band === 'X' ? 'S' : 'X'; ppi.clear(); prevScan = new Array(N_BRG); prevRaw = null; saveSettings(); },
  mode: () => { const o = S.disp.motion === 'TM' ? ['CU', 'NU'] : ['HU', 'CU', 'NU']; S.disp.orient = o[(o.indexOf(S.disp.orient) + 1) % 3]; V.crs = W ? W.own.hdg : 0; tmOff = { x: 0, y: 0 }; ppi.clear(); saveSettings(); },
  motion: () => { S.disp.motion = S.disp.motion === 'RM' ? 'TM' : 'RM'; tmOff = { x: 0, y: 0 }; if (S.disp.motion === 'TM' && S.disp.orient === 'HU') S.disp.orient = 'NU'; saveSettings(); },
  off: () => { offCenter = offCenter ? null : { x: 0, y: 0.5 }; },
  preset: () => { const i = PRESET_ORDER.indexOf(S.ctrl.preset); applyPreset(S, PRESET_ORDER[(i + 1) % PRESET_ORDER.length]); saveSettings(); },
  trail: () => { const i = TRAIL_ORDER.indexOf(S.disp.trails.time); S.disp.trails.time = TRAIL_ORDER[(i + 1) % TRAIL_ORDER.length]; trails.reset(V.rangeNM, S.disp.trails.mode, S.disp.trails.mode === 'TRUE' ? ownXY() : undefined); saveSettings(); },
  pi: () => { piOn = !piOn; if (piOn) tools.pi.brg = Math.round(W.own.hdg); },
  az: () => { if (azZones.length) { azZones = []; tracker.setZones([]); } else uiMode = 'az1'; },
  mark: () => { if (uiMode === 'mark') markShape = (markShape + 1) % MARKS.length; uiMode = 'mark'; },
  tgtList: () => openTgtList(), tgtSort: (el) => { tgtSort = el.dataset.sort; openTgtList(); }, tgtSel: (el) => { select(el.dataset.id); openTgtList(); },
  pause: () => { paused = !paused; }, speed: () => ui.speedPop(SPEEDS, speed), spd: (el) => { setSpeed(+el.dataset.spd); ui.speedPop(null); },
  faster: () => setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)]), slower: () => setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)]),
  wx: () => { S.sim.weatherOn = !S.sim.weatherOn; saveSettings(); if (wxRun) wxRun.enabled = S.sim.weatherOn; if (!S.sim.weatherOn && W && !W.weather.fixed) { Object.assign(W.weather, { kind: 'clear', fog: false, sea: 1, windMs: 3, rain: [], ducting: false }); syncSceneWeather(); } },
  conn: () => conn.toggle(),
  shot: () => { const c = document.createElement('canvas'), a = ui.echoCanvas, b = ui.overCanvas; c.width = b.width; c.height = b.height; const g = c.getContext('2d'); g.fillStyle = '#0A131A'; g.fillRect(0, 0, c.width, c.height); g.drawImage(a, 0, 0, c.width, c.height); g.drawImage(b, 0, 0); const l = document.createElement('a'); l.download = `radar-${Date.now()}.png`; l.href = c.toDataURL('image/png'); l.click(); },
  rangeUp: () => rangeStep(1), rangeDn: () => rangeStep(-1),
  pulse: () => { const L = PULSE_BY_RANGE[S.disp.rangeNM], i = L.indexOf(S.ctrl.pulse); S.ctrl.pulse = L[(i + 1) % L.length]; },
  ebl1: () => { tools.ebl[0].on = !tools.ebl[0].on; if (tools.ebl[0].on && W) tools.ebl[0].brg = Math.round(W.own.hdg); }, ebl2: () => { tools.ebl[1].on = !tools.ebl[1].on; },
  vrm1: () => { tools.vrm[0].on = !tools.vrm[0].on; }, vrm2: () => { tools.vrm[1].on = !tools.vrm[1].on; },
  eblRef: () => { S.disp.eblRef = S.disp.eblRef === 'REL' ? 'TRUE' : 'REL'; saveSettings(); },
  ack: () => { const a = alerts.list().find((x) => !x.acked && x.pri !== 'C'); if (!a) return; /* 아직 확인 안 한 것 중 가장 급한 것 */ alerts.ack(a.id); if (a.id.startsWith('lost:')) { const id = a.id.slice(5); tracker.cancel(id); selected = selected.filter((x) => x !== id); alerts.resolve(a.id); } },
  silence: () => alerts.silence(),
  hlHold: (down) => { V.hlHidden = down; },
  cureset: () => { if (S.disp.orient === 'CU') V.crs = W.own.hdg; if (S.disp.motion === 'TM') { const v = velXY(W.own.cog, 1); tmOff = { x: -0.5 * v.vx, y: 0.5 * v.vy }; } ppi.clear(); },
  ownais: () => menuAction('ownData'), aismsg: () => menuAction('aisMsgs'),
  refpt: () => { refPt = refPt === 'CCRP' ? 'ANT' : 'CCRP'; },
  trial: () => { S.tt.trialMode = S.tt.trialMode === 'OFF' ? 'STATIC' : 'OFF'; if (S.tt.trialMode !== 'OFF' && W) trialSet = { course: W.own.hdg, speed: W.own.stw }; saveSettings(); },
  vecMode: () => { S.tt.vector = S.tt.vector === 'TRUE' ? 'REL' : 'TRUE'; saveSettings(); },
  alertList: () => { const rows = alerts.list().map((a) => `<tr><td>${a.pri}</td><td>${a.text}</td><td>${a.active ? (lang() === 'en' ? 'active' : '발생') : lang() === 'en' ? 'rectified' : '해소'}</td><td>${a.acked ? 'ACK' : '-'}</td></tr>`).join(''); ui.dialog(t('alert'), `<table class="tbl">${rows || `<tr><td>${t('noAlert')}</td></tr>`}</table>`, `<button class="btn" type="button" data-act="ackAll">${lang() === 'en' ? 'ACK all' : '모두 확인'}</button>`); },
  ackAll: () => { alerts.ackAll(); actions.alertList(); },
  help: () => { if (window.RadarHelp) window.RadarHelp(); },
  scn: () => { if (window.RadarStart) window.RadarStart(); },
  wheel: (k, d) => {
    if (k === 'range') return rangeStep(-d);
    if (k.startsWith('ebl')) { const e = tools.ebl[+k.slice(-1) - 1]; e.on = true; e.brg = wrap360(e.brg + d * (S.disp.eblRef === 'REL' ? 1 : 1) * 0.5); }
    if (k.startsWith('vrm')) { const v = tools.vrm[+k.slice(-1) - 1]; v.on = true; v.rng = Math.max(0, v.rng + d * Math.max(0.005, V.rangeNM / 200)); }
    if (k === 'trC') trialSet.course = wrap360(trialSet.course + d); if (k === 'trS') trialSet.speed = Math.max(0, Math.min(25, trialSet.speed + d * 0.5)); if (k === 'trD') S.tt.trialDelay = Math.max(0, Math.min(30, S.tt.trialDelay + d * 0.5));
  },
  cursor: (id, pos) => cursorAct(id, pos),
  menuAction: (id) => menuAction(id),
});
function cursorAct(id, pos) {
  if (!W) return; const w = screenToWorld(pos), near = nearestTarget(pos);
  if (id === 'acq') return acquireAt(pos);
  if (id === 'cancel') { if (near && near.kind === 'tt') { tracker.cancel(near.id); alerts.resolve('cpa:' + near.id); alerts.resolve('lost:' + near.id); selected = selected.filter((x) => x !== near.id); } return; }
  if (id === 'data') { if (near) select(near.kind === 'tt' ? near.id : 'A:' + near.id); return; }
  if (id === 'act') { if (near && near.kind === 'ais') { const a = ais.list().find((x) => x.id === near.id); a.status === 'sleep' ? ais.activate(near.id) : ais.sleep(near.id); } return; }
  if (id === 'ref') { if (near && near.kind === 'tt') { const sd = tracker.setReference(near.id); ui.dialog(lang() === 'en' ? 'Reference target' : '기준 물표', `<p>SET ${sd.set.toFixed(0)}° · DRIFT ${sd.drift.toFixed(1)} kn</p>`); } return; }
  if (id === 'ebl') { const e = tools.ebl[0]; e.on = true; e.origin = null; e.rel = false; e.brg = w.brg; return; }
  if (id === 'vrm') { const v = tools.vrm[0]; v.on = true; v.origin = null; v.rng = w.rng; return; }
  if (id === 'offEbl') { const e = tools.ebl[0], v = tools.vrm[0]; e.on = true; e.origin = { lat: w.lat, lon: w.lon }; v.origin = S.disp.eblStab ? { lat: w.lat, lon: w.lon } : null; return; }
  if (id === 'ruler') { rulerA = w; uiMode = 'ruler'; return; }
  if (id === 'off') { const G = ppi.geom(), R = G.R / G.dpr, cx = G.cx / G.dpr, cy = G.cy / G.dpr, ox = ((pos.sx ?? pos.x) - cx) / R, oy = ((pos.sy ?? pos.y) - cy) / R, m = Math.hypot(ox, oy); offCenter = m > 0.75 ? { x: (ox / m) * 0.75, y: (oy / m) * 0.75 } : { x: ox, y: oy }; return; }
  if (id === 'center') { offCenter = null; tools.ebl[0].origin = null; tools.vrm[0].origin = null; return; }
  if (id === 'markDel') { let bi = -1, bd = 20; W.userMarks.forEach((k, i) => { const q = relOf(P.x(k.lon), P.y(k.lat)), s = ppi.toScreen(q.brg, q.rng), d = Math.hypot(s.x - pos.x, s.y - pos.y); if (d < bd) { bd = d; bi = i; } }); if (bi >= 0) W.userMarks.splice(bi, 1); return; }
  if (id === 'drop') { tools.drops.push({ lat: w.lat, lon: w.lon }); if (tools.drops.length > 20) tools.drops.shift(); return; }
  if (id === 'anchor') { tools.anchor = { lat: W.own.lat, lon: W.own.lon }; S.alert.anchorOn = true; return; }
}
function menuAction(id) {
  const en = lang() === 'en';
  if (id === 'save') { saveSettings(); try { localStorage.setItem('radar-presets', JSON.stringify(savedPresets())); } catch (e) {} ui.dialog(en ? 'Settings' : '설정', `<p>${en ? 'Saved.' : '저장했습니다.'}</p>`); }
  if (id === 'load') { loadSettings(); ui.applyLang(); ui.applyTheme(); ui.renderMenu(); }
  if (id === 'reset') { resetSettings(); saveSettings(); ui.applyLang(); ui.applyTheme(); ui.renderMenu(); }
  if (id === 'ttCancelAll') { tracker.cancelAll(); selected = selected.filter((x) => x.startsWith('A:')); for (const a of alerts.list()) if (/^(cpa|lost):/.test(a.id)) { alerts.resolve(a.id); alerts.ack(a.id); } }
  if (id === 'sleepAll') ais.sleepAll();
  if (id === 'acqZone') { ui.closeAll(); uiMode = 'az1'; }
  if (id === 'aisMsgs') { const m = ais.messages(); ui.dialog(en ? 'Received AIS messages' : '받은 AIS 메시지', m.length ? m.map((x) => `<p><b>${x.from}</b> · ${x.text}</p>`).join('') : `<p>${en ? 'No messages.' : '받은 메시지가 없습니다.'}</p>`); }
  if (id === 'ownData') { const o = W.own; ui.dialog(en ? 'Own ship AIS data' : '자선 AIS 정보', `<dl class="kv"><dt>NAME</dt><dd>BYPASS TRAINER</dd><dt>CALL SIGN</dt><dd>D7BP</dd><dt>MMSI</dt><dd>440123000</dd><dt>COG</dt><dd>${o.cog.toFixed(1)}°</dd><dt>SOG</dt><dd>${o.sog.toFixed(1)} kn</dd><dt>HDG</dt><dd>${o.hdg.toFixed(1)}°</dd><dt>LOA × B</dt><dd>${o.spec.L} × ${o.spec.B} m</dd></dl>`); }
}
/* PPI 마우스: 커서·선택·구역·줄자 */
/* 밝기 단추 길게 누르기 → 색 조합 순환 */
{ const b = document.getElementById('qb_pal'), SETS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']; let tmr = null, long = false;
  b.addEventListener('pointerdown', () => { long = false; clearTimeout(tmr); tmr = setTimeout(() => { long = true; S.disp.colorSet = SETS[(SETS.indexOf(S.disp.colorSet) + 1) % SETS.length]; saveSettings(); }, 600); });
  for (const ev of ['pointerup', 'pointerleave']) b.addEventListener(ev, () => clearTimeout(tmr));
  b.addEventListener('click', (e) => { if (long) { e.stopImmediatePropagation(); long = false; } }, true); }
const ov = ui.overCanvas;
ov.addEventListener('pointermove', (e) => { const r = ov.getBoundingClientRect(); cursor = { x: e.clientX - r.left, y: e.clientY - r.top }; if (uiMode === 'ruler' && rulerA) { const b = screenToWorld(cursor), d = brgRng(rulerA.x, rulerA.y, b.x, b.y); ruler = { a: relOf(rulerA.x, rulerA.y), b: relOf(b.x, b.y), label: `${d.brg.toFixed(1)}° ${d.rng.toFixed(3)} NM` }; } });
ov.addEventListener('pointerleave', () => { cursor = null; });
ov.addEventListener('click', (e) => {
  if (!W) return; const r = ov.getBoundingClientRect(), pos = { x: e.clientX - r.left, y: e.clientY - r.top }, w = screenToWorld(pos);
  if (uiMode === 'az1') { azStart = w; uiMode = 'az2'; return; }
  if (uiMode === 'az2') { const a = azStart, z = { brg0: a.brg, brg1: w.brg, rng0: Math.min(a.rng, w.rng), rng1: Math.max(a.rng, w.rng) }; azZones = [...azZones, z].slice(-2); tracker.setZones(azZones); uiMode = null; return; }
  if (uiMode === 'mark') { if (W.userMarks.length < 50) W.userMarks.push({ lat: w.lat, lon: w.lon, shape: MARKS[markShape] }); uiMode = null; return; }
  if (uiMode === 'ruler') { uiMode = null; return; }
  if (uiMode === 'ta1' || uiMode === 'ta2') return;
  const near = nearestTarget(pos);
  if (near) { if (near.kind === 'ais') { const a = ais.list().find((x) => x.id === near.id); if (a.status === 'sleep') ais.activate(near.id); select('A:' + near.id); } else select(near.id); }
  else if (S.tt.select.startsWith('MANUAL') && e.detail === 2) acquireAt(pos);
});
let azStart = null;
on('settings', () => { V.palette = S.disp.palette; if (wxRun) wxRun.enabled = S.sim.weatherOn; saveSettings(); });
addEventListener('pointerdown', () => { lastUser = performance.now(); alerts.resolve('watch'); }, true);
addEventListener('keydown', () => { lastUser = performance.now(); alerts.resolve('watch'); }, true);
function setHidden(h) { hiddenPause = h; last = performance.now(); }
document.addEventListener('visibilitychange', () => setHidden(document.hidden));

/* Trial 상자 */
{ const tb = document.createElement('div'); tb.className = 'bx'; tb.id = 'bxTrial'; tb.hidden = true; tb.style.cssText = 'left:50%;bottom:44px;transform:translateX(-50%);display:flex;gap:12px;align-items:center';
  tb.innerHTML = '<span class="lb">TRIAL</span><span class="lb">CRS</span><span class="vv" id="trC" data-wheel="trC"></span><span class="lb">SPD</span><span class="vv" id="trS" data-wheel="trS"></span><span class="lb">DELAY</span><span class="vv" id="trD" data-wheel="trD"></span>';
  document.getElementById('ppiWrap').append(tb); }

/* ---------- Conning·키보드 ---------- */
const conn = initConning(document.getElementById('connSlot'), own, { wind: () => (W ? { dir: W.weather.windFrom, ms: W.weather.windMs } : null) });
const keyHandlers = {
  steerL: () => own() && (own().auto.on ? setAuto(own(), true, own().auto.setHdg - 1) : setRudderOrder(own(), own().rudderOrder - 5)),
  steerR: () => own() && (own().auto.on ? setAuto(own(), true, own().auto.setHdg + 1) : setRudderOrder(own(), own().rudderOrder + 5)),
  steerL10: () => own() && (own().auto.on ? setAuto(own(), true, own().auto.setHdg - 10) : setRudderOrder(own(), own().rudderOrder - 10)),
  steerR10: () => own() && (own().auto.on ? setAuto(own(), true, own().auto.setHdg + 10) : setRudderOrder(own(), own().rudderOrder + 10)),
  mid: () => own() && (setAuto(own(), false), setRudderOrder(own(), 0)),
  teleUp: () => own() && setTelegraph(own(), own().tele + 1), teleDn: () => own() && setTelegraph(own(), own().tele - 1),
  pause: () => { paused = !paused; }, faster: () => actions.faster(), slower: () => actions.slower(), ack: () => actions.ack(), rangeUp: () => rangeStep(1), rangeDn: () => rangeStep(-1),
  ebl1: () => actions.ebl1(), vrm1: () => actions.vrm1(),
  acqCursor: () => cursor && cursorAct('acq', cursor), cancelCursor: () => cursor && cursorAct('cancel', cursor),
  off: () => actions.off(), mode: () => actions.mode(), vecMode: () => { S.tt.vector = S.tt.vector === 'TRUE' ? 'REL' : 'TRUE'; saveSettings(); },
  hlHide: (down) => { V.hlHidden = down; }, conn: () => conn.toggle(),
  f1: () => applyPreset(S, S.ui.fkeys.F1), f2: () => applyPreset(S, S.ui.fkeys.F2), f3: () => applyPreset(S, S.ui.fkeys.F3), f4: () => applyPreset(S, S.ui.fkeys.F4),
  esc: () => { ui.closeAll(); uiMode = null; ruler = null; },
};
initKeys(keyHandlers);

/* ---------- 자동 저장(15 s)·이어 하기 ---------- */
const RESUME = 'radar-resume';
function snapshot() { const o = W.own; return { def: { ...W.def, t: W.t, own: { lat: o.lat, lon: o.lon, hdg: o.hdg, tele: o.tele, state: { stw: o.stw, sog: o.sog, cog: o.cog, rudder: o.rudder, rudderOrder: o.rudderOrder, r: o.r, rot: o.rot, auto: { ...o.auto } } }, targets: W.targets.map((g) => ({ ...g })), weather: W.weather }, radar: radar.state }; }
function saveNow() { if (!W) return; try { localStorage.setItem(RESUME, JSON.stringify(snapshot())); } catch (e) {} }
function resume() { try { const s = JSON.parse(localStorage.getItem(RESUME) || 'null'); if (!s || !s.def) return false; startWorld(s.def); setRadar('stby'); return true; } catch (e) { return false; } }
setInterval(() => { if (W && !paused) saveNow(); }, 15000);
addEventListener('pagehide', saveNow);

/* ---------- 외부 모듈(시나리오·도움말)이 쓸 창구 ---------- */
window.Radar = { startWorld, freeDef, setRadar, get world() { return W; }, setLog(fn) { logFn = fn; }, setScenarioTick(fn) { onScenarioTick = fn; }, alerts: () => alerts, ais: () => ais, tracker: () => tracker, route: () => route, tools: () => tools, saveNow, resume, hasResume: () => { try { return !!localStorage.getItem(RESUME); } catch (e) { return false; } }, setPaused: (p) => { paused = p; }, pointInLand, setWeatherRun: (r) => { wxRun = r; wxPend = []; } };

/* 빠른 진행(테스트·검증): 그리지 않고 물리·기록만 */
function tickSim(sec) { if (!W) return; const n = Math.ceil(sec / 0.25); for (let i = 0; i < n; i++) { if (paused) return; const h = sec / n; W.t += h; stepShip(W.own, h, shipEnv()); weatherTick(h); for (const g of W.targets) stepTarget(g, h, W.t); if (onScenarioTick) onScenarioTick(W, h); if (logFn) logFn(W); } }

/* 시작: 배경에 자유 항해를 띄우고 시나리오 화면을 연다 */
startWorld(freeDef({ targets: [{ brg: 40, rng: 4, hdg: 230, kn: 11 }, { brg: 300, rng: 5, hdg: 100, kn: 8 }] }));
setRange(S.disp.rangeNM);
const starter = initStart(ui);
initHelp();
requestAnimationFrame(frame);
if (!TEST) starter.openStart();
if (TEST) {
  window.RadarTest = {
    ready: true, S, ppi, scene: () => scene, colors: () => COL, piColor, selected: () => selected, menuPaths: () => MENU.flatMap((x) => x.items.map((i) => i.path)), menuOpts: (p) => (MENU.flatMap((x) => x.items).find((i) => i.path === p) || { opts: [] }).opts, setSpeed, speed: () => speed, proj: makeProj, view: () => V, setView: (o) => Object.assign(V, o), setRange: (r) => { S.disp.rangeNM = r; V.rangeNM = r; }, frames: () => frames, tick, frameAt, own, paused: () => paused || hiddenPause, setPaused: (p) => { paused = p; }, KEYMAP, keyHandlers,
    radar: { set: setRadar, toggle: toggleTx, get state() { return radar.state; }, get warmLeft() { return radar.warmLeft; } }, world: () => W, tracker: { targets: () => tracker.targets() },
    newWorld: (o) => startWorld(freeDef(o)), tgtScreen: (id) => { const g = W.targets.find((x) => x.id === id), r = relOf(P.x(g.lon), P.y(g.lat)), p = ppi.toScreen(r.brg, r.rng); return { sx: p.x, sy: p.y }; },
    cursorAct, select, refreshUI, onHidden: setHidden, saveNow, resume, alerts: () => alerts,
    startScenario: (id, o) => starter.startScenario(id, o), lastResult: () => starter.lastResult(), openStart: (o) => starter.openStart(o), finishNow: () => starter.finishNow(), shouldBeep, antenna: () => ant, relayout: () => { fit(); }, layoutMode: () => ui.layoutMode(), qbInside: () => ui.qbInside(), forceState: (o) => { if (o.az) { azZones = o.az; tracker.setZones(o.az); } if (o.speed) speed = o.speed; if (o.pi !== undefined) piOn = o.pi; }, uiState: () => ({ az: azZones.length > 0, speed, pi: piOn, off: !!offCenter }), tickSim, sim: { setAuto, setRudderOrder, setTelegraph }, menuItems: () => MENU.flatMap((m) => m.items.map((i) => (lang() === 'en' ? i.en : i.ko))),
  };
  setRadar('tx');
}
