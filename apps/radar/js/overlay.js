/* PPI 위층 그리기: 방위 눈금·거리환·선수선·자선·EBL/VRM·PI·구역·항적·맵·항로·TT·AIS·Trial·커서
   좌표는 CSS px (ppi.toScreen), 캔버스는 기기 배율로 스케일. 심볼은 IEC 62288 관례(포착 중 점선 원, 추적 실선 원+벡터, 위험 빨강, 분실 ◇)를 따르되 모양은 자체 */
import { wrap360, D2R } from './geo.js';
import { RING_INT } from './echo.js';
import { piLines } from './tools.js';
import { drawMark } from './marks.js';

/* PI 선 색: IALA A = 왼쪽 빨강·오른쪽 초록, B = 반대. offset < 0 이 왼쪽 */
export const piColor = (offset, iala) => (Math.abs(offset) < 1e-9 ? null : (offset < 0) === (iala !== 'B') ? '#E0443A' : '#34B35A');
export const COL = {
  /* 주간: 밝은 회색 콘솔(눈금은 어두운 남색), 원 안은 초록 거리환 */
  day: { scale: '#12324A', ring: 'rgba(90,215,120,.55)', hl: '#F2F6F8', tt: '#5BD68A', ais: '#9FE4FF', bad: '#FF5A4C', tool: '#F2D16B', map: 'rgba(170,200,220,.7)', route: '#E58CFF', cur: '#F2F6F8', trail: [61, 139, 255] },
  /* 박명: 남색 콘솔, 흰 눈금·흰 거리환 */
  dusk: { scale: '#D7E1FF', ring: 'rgba(235,240,255,.45)', hl: '#FFFFFF', tt: '#6BF08F', ais: '#FFFFFF', bad: '#FF6A5E', tool: '#FFE14D', map: 'rgba(190,210,255,.6)', route: '#FF9CF0', cur: '#FFFFFF', trail: [80, 150, 255] },
  /* 야간(실제 장비처럼): 검정 바탕에 주황 눈금·주황 거리환, 물표 기호는 초록·흰색, 측정 도구는 하늘색 */
  night: { scale: '#E2621E', ring: 'rgba(226,98,30,.7)', hl: '#C8C8C8', tt: '#43D35C', ais: '#E2E2E2', bad: '#FF3B2F', tool: '#4FC3E8', map: 'rgba(210,95,35,.65)', route: '#C774E0', cur: '#E0E0E0', trail: [40, 90, 200] },
};
const SYM = { GRN: '#5BD68A', BLU: '#6FA8FF', CYA: '#7FD3FF', MAG: '#FF7FE1', WHT: '#E8EEF2' };

export function drawOverlay(cv, ppi, V, M) {
  const od = window.devicePixelRatio || 1, g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(od, 0, 0, od, 0, 0);
  const G = ppi.geom(), cx = G.cx / G.dpr, cy = G.cy / G.dpr, R = G.R / G.dpr, C = COL[V.palette] || COL.day;
  const sc = (b, r) => ppi.toScreen(b, r), O = sc(0, 0), k = R / V.rangeNM, up = ppi.upBrg();
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.lineWidth = 1; g.font = '11px "IBM Plex Mono", monospace';

  // 위경도 격자
  if (M.grid) { g.strokeStyle = C.ring; g.setLineDash([2, 4]); for (const l of M.grid) { g.beginPath(); l.forEach((p, i) => { const s = sc(p.brg, p.rng); i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y); }); g.stroke(); } g.setLineDash([]); }
  // 항적(래스터)
  if (M.trails) { const [r, gg, b] = C.trail, cell = Math.max(1.2, M.trails.cell * k); M.trails.cells((x, y, age) => { if (ppi.levelAt(Math.atan2(x, y) / D2R, Math.hypot(x, y)) > 0) return; /* 지금 영상이 있는 곳은 항적을 그리지 않음(영상 위를 덮지 않게) */ const p = { x: O.x + rot(x, y, up).x * k, y: O.y - rot(x, y, up).y * k }; g.fillStyle = `rgba(${r},${gg},${b},${(M.trails.multi ? (1 - age) : 1) * 0.55})`; g.fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell); }); }
  // 거리환
  if (V.rings) { g.strokeStyle = C.ring; const iv = RING_INT[V.rangeNM] || V.rangeNM / 6; for (let r = iv; r <= V.rangeNM * 1.6 + 1e-9; r += iv) { g.beginPath(); g.arc(O.x, O.y, r * k, 0, Math.PI * 2); g.stroke(); } }
  // 레이더 맵: 해안선·마크
  if (M.coast) { g.strokeStyle = C.map; g.lineWidth = 1; for (const ring of M.coast) { g.beginPath(); ring.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.stroke(); } }
  if (M.marks) for (const m of M.marks) { const s = sc(m.brg, m.rng); g.strokeStyle = m.type === 'danger' ? C.bad : C.map; g.beginPath(); if (m.type === 'danger') { g.moveTo(s.x - 5, s.y - 5); g.lineTo(s.x + 5, s.y + 5); g.moveTo(s.x + 5, s.y - 5); g.lineTo(s.x - 5, s.y + 5); } else { g.moveTo(s.x, s.y - 6); g.lineTo(s.x + 4, s.y + 4); g.lineTo(s.x - 4, s.y + 4); g.closePath(); } g.stroke(); }
  // 항로
  if (M.route && M.route.length) { g.strokeStyle = C.route; g.setLineDash([6, 4]); g.beginPath(); M.route.forEach((w, i) => { const s = sc(w.brg, w.rng); i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y); }); g.stroke(); g.setLineDash([]); M.route.forEach((w, i) => { const s = sc(w.brg, w.rng); g.beginPath(); g.arc(s.x, s.y, 5, 0, 7); g.stroke(); g.fillStyle = C.route; g.fillText('WP' + (i + 1), s.x + 7, s.y - 6); }); }
  // 구역(표적 경보·포착)
  for (const z of M.zones || []) { g.strokeStyle = z.kind === 'az' ? C.tt : C.tool; g.setLineDash(z.kind === 'az' ? [4, 3] : [8, 4]); const a0 = (z.brg0 - up - 90) * D2R, a1 = (z.brg1 - up - 90) * D2R; g.beginPath(); g.arc(O.x, O.y, z.rng1 * k, a0, a1 < a0 ? a1 + Math.PI * 2 : a1); g.arc(O.x, O.y, z.rng0 * k, a1 < a0 ? a1 + Math.PI * 2 : a1, a0, true); g.closePath(); g.stroke(); g.setLineDash([]); }
  // PI선
  if (M.pi) for (const l of piLines(M.pi)) { const nb = (l.brg + 90) * D2R - up * D2R, dx = Math.sin(nb) * l.offset * k, dy = -Math.cos(nb) * l.offset * k, ub = (l.brg - up) * D2R, L = R * 2.2; g.strokeStyle = piColor(l.offset, M.iala) || C.tool; g.setLineDash([10, 5]); g.beginPath(); g.moveTo(O.x + dx - Math.sin(ub) * L, O.y + dy + Math.cos(ub) * L); g.lineTo(O.x + dx + Math.sin(ub) * L, O.y + dy - Math.cos(ub) * L); g.stroke(); g.setLineDash([]); }
  // 선수선·선미·자선
  if (!V.hlHidden) { const e = sc(V.hdg, V.rangeNM * 3); g.strokeStyle = C.hl; g.lineWidth = 1.3; g.beginPath(); g.moveTo(O.x, O.y); g.lineTo(e.x, e.y); g.stroke(); g.lineWidth = 1; }
  if (M.stern) { const e = sc(V.hdg + 180, V.rangeNM * 3); g.strokeStyle = C.hl; g.setLineDash([2, 5]); g.beginPath(); g.moveTo(O.x, O.y); g.lineTo(e.x, e.y); g.stroke(); g.setLineDash([]); }
  if (M.own) drawOwn(g, O, V, M.own, k, up, C);
  // EBL·VRM
  M.ebl.forEach((e, i) => { if (!e.on) return; const o = e.origin ? sc(e.origin.brg, e.origin.rng) : O, ub = (e.brgTrue - up) * D2R; g.strokeStyle = C.tool; g.setLineDash(i ? [2, 4] : [9, 5]); g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.x + Math.sin(ub) * R * 2.5, o.y - Math.cos(ub) * R * 2.5); g.stroke(); });
  M.vrm.forEach((v, i) => { if (!v.on) return; const o = v.origin ? sc(v.origin.brg, v.origin.rng) : O; g.strokeStyle = C.tool; g.setLineDash(i ? [2, 4] : [9, 5]); g.beginPath(); g.arc(o.x, o.y, v.rng * k, 0, Math.PI * 2); g.stroke(); });
  g.setLineDash([]);
  // 자선 Trial 벡터
  if (M.trial) { const e = { x: O.x + Math.sin((M.trial.course - up) * D2R) * M.trial.speed * (M.vecMin / 60) * k, y: O.y - Math.cos((M.trial.course - up) * D2R) * M.trial.speed * (M.vecMin / 60) * k }; g.strokeStyle = C.tool; g.lineWidth = 2; g.setLineDash([6, 3]); g.beginPath(); g.moveTo(O.x, O.y); g.lineTo(e.x, e.y); g.stroke(); g.setLineDash([]); g.lineWidth = 1; g.fillStyle = C.tool; g.fillText('TRIAL', e.x + 6, e.y); }
  // Drop mark
  for (const m of M.userMarks || []) drawMark(g, m.shape, sc(m.brg, m.rng), m.b ? sc(m.b.brg, m.b.rng) : null, C.tool);
  if (M.markPrev) { g.globalAlpha = 0.6; drawMark(g, M.markPrev.shape, sc(M.markPrev.brg, M.markPrev.rng), sc(M.markPrev.b.brg, M.markPrev.b.rng), C.tool); g.globalAlpha = 1; }
  for (const d of M.drops || []) { const s = sc(d.brg, d.rng); g.strokeStyle = C.tool; g.beginPath(); g.moveTo(s.x - 6, s.y); g.lineTo(s.x + 6, s.y); g.moveTo(s.x, s.y - 6); g.lineTo(s.x, s.y + 6); g.stroke(); }
  // AIS
  const symC = SYM[M.symColor] || C.tt;
  for (const a of M.ais || []) drawAis(g, sc(a.brg, a.rng), a, V, k, up, a.status === 'danger' ? C.bad : C.ais, M);
  // TT
  for (const t of M.tts || []) drawTT(g, sc(t.brg, t.rng), t, V, k, up, t.danger || t.trialDanger ? C.bad : symC, M);
  // 줄자
  if (M.ruler) { const a = sc(M.ruler.a.brg, M.ruler.a.rng), b = sc(M.ruler.b.brg, M.ruler.b.rng); g.strokeStyle = C.cur; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); g.fillStyle = C.cur; g.fillText(M.ruler.label, (a.x + b.x) / 2 + 8, (a.y + b.y) / 2 - 8); }
  g.restore();
  // 방위 눈금(원 바깥)
  g.strokeStyle = C.scale; g.fillStyle = C.scale; g.lineWidth = 1; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let b = 0; b < 360; b++) { const a = (b - up) * D2R, s = Math.sin(a), c = -Math.cos(a), len = b % 10 === 0 ? 9 : b % 5 === 0 ? 6 : 3; g.beginPath(); g.moveTo(cx + s * R, cy + c * R); g.lineTo(cx + s * (R + len), cy + c * (R + len)); g.stroke(); if (b % 30 === 0) g.fillText(String(b).padStart(3, '0'), cx + s * (R + 18), cy + c * (R + 18)); }
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  // 북쪽 표시
  { const a = (0 - up) * D2R, s = Math.sin(a), c = -Math.cos(a), px = cx + s * (R - 2), py = cy + c * (R - 2); g.fillStyle = C.hl; g.beginPath(); g.moveTo(px, py); g.lineTo(px - s * 10 + c * 5, py - c * 10 - s * 5); g.lineTo(px - s * 10 - c * 5, py - c * 10 + s * 5); g.closePath(); g.fill(); }
  // 커서
  if (M.cursor && ppi.inside(M.cursor.x, M.cursor.y)) { g.strokeStyle = C.cur; g.beginPath(); g.moveTo(M.cursor.x - 10, M.cursor.y); g.lineTo(M.cursor.x - 3, M.cursor.y); g.moveTo(M.cursor.x + 3, M.cursor.y); g.lineTo(M.cursor.x + 10, M.cursor.y); g.moveTo(M.cursor.x, M.cursor.y - 10); g.lineTo(M.cursor.x, M.cursor.y - 3); g.moveTo(M.cursor.x, M.cursor.y + 3); g.lineTo(M.cursor.x, M.cursor.y + 10); g.stroke(); }
  g.textAlign = 'start'; g.textBaseline = 'alphabetic';
}
const rot = (x, y, up) => { const a = -up * D2R; return { x: x * Math.cos(a) + y * Math.sin(a), y: -x * Math.sin(a) + y * Math.cos(a) }; };
function vec(g, p, course, speed, min, k, up) { const L = speed * (min / 60) * k, a = (course - up) * D2R; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.sin(a) * L, p.y - Math.cos(a) * L); g.stroke(); }
function drawOwn(g, O, V, own, k, up, C) {
  const Lpx = (own.L / 1852) * k, Bpx = (own.B / 1852) * k; g.strokeStyle = C.hl;
  if (own.scaled && Lpx > 10) { const a = (V.hdg - up) * D2R; g.save(); g.translate(O.x, O.y); g.rotate(a); g.beginPath(); g.moveTo(0, -Lpx * 0.6); g.lineTo(Bpx / 2, -Lpx * 0.3); g.lineTo(Bpx / 2, Lpx * 0.4); g.lineTo(-Bpx / 2, Lpx * 0.4); g.lineTo(-Bpx / 2, -Lpx * 0.3); g.closePath(); g.stroke(); g.restore(); }
  else { g.beginPath(); g.arc(O.x, O.y, 3, 0, 7); g.stroke(); }
  if (own.vec) { g.strokeStyle = C.hl; g.lineWidth = 1.5; vec(g, O, own.vec.course, own.vec.speed, own.vecMin, k, up); g.lineWidth = 1; }
}
function drawTT(g, p, t, V, k, up, col, M) {
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.4;
  if (t.state === 'lost') { g.beginPath(); g.moveTo(p.x, p.y - 8); g.lineTo(p.x + 8, p.y); g.lineTo(p.x, p.y + 8); g.lineTo(p.x - 8, p.y); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(p.x - 6, p.y - 6); g.lineTo(p.x + 6, p.y + 6); g.moveTo(p.x + 6, p.y - 6); g.lineTo(p.x - 6, p.y + 6); g.stroke(); }
  else if (t.state === 'acq') { g.setLineDash([3, 3]); g.beginPath(); g.arc(p.x, p.y, 8, 0, 7); g.stroke(); g.setLineDash([]); }
  else {
    if (t.danger && (performance.now() / 500 | 0) % 2) { g.lineWidth = 2.4; }
    g.beginPath(); g.arc(p.x, p.y, 7, 0, 7); g.stroke();
    const vc = M.vecRel ? t.relVec : { course: t.course, speed: t.speed }; vec(g, p, vc.course, vc.speed, M.vecMin, k, up);
    for (const q of t.pastS || []) { g.beginPath(); g.arc(q.x, q.y, 1.6, 0, 7); g.fill(); }
  }
  g.lineWidth = 1; g.font = '10px "IBM Plex Mono", monospace'; g.fillText(String(t.no), p.x + 9, p.y + 12);
  if (t.letter) { g.font = 'bold 12px "IBM Plex Mono", monospace'; g.fillStyle = col; g.fillText(t.letter, p.x - 22, p.y - 12); g.font = '10px "IBM Plex Mono", monospace'; }
  if (t.selected) { g.strokeStyle = col; g.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(p.x + sx * 13, p.y + sy * 7); g.lineTo(p.x + sx * 13, p.y + sy * 13); g.lineTo(p.x + sx * 7, p.y + sy * 13); } g.stroke(); }
}
function drawAis(g, p, a, V, k, up, col, M) {
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.3; const h = ((a.hdg ?? a.cog) - up) * D2R, s = a.status === 'sleep' ? 0.75 : 1;
  g.save(); g.translate(p.x, p.y); g.rotate(h); g.beginPath(); g.moveTo(0, -11 * s); g.lineTo(6 * s, 7 * s); g.lineTo(-6 * s, 7 * s); g.closePath(); g.stroke();
  if (a.status === 'lost') { g.beginPath(); g.moveTo(-8, -8); g.lineTo(8, 8); g.moveTo(8, -8); g.lineTo(-8, 8); g.stroke(); }
  else if (a.status !== 'sleep') { g.beginPath(); g.moveTo(0, -11); g.lineTo(0, -20); g.stroke(); }
  g.restore();
  if (a.status !== 'sleep' && a.status !== 'lost') { const vc = M.vecRel ? a.relVec : { course: a.cog, speed: a.sog }; g.setLineDash([5, 3]); vec(g, p, vc.course, vc.speed, M.vecMin, k, up); g.setLineDash([]); }
  if (a.selected) { g.beginPath(); g.rect(p.x - 14, p.y - 14, 28, 28); g.stroke(); }
  if (a.letter) { g.font = 'bold 12px "IBM Plex Mono", monospace'; g.fillText(a.letter, p.x - 24, p.y - 12); g.font = '10px "IBM Plex Mono", monospace'; }
  g.lineWidth = 1;
}
