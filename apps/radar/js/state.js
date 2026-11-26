/* 전역 상태 S · 설정 저장/불러오기 · 이벤트 버스 */
export const DEFAULTS = {
  ctrl: {
    tx: false, band: 'X', pulse: 'M1', tune: { auto: true, val: 50 }, gain: 65,
    sea: { auto: false, val: 30 }, rain: { auto: false, val: 0 },
    ir: 2, es: 0, eav: 0, ace: false, noiseRej: false, secondRej: false,
    stcCurve: 3, stcRange: 5, wiper: 0, sart: false, preset: 'CUSTOM1',
  },
  disp: {
    rangeNM: 6, orient: 'HU', motion: 'RM', rings: true, palette: 'day', videoColor: 'amber',
    trails: { mode: 'REL', time: 180, grad: 'MULTI', level: 2, os: false, suppressOS: false },
    stern: false, osMark: 'SCALED', grid: false,
    map: { on: true, coast: true, marks: true }, route: true,
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
export function loadSettings(storage = globalThis.localStorage) {
  reset();
  try { const raw = storage && storage.getItem(KEY); if (raw) merge(S, DEFAULTS, JSON.parse(raw)); } catch (e) { reset(); }
}
export function saveSettings(storage = globalThis.localStorage) {
  try { const o = {}; for (const k of Object.keys(DEFAULTS)) o[k] = S[k]; storage && storage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* 저장 불가 브라우저 */ }
}
export function resetSettings() { reset(); }
const bus = {};
export const on = (e, f) => { (bus[e] ||= []).push(f); };
export const emit = (e, d) => { for (const f of bus[e] || []) f(d); };
