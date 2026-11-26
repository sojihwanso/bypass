/* 레이더 시뮬레이터 진입점 (작업 6: PPI 연결용 임시 루프 — 작업 13에서 전체 루프로 확장) */
import { S, loadSettings } from './state.js';
import { createPPI } from './ppi.js';
import { buildScene, updateScene, rawLine, processLine, N_BRG } from './echo.js';
import { createShip, createTarget, stepShip, stepTarget } from './sim.js';
import { makeProj } from './geo.js';
import { initUI } from './ui.js';
import { RING_INT, RANGES } from './echo.js';
import { initConning } from './conning.js';
import { initKeys, KEYMAP } from './keys.js';
import { setRudderOrder, setTelegraph, setAuto } from './sim.js';

const TEST = new URLSearchParams(location.search).has('test');
loadSettings();
const app = document.getElementById('app');
const ui = initUI(app, { rangeUp: () => (V.rangeNM = 12), rangeDn: () => (V.rangeNM = 3) });
const ppi = createPPI(ui.echoCanvas, ui.overCanvas);
ppi.resize(); addEventListener('resize', () => ppi.resize());

const own = createShip({ lat: 34.6, lon: 125.0, hdg: 30 }); own.antH = 25;
const P = makeProj(own.lat, own.lon), at = (b, r) => ({ lat: P.lat(r * Math.cos(b * Math.PI / 180)), lon: P.lon(r * Math.sin(b * Math.PI / 180)) });
const targets = [createTarget({ id: 'a', ...at(40, 3), hdg: 210, kn: 12, L: 150 }), createTarget({ id: 'b', ...at(300, 4.5), hdg: 90, kn: 8, L: 60 })];
const scene = buildScene({ own: { lat: own.lat, lon: own.lon, hdg: own.hdg, antH: 25 }, targets, weather: { sea: 2 }, seed: 3 });
S.ctrl.tx = true;
const V = { rangeNM: S.disp.rangeNM, orient: S.disp.orient, motion: 'RM', hdg: own.hdg, crs: own.hdg, offset: { x: 0, y: 0 }, palette: S.disp.palette, videoColor: S.disp.videoColor };
let paused = false;
let t = 0, ant = 0, last = performance.now(), frames = 0, prevRaw = null;
const prevScan = new Array(N_BRG);
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  tick(dt);
  requestAnimationFrame(frame);
}
function tick(dt) {
  if (paused) dt = 0;
  t += dt; frames++;
  stepShip(own, dt); for (const g of targets) stepTarget(g, dt, t);
  updateScene(scene, { lat: own.lat, lon: own.lon, hdg: own.hdg, antH: 25 }, targets, t);
  V.hdg = own.hdg;
  const off = Math.hypot(V.offset.x, V.offset.y), bufR = V.rangeNM * (1 + off);
  const n = Math.round((dt / 2.5) * N_BRG);
  for (let k = 0; k < n; k++) {
    const bi = (ant + k) & (N_BRG - 1), raw = rawLine(scene, bi, 512, bufR);
    const lv = processLine(raw, S.ctrl, { brgIdx: bi, prevRaw, prevScan: prevScan[bi], maxRng: bufR, nBins: 512 });
    prevRaw = raw; prevScan[bi] = lv; ppi.writeLine(bi, lv);
  }
  ant = (ant + n) & (N_BRG - 1);
  ppi.render(V, bufR);
  if (frames % 6 === 0) ui.refresh({ rangeNM: V.rangeNM, ringInt: RING_INT[V.rangeNM] || 1, orient: V.orient, motion: V.motion, tx: 'tx', speed: 1, own: { hdg: own.hdg, stw: own.stw, sog: own.sog, cog: own.cog, rot: own.rot, lat: own.lat, lon: own.lon }, ebl: [{ on: false }, { on: false }], vrm: [{ on: false }, { on: false }], tgt: [], cursor: null });
}
requestAnimationFrame(frame);
const conn = initConning(document.body, () => own);
const rStep = (d) => { const i = RANGES.indexOf(V.rangeNM); V.rangeNM = RANGES[Math.max(0, Math.min(RANGES.length - 1, i + d))]; };
const keyHandlers = {
  steerL: () => (own.auto.on ? setAuto(own, true, own.auto.setHdg - 1) : setRudderOrder(own, own.rudderOrder - 5)),
  steerR: () => (own.auto.on ? setAuto(own, true, own.auto.setHdg + 1) : setRudderOrder(own, own.rudderOrder + 5)),
  steerL10: () => (own.auto.on ? setAuto(own, true, own.auto.setHdg - 10) : setRudderOrder(own, own.rudderOrder - 10)),
  steerR10: () => (own.auto.on ? setAuto(own, true, own.auto.setHdg + 10) : setRudderOrder(own, own.rudderOrder + 10)),
  mid: () => { setAuto(own, false); setRudderOrder(own, 0); },
  teleUp: () => setTelegraph(own, own.tele + 1), teleDn: () => setTelegraph(own, own.tele - 1),
  pause: () => { paused = !paused; }, ack: () => {}, rangeUp: () => rStep(1), rangeDn: () => rStep(-1),
  ebl1: () => {}, vrm1: () => {}, acqCursor: () => {}, cancelCursor: () => {}, off: () => {}, mode: () => {}, vecMode: () => {}, hlHide: () => {},
  conn: () => conn.toggle(), f1: () => {}, f2: () => {}, f3: () => {}, f4: () => {}, esc: () => ui.closeAll(),
};
initKeys(keyHandlers);
setInterval(() => conn.refresh(), 200);
if (TEST) window.RadarTest = { ready: true, S, ppi, view: () => V, setView: (o) => Object.assign(V, o), setRange: (r) => { V.rangeNM = r; }, frames: () => frames, tick, own: () => own, paused: () => paused, KEYMAP, keyHandlers };
