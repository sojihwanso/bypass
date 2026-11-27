/* 레이더 영상 물리 (순수 계산, DOM 없음)
   rawLine: 한 방위 줄의 수신 세기(dB, 잡음 평균 ≈ 0 dB 근처)
   processLine: 수신기 처리(튜닝 → 이득 → STC(SEA) → FTC(RAIN) → IR → 잡음 제거 → EAV → ES) → 16단계 영상
   근거: 교재 2장(빔폭·펄스폭·분해능), 3장(레이더 방정식·수평선·거짓 상·레이콘), 매뉴얼 1.17~1.29·2장(거짓 상, SART, RACON) */
import { makeProj, wrap360, angDiff, D2R, NM_M } from './geo.js';

export const N_BRG = 2048;
export const RANGES = [0.125, 0.25, 0.5, 0.75, 1.5, 3, 6, 12, 24, 48, 96];
export const RING_INT = { 0.125: 0.025, 0.25: 0.05, 0.5: 0.1, 0.75: 0.25, 1.5: 0.25, 3: 0.5, 6: 1, 12: 2, 24: 4, 48: 8, 96: 16 };
export const BANDS = { X: { beamDeg: 1.2, lambdaCm: 3.2 }, S: { beamDeg: 1.8, lambdaCm: 10 } };
export const PULSES = { S1: 0.07, S2: 0.15, M1: 0.3, M2: 0.5, M3: 0.7, L: 1.2 };
/* 매뉴얼 부록 1 PULSE LENGTH 표 */
export const PULSE_BY_RANGE = { 0.125: ['S1'], 0.25: ['S1'], 0.5: ['S1', 'S2'], 0.75: ['S1', 'S2', 'M1'], 1.5: ['S1', 'S2', 'M1', 'M2'], 3: ['S2', 'M1', 'M2', 'M3'], 6: ['M1', 'M2', 'M3', 'L'], 12: ['M1', 'M2', 'M3', 'L'], 24: ['M2', 'M3', 'L'], 48: ['L'], 96: ['L'] };
export const PRF_BY_PULSE = { S1: 3000, S2: 3000, M1: 1500, M2: 1000, M3: 1000, L: 600 };
/* 표준 대기(k=4/3) 레이더 수평선 */
export const radarHorizonNM = (hAnt, hTgt) => 2.22 * (Math.sqrt(hAnt) + Math.sqrt(Math.max(0, hTgt)));
export const rangeResM = (pulseUs) => 150 * pulseUs;
export const unambNM = (prf) => 3e8 / (2 * prf) / NM_M;
export const sartDots = (r) => Array.from({ length: 12 }, (_, i) => r + 0.08 + i * 0.64);
const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', G: '--.', K: '-.-', M: '--', N: '-.', O: '---', Q: '--.-', T: '-', X: '-..-', Y: '-.--', Z: '--..' };
export function raconCode(letter) { const out = []; let r = 0; for (const c of MORSE[letter] || '-') { const len = c === '-' ? 0.24 : 0.08; out.push([r, r + len]); r += len + 0.08; } return out; }

const C_DB = 44; // 레이더 방정식 상수(교육용으로 물표를 6 dB 강하게): 100 m² 물표가 6 NM에서 약 33 dB
const SEA_K = -1.5; // 해면 반사 세기 보정(원래 0, 교육용 −7에서 사용자 요청으로 −1.5)
const THR0 = 42; // 수신 문턱 = THR0 − 0.4·GAIN (원래 40과 교육용 44의 중간: 잡음이 조금 더 일찍 보임)
const LAND_CELL = 0.03, LAND_HALF = 40; // 육지 격자(NM)
const defaultRcs = (L) => 0.05 * L * L;

/* ---- 빠른 난수·잡음표 ---- */
function rng32(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const NOISE_DB = new Float32Array(4096);
{ const r = rng32(12345); for (let i = 0; i < 4096; i++) NOISE_DB[i] = 10 * Math.log10(Math.max(1e-6, -Math.log(Math.max(1e-9, r())))); }
const hash = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x7f4a7c15) | 0, 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

/* ---- 육지 격자(스캔라인 채움) ---- */
function buildLandGrid(rings, proj, ox, oy) {
  const x0 = ox - LAND_HALF, y0 = oy - LAND_HALF, n = Math.ceil((2 * LAND_HALF) / LAND_CELL);
  const g = { x0, y0, cell: LAND_CELL, n, data: new Uint8Array(n * n), any: false };
  for (const r of rings) {
    const m = r.length / 2, xs = new Float64Array(m), ys = new Float64Array(m);
    let ymin = 1e9, ymax = -1e9;
    for (let i = 0; i < m; i++) { xs[i] = (proj.x(r[i * 2]) - x0) / LAND_CELL; ys[i] = (proj.y(r[i * 2 + 1]) - y0) / LAND_CELL; if (ys[i] < ymin) ymin = ys[i]; if (ys[i] > ymax) ymax = ys[i]; }
    const r0 = Math.max(0, Math.floor(ymin)), r1 = Math.min(n - 1, Math.ceil(ymax));
    if (r1 < r0) continue;
    const rows = Array.from({ length: r1 - r0 + 1 }, () => []);
    for (let i = 0, j = m - 1; i < m; j = i++) {
      const ya = ys[j], yb = ys[i]; if (ya === yb) continue;
      const lo = Math.max(r0, Math.ceil(Math.min(ya, yb) - 0.5)), hi = Math.min(r1, Math.floor(Math.max(ya, yb) - 0.5));
      for (let row = lo; row <= hi; row++) { const yc = row + 0.5; if ((ya > yc) === (yb > yc)) continue; rows[row - r0].push(xs[j] + ((yc - ya) * (xs[i] - xs[j])) / (yb - ya)); }
    }
    for (let k = 0; k < rows.length; k++) {
      const xsr = rows[k].sort((a, b) => a - b), base = (k + r0) * n;
      for (let p = 0; p + 1 < xsr.length; p += 2) { const a = Math.max(0, Math.ceil(xsr[p] - 0.5)), b = Math.min(n - 1, Math.floor(xsr[p + 1] - 0.5)); for (let c = a; c <= b; c++) { g.data[base + c] = 1; g.any = true; } }
    }
  }
  return g;
}
const landAt = (g, x, y) => { const c = Math.floor((x - g.x0) / g.cell), r = Math.floor((y - g.y0) / g.cell); return c >= 0 && r >= 0 && c < g.n && r < g.n ? g.data[r * g.n + c] : 0; };
const landDb = (R) => 64 - 30 * Math.log10(R + 0.5);

/* ---- 장면 ---- */
export function buildScene({ own, targets = [], land = { rings: [], heightM: 100 }, weather = {}, aids = [], band = 'X', pulse = 'M1', seed = 1 }) {
  const sc = { band, pulse, seed, land, weather: { sea: 0, windFrom: 0, rain: [], ducting: false, interference: false, ...weather }, aids, scan: 0, t: 0, cache: {} };
  sc.proj = makeProj(own.lat, own.lon);
  sc.grid = land.rings && land.rings.length ? buildLandGrid(land.rings, sc.proj, 0, 0) : null;
  updateScene(sc, own, targets, 0);
  return sc;
}

export function updateScene(sc, own, targets, t) {
  sc.own = own; sc.t = t; sc.scan = Math.floor(t / 2.5);
  sc.ox = sc.proj.x(own.lon); sc.oy = sc.proj.y(own.lat);
  if (sc.grid && Math.hypot(sc.ox - sc.grid.x0 - LAND_HALF, sc.oy - sc.grid.y0 - LAND_HALF) > 15) sc.grid = buildLandGrid(sc.land.rings, sc.proj, sc.ox, sc.oy);
  const hz = (h) => radarHorizonNM(own.antH ?? 25, h) * (sc.weather.ducting ? 2.5 : 1);
  sc.tg = targets.map((g) => {
    const x = sc.proj.x(g.lon) - sc.ox, y = sc.proj.y(g.lat) - sc.oy, R = Math.hypot(x, y), brg = wrap360(Math.atan2(x, y) / D2R);
    const L = g.L ?? 100, aspect = angDiff(g.hdg ?? 0, brg), sa = Math.abs(Math.sin(aspect * D2R)), ca = Math.abs(Math.cos(aspect * D2R));
    const rcs = g.rcs ?? defaultRcs(L), Rm = Math.max(R, 0.02) * NM_M;
    return { id: g.id, R, brg, L, h: g.h ?? Math.max(3, L / 10), visible: R <= hz(g.h ?? Math.max(3, L / 10)),
      db0: 10 * Math.log10(rcs * (0.4 + 0.6 * sa)) - 40 * Math.log10(Math.max(R, 0.05)) + C_DB,
      depth: (L * ca + 20 * sa) / NM_M, angHalf: Math.atan((L * sa + 25 * ca) / 2 / Rm) / D2R };
  });
  sc.aidp = sc.aids.map((a) => { const x = sc.proj.x(a.lon) - sc.ox, y = sc.proj.y(a.lat) - sc.oy; return { ...a, R: Math.hypot(x, y), brg: wrap360(Math.atan2(x, y) / D2R) }; });
  sc.rainp = (sc.weather.rain || []).map((c) => ({ ...c, x: sc.proj.x(c.lon) - sc.ox, y: sc.proj.y(c.lat) - sc.oy }));
}

/* 거리칸별 미리 계산 */
function bins(sc, nBins, maxRng) {
  const k = nBins + '|' + maxRng;
  if (sc.cache.k !== k) {
    const dr = maxRng / nBins, R = new Float32Array(nBins), sea30 = new Float32Array(nBins);
    for (let i = 0; i < nBins; i++) { R[i] = (i + 0.5) * dr; sea30[i] = -30 * Math.log10(Math.max(R[i], 0.05)); }
    sc.cache = { k, dr, R, sea30, land: null, landKey: '', land2: null };
  }
  return sc.cache;
}

/* 육지 줄(방위별 지연 계산): 값 >0 육지 dB, -1 그림자, 0 바다 */
function landLine(sc, cb, bi, nBins, maxRng, offset) {
  const key = Math.round(sc.ox / 0.01) + ',' + Math.round(sc.oy / 0.01);
  const name = offset ? 'land2' : 'land';
  if (!cb[name] || cb[name + 'Key'] !== key) { cb[name] = new Array(N_BRG); cb[name + 'Key'] = key; }
  let L = cb[name][bi];
  if (L) return L;
  L = new Float32Array(nBins);
  const b = (bi / N_BRG) * 360 * D2R, sb = Math.sin(b), cbb = Math.cos(b), g = sc.grid;
  const hz = radarHorizonNM(sc.own.antH ?? 25, sc.land.heightM ?? 100) * (sc.weather.ducting ? 2.5 : 1);
  let inLand = 0, seen = false;
  for (let i = 0; i < nBins; i++) {
    const R = cb.R[i] + offset;
    if (R > hz) { if (seen) L[i] = -1; continue; }
    const isL = landAt(g, sc.ox + R * sb, sc.oy + R * cbb);
    if (isL) { const front = inLand < 0.15; L[i] = landDb(R) - (front ? 0 : 6) - (seen && !inLand ? 6 : 0) + 4 * (hash(i + bi * 7, 3) - 0.5); inLand += cb.dr; seen = true; }
    else { inLand = 0; if (seen) L[i] = -1; }
  }
  cb[name][bi] = L;
  return L;
}

/* PM 호: n개를 8.0~19.8 NM에 고르게, 손실 loss dB(0~10)만큼 각 폭이 줄고 바깥 호부터 사라짐 */
export function pmArcs(n = 5, loss = 0) {
  const out = [], f = Math.max(0, 1 - loss / 10);
  for (let k = 0; k < n; k++) { const r = n === 1 ? 8 : 8 + (11.8 * k) / (n - 1), half = 30 * f * (1 - (0.6 * k) / n) - (loss >= 10 ? 1 : 0); if (half > 0.5 && k < Math.ceil(n * f)) out.push({ r, half }); }
  return out;
}
export function rawLine(sc, brgIdx, nBins, maxRng) {
  const cb = bins(sc, nBins, maxRng), out = new Float32Array(nBins), brg = (brgIdx / N_BRG) * 360;
  const band = BANDS[sc.band] || BANDS.X, half = band.beamDeg / 2, pulseUs = PULSES[sc.pulse] || 0.3, pulseNM = rangeResM(pulseUs) / NM_M, pg = 10 * Math.log10(pulseUs / 0.3);
  const rel = wrap360(brg - (sc.own.hdg || 0)), mast = rel > 177 && rel < 183 ? -15 : 0;
  const W = sc.weather, R = cb.R, dr = cb.dr;
  // 잡음
  let rs = (Math.imul(sc.seed, 7919) + Math.imul(brgIdx, 104729) + Math.imul(sc.scan, 31) + 1) | 0;
  const nr = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; };
  for (let i = 0; i < nBins; i++) { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; out[i] = NOISE_DB[(rs >>> 20) & 4095]; }
  // 육지
  const land = sc.grid && sc.grid.any ? landLine(sc, cb, brgIdx, nBins, maxRng, 0) : null;
  // 해면 클러터
  if (W.sea > 0) {
    const ext = 0.6 + 0.7 * W.sea, k = 4.2 * W.sea + SEA_K + (sc.band === 'S' ? -8 : 0) + 3 * Math.cos((brg - W.windFrom) * D2R) + mast;
    for (let i = 0; i < nBins; i++) {
      if (R[i] > ext + 1) break;
      if (land && land[i] !== 0) continue;
      const v = k + cb.sea30[i] - (R[i] > ext ? (R[i] - ext) * 20 : 0) + NOISE_DB[(nr() * 4096) | 0];
      if (v > out[i]) out[i] = v;
    }
  }
  // 강우: 셀 안 반사 + 뒤쪽 감쇠
  let att = null;
  if (sc.rainp.length) {
    att = new Float32Array(nBins); const sb = Math.sin(brg * D2R), cbb = Math.cos(brg * D2R), bandK = sc.band === 'S' ? -20 : 0;
    let acc = 0;
    for (let i = 0; i < nBins; i++) {
      const x = R[i] * sb, y = R[i] * cbb; let rate = 0;
      for (const c of sc.rainp) if ((x - c.x) ** 2 + (y - c.y) ** 2 < c.rNM * c.rNM) rate += c.rate;
      if (rate > 0) { acc += (sc.band === 'S' ? 0.002 : 0.02) * rate * dr * 2; const v = 14 + 10 * Math.log10(rate) - 20 * Math.log10(R[i] + 0.5) + bandK + NOISE_DB[(nr() * 4096) | 0] * 0.7; if (v > out[i]) out[i] = v; }
      att[i] = acc;
    }
  }
  if (land) for (let i = 0; i < nBins; i++) if (land[i] > 0) { const v = land[i] + pg + mast - (sc.loss || 0); if (v > out[i]) out[i] = v; }
  // 물표
  const put = (r0, r1, db) => { let a = Math.max(0, Math.floor(r0 / dr)), b = Math.min(nBins - 1, Math.floor(r1 / dr)); for (let i = a; i <= b; i++) { if (land && land[i] !== 0) continue; const v = db - (att ? att[i] : 0); if (v > out[i]) out[i] = v; } };
  /* 물표 본체: 빔 가장자리(u→1)로 갈수록 거리 폭이 줄고 세기도 약해져 둥근 타원으로 보임(실제 영상처럼 각진 부채꼴이 아님) */
  const putOval = (r0, len, db, u) => { const hl = len / 2 + dr * 0.5, mid = r0 + len / 2, h = hl * Math.sqrt(Math.max(0, 1 - u * u)), a = Math.max(0, Math.floor((mid - h) / dr)), b = Math.min(nBins - 1, Math.floor((mid + h) / dr));
    for (let i = a; i <= b; i++) { if (land && land[i] !== 0) continue; const v0 = (R[i] - mid) / hl, w = u * u + v0 * v0; if (w > 1) continue; const v = db - 8 * w - (att ? att[i] : 0); if (v > out[i]) out[i] = v; } };
  const loss = sc.loss || 0;
  for (const t of sc.tg) {
    if (!t.visible || t.R > maxRng + 2) continue;
    const off = Math.abs(angDiff(brg, t.brg)), eff = Math.max(0, off - t.angHalf), db = t.db0 + pg + mast - loss + (sc.boost && sc.boost.has(t.id) ? 8 : 0) + 2 * (hash(t.R * 1000 | 0, sc.scan) - 0.5);
    if (eff <= half * 1.8) putOval(t.R, pulseNM + t.depth, db - 3 * (eff / half) ** 2, eff / (half * 1.8));
    else if (db > 50 && t.R < 3 && off < 12) put(t.R, t.R + pulseNM, db - 28); // 사이드로브 호
    if (eff <= half) {
      const relT = wrap360(t.brg - (sc.own.hdg || 0)), beam = Math.abs(Math.sin(relT * D2R));
      if (t.L >= 150 && t.R < 1.2 && beam > 0.8) { put(2 * t.R, 2 * t.R + pulseNM, db - 12); put(3 * t.R, 3 * t.R + pulseNM, db - 22); } // 다중 반사
    }
    if (db > 45 && t.R < 2 && Math.abs(angDiff(brg, wrap360((sc.own.hdg || 0) + 180))) <= half) put(t.R, t.R + pulseNM, db - 18); // 마스트 간접 반사
  }
  // 성능 감시(PM, 매뉴얼 1.49): 안테나 쪽 PM 장치가 만드는 호. 정상이면 8.0~19.8 NM 사이, 손실이 클수록 짧아지고 바깥 호부터 사라짐, 10 dB 손실이면 없음
  if (sc.pm && sc.pm.on) for (const a of pmArcs(sc.pm.arcs, sc.pm.loss)) { const off = Math.abs(angDiff(rel, sc.pm.relBrg)); if (off <= a.half) put(a.r, a.r + 0.12, 32 - 4 * (off / a.half) ** 2); }
  // SART(X 밴드만), RACON
  for (const a of sc.aidp) {
    const off = Math.abs(angDiff(brg, a.brg));
    if (a.type === 'sart' && sc.band === 'X' && a.R < 8 && (off <= half || (a.R < 1 && off < 15))) for (const d of sartDots(a.R)) put(d, d + 0.05, 30);
    if (a.type === 'racon' && a.R < 12 && off <= half) for (const [s, e] of raconCode(a.letter)) put(a.R + 0.05 + s, a.R + 0.05 + e, 30);
  }
  // 간섭(다른 선박 레이더): 이 스캔에 걸린 방위 줄에 무작위 점
  if (W.interference && (brgIdx & 1) === 0 && hash(brgIdx, sc.scan + 99) < 0.04) for (let i = 0; i < nBins; i++) if (hash(i, brgIdx + sc.scan * 4099) < 0.15) out[i] = Math.max(out[i], 25);
  // 2차 소인(덕팅 때 최대 탐지 거리 너머 육지)
  out.second = null;
  if (W.ducting && sc.grid && sc.grid.any) {
    const Ru = unambNM(PRF_BY_PULSE[sc.pulse] || 1500), L2 = landLine(sc, cb, brgIdx, nBins, maxRng, Ru);
    let s = null; for (let i = 0; i < nBins; i++) if (L2[i] > 0) { (s ||= new Float32Array(nBins))[i] = L2[i] + 8; }
    out.second = s;
  }
  return out;
}

/* 수신기 처리 → 0..15 단계 */
export function processLine(raw, c, ctx) {
  const n = raw.length, lv = new Uint8Array(n);
  if (!c.tx || c.gain <= 0) return lv;
  const v = new Float32Array(raw);
  if (raw.second && !c.secondRej) for (let i = 0; i < n; i++) if (raw.second[i] > v[i]) v[i] = raw.second[i];
  // 튜닝
  const tl = c.tune && !c.tune.auto ? 6 * ((c.tune.val - 50) / 40) ** 2 : 0;
  // IR: 바로 앞 방위 줄과 상관 없는 튐 제거
  const irM = [0, 12, 6, 3][c.ir | 0];
  if (irM && ctx.prevRaw) for (let i = 0; i < n; i++) { const p = Math.max(ctx.prevRaw[i], ctx.prevRaw.second && !c.secondRej ? ctx.prevRaw.second[i] : -99); if (v[i] > p + irM) v[i] = p + irM; }
  const dr = ctx.maxRng / n, ace = !!c.ace;
  // STC (SEA)
  const sea = c.sea || { auto: false, val: 0 }, seaAuto = sea.auto || ace;
  if (seaAuto) {
    const w = 8, ext = 0.6 + 0.7 * 6;
    const m = movingMean(v, w);
    for (let i = 0; i < n; i++) if ((i + 0.5) * dr < ext && m[i] > 2) v[i] -= (m[i] - 2) * (0.6 + 0.4 * sea.val / 100);
  } else if (sea.val > 0) {
    const Rs = 0.5 + 0.4 * (c.stcRange ?? 5), ex = (c.stcCurve ?? 3) / 3;
    for (let i = 0; i < n; i++) { const f = Math.max(0, 1 - ((i + 0.5) * dr) / Rs); if (f <= 0) break; v[i] -= (sea.val / 100) * 45 * f ** ex; }
  }
  // FTC (RAIN): 넓게 퍼진 반사를 빼서 앞 가장자리만 남김
  const rain = c.rain || { auto: false, val: 0 }, rv = rain.auto || ace ? Math.max(rain.val, 60) : rain.val;
  if (rv > 0) { const m = movingMean(v, 12); for (let i = 0; i < n; i++) if (m[i] > 2) v[i] -= (rv / 100) * (m[i] - 2); }
  // 문턱 → 단계
  const thr = THR0 - 0.4 * c.gain + tl + (ace ? 3 : 0);
  for (let i = 0; i < n; i++) { const d = v[i] - tl - thr; if (d > 0) lv[i] = Math.min(15, 1 + Math.floor(d / 3)); }
  if (c.wiper) for (let i = 0; i < n; i++) if (lv[i] <= c.wiper) lv[i] = 0;
  if (c.noiseRej || ace) for (let i = 1; i < n - 1; i++) if (lv[i] && !lv[i - 1] && !lv[i + 1] && lv[i] < 4) lv[i] = 0;
  // EAV: 앞 스캔(평균 전 값)과 상관 — 평균 결과를 다시 넘기면 0이 굳어 버림
  const pre = lv.slice(); 
  if (c.eav && ctx.prevScan) for (let i = 0; i < n; i++) { const p = ctx.prevScan[i]; lv[i] = c.eav === 1 ? (lv[i] + p) >> 1 : c.eav === 2 ? Math.min(lv[i], p) : Math.min(lv[i], p) && Math.max(lv[i], p); }
  // ES: 거리 방향 확대
  if (c.es) { const k = c.es; for (let i = n - 1; i >= 0; i--) for (let j = 1; j <= k && i - j >= 0; j++) if (lv[i - j] > lv[i]) lv[i] = lv[i - j]; }
  lv.pre = pre;
  return lv;
}
function movingMean(v, w) { const n = v.length, m = new Float32Array(n); let s = 0; for (let i = 0; i < Math.min(n, w); i++) s += v[i]; for (let i = 0; i < n; i++) { const a = i - w - 1, b = i + w; if (b < n) s += v[b]; if (a >= 0) s -= v[a]; const lo = Math.max(0, i - w), hi = Math.min(n - 1, i + w); m[i] = s / (hi - lo + 1); } return m; }

/* TT용 탐지(스캔마다 1회): 보이는 물표 중 문턱·클러터를 넘는 것만, 자선 기준 NM 좌표(x 동, y 북)에 측정 잡음을 얹어 돌려줌.
   물표 정체(id)는 넘기지 않음 — 추적기는 실제 ARPA처럼 위치만 봄 */
export function detect(sc, c, rnd = Math.random) {
  if (!c.tx || c.gain <= 0) return [];
  const g = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rnd()))) * Math.cos(2 * Math.PI * rnd());
  const band = BANDS[sc.band] || BANDS.X, pulseUs = PULSES[sc.pulse] || 0.3, pg = 10 * Math.log10(pulseUs / 0.3);
  const tl = c.tune && !c.tune.auto ? 6 * ((c.tune.val - 50) / 40) ** 2 : 0, thr = THR0 - 0.4 * c.gain + tl;
  const out = [];
  for (const t of sc.tg) {
    if (!t.visible) continue;
    const db = t.db0 + pg, sea = sc.weather.sea > 0 && t.R < 0.6 + 0.7 * sc.weather.sea + 1 ? 4.2 * sc.weather.sea + SEA_K + (sc.band === 'S' ? -8 : 0) - 30 * Math.log10(Math.max(t.R, 0.05)) : -99;
    const Rs = 0.5 + 0.4 * (c.stcRange ?? 5), stc = c.sea && !c.sea.auto && c.sea.val > 0 ? (c.sea.val / 100) * 45 * Math.max(0, 1 - t.R / Rs) ** ((c.stcCurve ?? 3) / 3) : 0;
    if (db - stc <= thr || db <= sea + 3) continue;
    /* 비(화면 영상과 같은 식): 물표까지 경로 감쇠, 물표 자리 비 반사. FTC는 넓은 반사를 (rv/100)·(평균−2)만큼 빼므로 비와 물표가 같이 내려감.
       FTC 뒤에도 비가 문턱을 넘고 물표가 비보다 10 dB 이상 세지 않으면 비에 묻혀 못 잡음 */
    if (sc.rainp.length) {
      const sb = Math.sin(t.brg * D2R), cb = Math.cos(t.brg * D2R), inR = (x, y) => { let r = 0; for (const q of sc.rainp) if ((x - q.x) ** 2 + (y - q.y) ** 2 < q.rNM * q.rNM) r += q.rate; return r; };
      let att = 0; for (let r = 0.025; r < t.R; r += 0.05) { const k = inR(r * sb, r * cb); if (k) att += (sc.band === 'S' ? 0.002 : 0.02) * k * 0.05 * 2; }
      const rate = inR(t.R * sb, t.R * cb), rv = c.rain && (c.rain.auto || c.ace) ? Math.max(c.rain.val, 60) : (c.rain ? c.rain.val : 0);
      if (rate > 0) {
        const rdb = 14 + 10 * Math.log10(rate) - 20 * Math.log10(t.R + 0.5) + (sc.band === 'S' ? -20 : 0), k = (rv / 100) * Math.max(0, rdb - 2);
        if (db - att - k - stc <= thr) continue;
        if (rdb - k - stc > thr && db - att - rdb < 10) continue;
      } else if (db - att - stc <= thr) continue;
    }
    if (sc.grid && sc.grid.any) { const sb = Math.sin(t.brg * D2R), cb = Math.cos(t.brg * D2R); let hid = false; for (let r = 0.05; r < t.R; r += 0.03) if (landAt(sc.grid, sc.ox + r * sb, sc.oy + r * cb)) { hid = true; break; } if (hid) continue; }
    const R = t.R + g() * (rangeResM(pulseUs) / 2 / NM_M), b = (t.brg + g() * (band.beamDeg / 6)) * D2R;
    out.push({ x: R * Math.sin(b), y: R * Math.cos(b), strength: db - thr });
  }
  return out;
}
