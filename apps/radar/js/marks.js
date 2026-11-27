/* 사용자 마크 20가지: 점 마크 12개(한 번 눌러 놓기) + 선 마크 8개(두 점을 눌러 긋기 — 실무에서 항로·경계선·피항선 표시에 씀) */
export const MARK_TYPES = [
  { id: 'tri', kind: 'pt', sym: '▲', ko: '삼각형', en: 'Triangle' },
  { id: 'circle', kind: 'pt', sym: '○', ko: '원', en: 'Circle' },
  { id: 'square', kind: 'pt', sym: '□', ko: '사각형', en: 'Square' },
  { id: 'cross', kind: 'pt', sym: '✕', ko: 'X 표', en: 'Cross' },
  { id: 'plus', kind: 'pt', sym: '+', ko: '십자', en: 'Plus' },
  { id: 'diamond', kind: 'pt', sym: '◇', ko: '마름모', en: 'Diamond' },
  { id: 'star', kind: 'pt', sym: '★', ko: '별', en: 'Star' },
  { id: 'dcircle', kind: 'pt', sym: '◎', ko: '이중 원(변침점)', en: 'Double circle (WOP)' },
  { id: 'anchor', kind: 'pt', sym: '⚓', ko: '닻(묘박지)', en: 'Anchor' },
  { id: 'wreck', kind: 'pt', sym: '⋕', ko: '침선·장애물', en: 'Wreck / obstruction' },
  { id: 'buoy', kind: 'pt', sym: '♁', ko: '부표', en: 'Buoy' },
  { id: 'flag', kind: 'pt', sym: '⚑', ko: '깃발(기준점)', en: 'Flag (reference)' },
  { id: 'line', kind: 'line', sym: '━', ko: '실선', en: 'Solid line', dash: [], w: 1.5 },
  { id: 'dash', kind: 'line', sym: '╍', ko: '파선', en: 'Dashed line', dash: [10, 6], w: 1.5 },
  { id: 'dot', kind: 'line', sym: '┈', ko: '점선', en: 'Dotted line', dash: [2, 4], w: 1.8 },
  { id: 'dashdot', kind: 'line', sym: '─·', ko: '일점쇄선', en: 'Dash-dot line', dash: [12, 4, 2, 4], w: 1.5 },
  { id: 'thick', kind: 'line', sym: '▬', ko: '굵은 실선', en: 'Thick line', dash: [], w: 3.5 },
  { id: 'arrow', kind: 'line', sym: '→', ko: '화살표 선', en: 'Arrow line', dash: [], w: 1.5 },
  { id: 'double', kind: 'line', sym: '═', ko: '이중선', en: 'Double line', dash: [], w: 1.2 },
  { id: 'ring', kind: 'line', sym: '◯', ko: '원(중심→반지름)', en: 'Ring (centre → radius)', dash: [6, 4], w: 1.5 },
];
export const MARK_BY_ID = Object.fromEntries(MARK_TYPES.map((t) => [t.id, t]));
export const isLineMark = (id) => (MARK_BY_ID[id] || {}).kind === 'line';

/* 점 마크 그리기: s = 화면 좌표 */
function drawPoint(g, id, s) {
  const { x, y } = s; g.beginPath();
  switch (id) {
    case 'tri': g.moveTo(x, y - 7); g.lineTo(x + 6, y + 5); g.lineTo(x - 6, y + 5); g.closePath(); break;
    case 'circle': g.arc(x, y, 6, 0, Math.PI * 2); break;
    case 'square': g.rect(x - 5.5, y - 5.5, 11, 11); break;
    case 'cross': g.moveTo(x - 6, y - 6); g.lineTo(x + 6, y + 6); g.moveTo(x + 6, y - 6); g.lineTo(x - 6, y + 6); break;
    case 'plus': g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.moveTo(x, y - 7); g.lineTo(x, y + 7); break;
    case 'diamond': g.moveTo(x, y - 7); g.lineTo(x + 6, y); g.lineTo(x, y + 7); g.lineTo(x - 6, y); g.closePath(); break;
    case 'star': for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 7.5, a = (i * Math.PI) / 5 - Math.PI / 2; i ? g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)) : g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); break;
    case 'dcircle': g.arc(x, y, 7, 0, Math.PI * 2); g.moveTo(x + 3, y); g.arc(x, y, 3, 0, Math.PI * 2); break;
    case 'wreck': g.moveTo(x - 8, y); g.lineTo(x + 8, y); for (const dx of [-4, 0, 4]) { g.moveTo(x + dx, y - 5); g.lineTo(x + dx, y + 5); } break;
    case 'buoy': g.moveTo(x - 4, y + 6); g.lineTo(x + 4, y + 6); g.moveTo(x, y + 6); g.lineTo(x, y - 1); g.moveTo(x + 3.5, y - 4); g.arc(x, y - 4, 3.5, 0, Math.PI * 2); break;
    case 'flag': g.moveTo(x - 4, y + 7); g.lineTo(x - 4, y - 7); g.lineTo(x + 6, y - 3.5); g.lineTo(x - 4, y); break;
    default: g.arc(x, y + 1, 5, 0.15 * Math.PI, 0.85 * Math.PI); g.moveTo(x, y - 7); g.lineTo(x, y + 6); g.moveTo(x - 4, y - 3); g.lineTo(x + 4, y - 3); // anchor
  }
  g.stroke();
}
/* 선 마크 그리기: a → b (화면 좌표) */
function drawLine(g, t, a, b) {
  g.lineWidth = t.w; g.setLineDash(t.dash); g.beginPath();
  if (t.id === 'ring') { g.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.beginPath(); g.moveTo(a.x - 3, a.y); g.lineTo(a.x + 3, a.y); g.moveTo(a.x, a.y - 3); g.lineTo(a.x, a.y + 3); g.stroke(); return; }
  if (t.id === 'double') { const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = (-(b.y - a.y) / L) * 2.5, ny = ((b.x - a.x) / L) * 2.5; for (const s of [1, -1]) { g.moveTo(a.x + nx * s, a.y + ny * s); g.lineTo(b.x + nx * s, b.y + ny * s); } g.stroke(); return; }
  g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]);
  if (t.id === 'arrow') { const ang = Math.atan2(b.y - a.y, b.x - a.x); g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - 10 * Math.cos(ang - 0.4), b.y - 10 * Math.sin(ang - 0.4)); g.moveTo(b.x, b.y); g.lineTo(b.x - 10 * Math.cos(ang + 0.4), b.y - 10 * Math.sin(ang + 0.4)); g.stroke(); }
}
/* 마크 하나 그리기. b가 없으면 점 마크 */
export function drawMark(g, id, a, b, color) {
  const t = MARK_BY_ID[id] || MARK_BY_ID.anchor; g.save(); g.strokeStyle = color; g.lineWidth = 1.5;
  if (t.kind === 'line' && b) drawLine(g, t, a, b); else drawPoint(g, t.kind === 'line' ? 'plus' : t.id, a);
  g.restore();
}
/* 고르기 창 아이콘(작은 캔버스 그림을 data URL로) */
const iconCache = {};
export function markIcon(id, color = '#1F5E8C') {
  const k = id + color; if (iconCache[k]) return iconCache[k];
  const c = document.createElement('canvas'), d = 2; c.width = 26 * d; c.height = 22 * d; const g = c.getContext('2d'); g.scale(d, d);
  if (isLineMark(id)) id === 'ring' ? drawMark(g, id, { x: 13, y: 11 }, { x: 21, y: 11 }, color) : drawMark(g, id, { x: 3, y: 16 }, { x: 23, y: 6 }, color); else drawMark(g, id, { x: 13, y: 11 }, null, color);
  return (iconCache[k] = c.toDataURL());
}
/* 화면 위 점 p와 마크의 거리(px) — 지우기 용 */
export function markDist(id, a, b, p) {
  if (!b) return Math.hypot(p.x - a.x, p.y - a.y);
  if (id === 'ring') return Math.abs(Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(b.x - a.x, b.y - a.y));
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy);
}
