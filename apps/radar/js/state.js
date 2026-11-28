/* 전역 상태 S · 설정 저장/불러오기 · 이벤트 버스 */
import { MENU } from './menu.js';
import { RANGES } from './echo.js';
export const DEFAULTS = {
  ctrl: {
    tx: false, band: 'X', pulse: 'M1', tune: { auto: true, val: 50 }, gain: 65,
    sea: { auto: false, val: 30 }, rain: { auto: false, val: 0 },
    ir: 2, es: 0, eav: 0, ace: false, noiseRej: false, secondRej: false,
    stcCurve: 3, stcRange: 5, wiper: 0, sart: false, preset: 'CUSTOM1', pmMode: 'OFF', pmArcs: 5, pmLoss: 0,
  },
  disp: {
    rangeNM: 6, wheelRange: false, orient: 'HU', motion: 'RM', rings: true, palette: 'day', videoColor: 'amber', colorSet: 'C1', iala: 'A',
    trails: { mode: 'REL', time: 180, grad: 'MULTI', level: 2, os: false, suppressOS: false },
    stern: false, osMark: 'SCALED', grid: false,
    map: { on: true, coast: true, marks: true, route: true }, route: true,
    eblRef: 'TRUE', vrmUnit: 'NM', vrmTTG: false, cursorBrg: 'TRUE',
    piMax: 3, piMode: 'PARALLEL', eblStab: 'GND', persistence: 2,
  },
  tt: {
    vector: 'TRUE', vecMin: 6, pastPts: 5, pastInt: 60, cpa: 2.0, tcpa: 12, cpaOn: true,
    select: 'MANUAL 50•AUTO 50', lostFilter: false, lostMaxRng: 12, refVector: false,
    trialMode: 'OFF', trialDelay: 1, trialTurnRate: 30, symColor: 'GRN',
  },
  ais: {
    disp: true, maxRngOn: true, maxRng: 12, minSpdOn: true, minSpd: 1.0, exceptB: false,
    cpaAutoOn: false, cpaAutoRng: 6, popup: true,
  },
  alert: {
    volume: 'MID', watch: 0, anchorOn: false, anchorR: 0.3,
    ta1On: false, ta1Mode: 'IN', ta2On: false, ta2Mode: 'IN', taLevel: 2,
  },
  sim: { level: 'easy', weatherOn: true },
  ui: { lang: 'ko', conning: { x: null, y: null, hidden: false }, speed: 1, fkeys: { F1: 'NEAR', F2: 'FAR', F3: 'ROUGH SEA', F4: 'HARBOR' } },
};
const clone = (o) => JSON.parse(JSON.stringify(o));
export const S = clone(DEFAULTS);
const KEY = 'radar-settings';
/* 기본값 구조에 맞는 값만 덮어씀 (기본값이 null이면 숫자도 허용) */
function merge(dst, def, src) {
  if (!src || typeof src !== 'object' || Array.isArray(src)) return;
  for (const k of Object.keys(def)) {
    if (!(k in src)) continue;
    const d = def[k], v = src[k];
    if (d && typeof d === 'object') merge(dst[k], d, v);
    else if (d === null ? (v === null || typeof v === 'number') : typeof v === typeof d) dst[k] = v;
  }
}
function reset() { const f = clone(DEFAULTS); for (const k of Object.keys(f)) S[k] = f[k]; }
/* 사이트 데이터가 막힌 브라우저는 localStorage를 읽기만 해도 예외가 남 → try 안에서 꺼냄 */
const store = (s) => (s !== undefined ? s : globalThis.localStorage);
const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const setP = (o, p, v) => { const ks = p.split('.'), l = ks.pop(); ks.reduce((a, k) => a[k], o)[l] = v; };
/* 형식은 맞아도 값이 범위 밖이면 기본값·범위로 */
function validate() {
  for (const it of MENU.flatMap((m) => m.items)) {
    if (!it.path) continue; const v = getP(S, it.path);
    if (it.type === 'enum' && !it.opts.some((o) => o.v === v)) setP(S, it.path, getP(DEFAULTS, it.path));
    if (it.type === 'num' && (typeof v !== 'number' || !isFinite(v))) setP(S, it.path, getP(DEFAULTS, it.path));
    else if (it.type === 'num') setP(S, it.path, Math.min(it.max, Math.max(it.min, v)));
  }
  if (!RANGES.includes(S.disp.rangeNM)) S.disp.rangeNM = DEFAULTS.disp.rangeNM;
  if (!['HU', 'CU', 'NU'].includes(S.disp.orient)) S.disp.orient = DEFAULTS.disp.orient;
  if (!['RM', 'TM'].includes(S.disp.motion)) S.disp.motion = DEFAULTS.disp.motion;
  if (!['none', 'easy', 'medium', 'hard'].includes(S.sim.level)) S.sim.level = DEFAULTS.sim.level;
  for (const k of ['gain']) S.ctrl[k] = Math.min(100, Math.max(0, S.ctrl[k]));
  for (const k of ['sea', 'rain', 'tune']) S.ctrl[k].val = Math.min(100, Math.max(0, S.ctrl[k].val));
}
export function loadSettings(storage) {
  reset();
  try { const st = store(storage), raw = st && st.getItem(KEY); if (raw) merge(S, DEFAULTS, JSON.parse(raw)); validate(); } catch (e) { reset(); }
}
/* 저장 직전 고치기(예: PM 시험 중에는 PM이 바꾼 값 대신 원래 설정을 저장) */
let saveFilter = null;
export const setSaveFilter = (f) => { saveFilter = f; };
export function saveSettings(storage) {
  try { const st = store(storage); let o = {}; for (const k of Object.keys(DEFAULTS)) o[k] = S[k]; if (saveFilter) o = saveFilter(JSON.parse(JSON.stringify(o))); st && st.setItem(KEY, JSON.stringify(o)); } catch (e) { /* 저장 불가 브라우저 */ }
}
export function resetSettings() { reset(); }
const bus = {};
export const on = (e, f) => { (bus[e] ||= []).push(f); };
export const emit = (e, d) => { for (const f of bus[e] || []) f(d); };
