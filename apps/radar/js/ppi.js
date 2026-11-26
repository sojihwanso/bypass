/* PPI 그리기: 진방위 극좌표 버퍼(2048×512) → 화면 원. 방위 모드 회전은 정수 방위 칸 이동으로 처리해 매 프레임 가볍게.
   잔광: 줄마다 쓴 시각을 기억해 오래된 줄을 어둡게. */
import { N_BRG } from './echo.js';
import { wrap360, D2R } from './geo.js';

export const NB = 512;
const VIDEO = { amber: [255, 176, 40], yellow: [250, 236, 80], green: [90, 255, 120] };
/* 색 조합: 바탕·영상(실제 장비처럼 여러 조합, 색값은 자체) */
export const COLOR_SETS = { C1: { bg: [13, 10, 7], echo: [255, 176, 40] }, C2: { bg: [8, 8, 8], echo: [250, 230, 60] }, C3: { bg: [18, 30, 96], echo: [255, 236, 70] }, C4: { bg: [6, 10, 8], echo: [90, 240, 110] }, C5: { bg: [8, 40, 48], echo: [120, 250, 140] }, C6: { bg: [42, 54, 68], echo: [255, 220, 90] } };

export function createPPI(canvas, overlay) {
  const g = canvas.getContext('2d');
  const buf = new Uint8Array(N_BRG * NB), written = new Float64Array(N_BRG);
  const st = { canvas, overlay, stats: { clears: 0, renders: 0, litPixels: 0 }, persistence: 2 };
  let W = 0, H = 0, dpr = 1, img = null, px = null, lutA = null, lutB = null, lutKey = '', pal = null, palKey = '';
  let bgPx = 0xff0d0a07;
  let geom = { cx: 0, cy: 0, R: 0, ox: 0, oy: 0 }, lastRange = null, bufRange = 1, view = null, shift = 0, rmax = Infinity;

  function resize() {
    /* 영상 층은 CSS 해상도(최대 배율 1)로 그려 픽셀 수를 줄이고, 글자·선 위층(overlay)만 기기 배율로 선명하게 */
    const r = canvas.getBoundingClientRect(), od = window.devicePixelRatio || 1;
    dpr = Math.min(1, od);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    if (overlay) { overlay.width = Math.round(r.width * od); overlay.height = Math.round(r.height * od); }
    img = g.createImageData(W, H); px = new Uint32Array(img.data.buffer); lutKey = '';
  }
  function clear() { buf.fill(0); written.fill(0); st.stats.clears++; }
  function writeLine(bi, levels) { const o = bi * NB, n = Math.min(NB, levels.length); for (let i = 0; i < n; i++) buf[o + i] = levels[i]; for (let i = n; i < NB; i++) buf[o + i] = 0; written[bi] = performance.now(); }

  function upBrg(v) { return v.orient === 'NU' ? 0 : v.orient === 'CU' ? (v.crs ?? v.hdg) : v.hdg; }
  function layout(v) {
    const R = Math.max(10, Math.min(Math.floor(Math.min(W, H) / 2) - Math.round(36 * dpr), Math.floor(rmax * dpr))), cx = Math.floor(W / 2 - shift * dpr), cy = Math.floor(H / 2);
    const off = v.offset || { x: 0, y: 0 };
    geom = { cx, cy, R, ox: cx + off.x * R, oy: cy + off.y * R };
  }
  function buildLut(v) {
    const key = [W, H, geom.ox | 0, geom.oy | 0, geom.R, v.rangeNM, bufRange].join(',');
    if (key === lutKey) return; lutKey = key;
    lutA = new Int16Array(W * H).fill(-1); lutB = new Int16Array(W * H);
    const R2 = geom.R * geom.R, k = (v.rangeNM / bufRange) * NB / geom.R;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - geom.cx, dy = y - geom.cy; if (dx * dx + dy * dy > R2) continue;
      const ex = x - geom.ox, ey = y - geom.oy, d = Math.hypot(ex, ey) * k; if (d >= NB) continue;
      const a = Math.atan2(ex, -ey) / D2R; // 화면 위 = 0°, 시계 방향
      lutA[y * W + x] = Math.round((wrap360(a) / 360) * N_BRG) & (N_BRG - 1); lutB[y * W + x] = d | 0;
    }
  }
  function palette(v) {
    const set = COLOR_SETS[v.colorSet] || COLOR_SETS.C1, key = (v.colorSet || 'C1') + (v.palette || 'day');
    if (key === palKey) return; palKey = key;
    const c = set.echo, night = v.palette === 'night' ? 0.55 : v.palette === 'dusk' ? 0.8 : 1;
    bgPx = (255 << 24) | (Math.round(set.bg[2] * night) << 16) | (Math.round(set.bg[1] * night) << 8) | Math.round(set.bg[0] * night);
    pal = new Uint32Array(16 * 4);
    for (let a = 0; a < 4; a++) for (let l = 0; l < 16; l++) {
      if (!l) { pal[a * 16] = 0; continue; }
      const f = (0.25 + (0.75 * l) / 15) * (1 - a * 0.22) * night;
      pal[a * 16 + l] = (255 << 24) | (Math.round(c[2] * f) << 16) | (Math.round(c[1] * f) << 8) | Math.round(c[0] * f);
    }
  }
  /* bufRangeNM: 버퍼가 담은 거리(오프센터 때 표시 범위보다 큼) */
  function render(v, bufRangeNM = v.rangeNM) {
    view = v;
    if (lastRange !== null && (lastRange !== v.rangeNM || bufRange !== bufRangeNM)) clear();
    lastRange = v.rangeNM; bufRange = bufRangeNM;
    if (!img) resize();
    layout(v); buildLut(v); palette(v);
    const rot = Math.round((upBrg(v) / 360) * N_BRG), now = performance.now(), per = (st.persistence || 2) * 2500;
    const age = new Uint8Array(N_BRG); for (let i = 0; i < N_BRG; i++) { const a = (now - written[i]) / per; age[i] = a < 0.5 ? 0 : a < 1 ? 1 : a < 1.6 ? 2 : 3; }
    const bg = bgPx;
    let lit = 0;
    for (let p = 0, n = W * H; p < n; p++) {
      const a = lutA[p];
      if (a < 0) { px[p] = 0; continue; }
      const bi = (a + rot) & (N_BRG - 1), l = buf[bi * NB + lutB[p]];
      if (l) { px[p] = pal[age[bi] * 16 + l]; lit++; } else px[p] = bg;
    }
    g.putImageData(img, 0, 0);
    st.stats.renders++; st.stats.litPixels = lit;
  }
  function toScreen(brgTrue, rng) {
    if (view) layout(view);
    const a = (brgTrue - upBrg(view)) * D2R, k = geom.R / view.rangeNM;
    return { x: (geom.ox + Math.sin(a) * rng * k) / dpr, y: (geom.oy - Math.cos(a) * rng * k) / dpr };
  }
  function fromScreen(x, y) {
    if (view) layout(view);
    const ex = x * dpr - geom.ox, ey = y * dpr - geom.oy, k = view.rangeNM / geom.R;
    return { brg: wrap360(Math.atan2(ex, -ey) / D2R + upBrg(view)), rng: Math.hypot(ex, ey) * k };
  }
  function inside(x, y) { return Math.hypot(x * dpr - geom.cx, y * dpr - geom.cy) <= geom.R; }
  return Object.assign(st, { resize, clear, writeLine, render, toScreen, fromScreen, inside, setPersistence: (s) => (st.persistence = s), setShift: (px, rm = Infinity) => { if (px !== shift || rm !== rmax) { shift = px; rmax = rm; lutKey = ''; } }, geom: () => ({ ...geom, dpr }), levelAt: (brg, rng) => { const bi = Math.round((((brg % 360) + 360) % 360) / 360 * N_BRG) & (N_BRG - 1), i = Math.floor((rng / bufRange) * NB); return i >= 0 && i < NB ? buf[bi * NB + i] : 0; }, upBrg: () => upBrg(view) });
}
