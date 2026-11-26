/* 레이더 시뮬레이터 진입점 (작업 6: PPI 연결용 임시 루프 — 작업 13에서 전체 루프로 확장) */
import { S, loadSettings } from './state.js?v=1.0.0';
import { createPPI } from './ppi.js?v=1.0.0';
import { buildScene, updateScene, rawLine, processLine, N_BRG } from './echo.js?v=1.0.0';
import { createShip, createTarget, stepShip, stepTarget } from './sim.js?v=1.0.0';
import { makeProj } from './geo.js?v=1.0.0';

const TEST = new URLSearchParams(location.search).has('test');
loadSettings();
const app = document.getElementById('app');
app.innerHTML = '<div class="ppi-wrap"><canvas id="cvEcho"></canvas><canvas id="cvOver"></canvas></div>';
const ppi = createPPI(document.getElementById('cvEcho'), document.getElementById('cvOver'));
ppi.resize(); addEventListener('resize', () => ppi.resize());

const own = createShip({ lat: 34.6, lon: 125.0, hdg: 30 }); own.antH = 25;
const P = makeProj(own.lat, own.lon), at = (b, r) => ({ lat: P.lat(r * Math.cos(b * Math.PI / 180)), lon: P.lon(r * Math.sin(b * Math.PI / 180)) });
const targets = [createTarget({ id: 'a', ...at(40, 3), hdg: 210, kn: 12, L: 150 }), createTarget({ id: 'b', ...at(300, 4.5), hdg: 90, kn: 8, L: 60 })];
const scene = buildScene({ own: { lat: own.lat, lon: own.lon, hdg: own.hdg, antH: 25 }, targets, weather: { sea: 2 }, seed: 3 });
S.ctrl.tx = true;
const V = { rangeNM: S.disp.rangeNM, orient: S.disp.orient, motion: 'RM', hdg: own.hdg, crs: own.hdg, offset: { x: 0, y: 0 }, palette: S.disp.palette, videoColor: S.disp.videoColor };
let t = 0, ant = 0, last = performance.now(), frames = 0, prevRaw = null;
const prevScan = new Array(N_BRG);
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  tick(dt);
  requestAnimationFrame(frame);
}
function tick(dt) {
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
}
requestAnimationFrame(frame);
if (TEST) window.RadarTest = { ready: true, S, ppi, view: () => V, setView: (o) => Object.assign(V, o), setRange: (r) => { V.rangeNM = r; }, frames: () => frames, tick };
