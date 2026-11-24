/* 3-2 타의 양력과 실속: 타각 0→45°, 흐름선 색·압력 막대·세 힘 화살표 */
import { SH, DEG, KN } from '../physics/ship.js';
import { cnModel, beaufoyN, joesselX, normalForce } from '../physics/rudder.js';
import { RUD } from '../engine/ship.js';
import { Arrow, Dot, Line, V3, arcPts, setLine } from '../engine/draw.js';
import { boxSpawn } from '../engine/flow.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const B = RUD.le + RUD.te;
/* 실속 때 흡입면 쪽 소용돌이 두 개. 시위 방향 a(뒤로 +), 법선 b(흡입면 −) 좌표. 일정 속도로 하류로 흘렀다가 다시 생긴다 */
function vort(time, st) { const L = 16, v = Math.max(1.2, st.U * 0.18); return [0, 0.5].map(ph => { const f = ((time * v / L) + ph) % 1; return { a: -RUD.le + 1.5 + f * L, b: -2.6 - 2.2 * f, s: 0.6 + 0.4 * Math.sin(Math.PI * f) }; }); }
export default {
  id: 'rudder', dur: 34, scale: 1, flowVis: 2.6, life: 2.2, noHull: true,
  controls: [{ k: 'U', label: '타 주위 유속', type: 'range', min: 4, max: 20, step: 1, val: 12, fmt: v => v + ' kn' }],
  cam: { r: 40, th: Math.PI - 0.35, ph: 2.72, target: () => V3(-146, -9, 0) }, water: { alpha: 0.16, amp: 0 }, parts: ['rudder', 'propeller'],
  legend: [['bad', '직압력 N'], ['info', '양력 L'], ['amber', '항력 D'], ['jet0', '압력면: 느림, 고압'], ['cool0', '흡입면: 빠름, 저압']],
  chartTitle: '타각에 따른 직압력 계수',
  steps: [
    { t: 0, h: '타 중앙', p: '양쪽 면을 지나는 흐름이 같아 압력 차이가 없다. 직압력은 0이다.' },
    { t: 3, h: '받음각이 생긴다', p: '타를 돌리면 흐름이 타판에 비스듬히 닿는다. 이 각이 받음각이다. 배가 직진 중이면 받음각은 타각과 같다.' },
    { t: 6, h: '양면의 흐름과 압력이 달라진다', p: '돌린 쪽 면(압력면)은 흐름이 막혀 느려지고 압력이 오른다. 반대 면(흡입면)은 물이 돌아 나가며 빨라져 압력이 내려간다. 빠르면 압력이 낮다는 베르누이 정리 그대로다. 막대 길이가 압력 차이다.' },
    { t: 11, h: '직압력, 양력, 항력', p: '두 면의 압력 차이가 타판에 수직인 직압력 N이 된다(마찰력은 작아 무시). N을 흐름에 수직인 양력 L = N·cosδ와 흐름 방향의 항력 D = N·sinδ로 나눈다. 양력은 선미를 옆으로 밀어 배를 돌리고, 항력은 속력을 줄인다.' },
    { t: 17, h: '압력 중심이 뒤로', p: '타각이 커질수록 직압력이 걸리는 점이 뒤로 옮겨 간다(Joessel 식). 30°에서는 앞날에서 폭의 약 35% 지점이다. 타두재에 걸리는 모멘트도 달라진다.' },
    { t: 23.6, h: '한계 타각', p: '직압력이 가장 커지는 타각 근처다. 이 각을 넘으면 실속이 시작된다. Beaufoy 식(점선)은 sin δ를 따라 계속 오르므로 이 꺾임을 담지 못한다.' },
    { t: 27.5, h: '실속', p: '흡입면 뒤쪽에서 흐름이 타판 표면을 따라 흐르지 못하고 떨어져 나간다(박리). 떨어진 자리에 소용돌이(와류)가 생겨 하류로 떠내려간다. 흡입면의 낮은 압력이 무너져 같은 유속에서 타각을 더 줘도 양력은 오히려 준다. 항력은 계속 커진다.' }
  ],
  dAt(t) { return t < 2 ? 0 : t < 30 ? (t - 2) / 28 * 45 : 45; },
  build(ctx, p) {
    this.ctx = ctx; const P = ctx.P; this.U = p.U * KN; ctx.ship.setOpacity(0.3); this.st = { u: 0, v: 0, r: 0, U: this.U, d: 0, cref: this.U };
    this.aN = Arrow(P.bad, 0.22, { top: true }); this.aL = Arrow(P.info, 0.2, { top: true }); this.aD = Arrow(P.amber, 0.2, { top: true }); ctx.fxY.add(this.aN, this.aL, this.aD);
    this.cp = Dot(P.ink, 0.3); ctx.fxY.add(this.cp);
    this.lN = ctx.label('', 'dim', o => o.copy(this.pN || V3())); this.lL = ctx.label('', 'dim', o => o.copy(this.pL || V3())); this.lD = ctx.label('', 'dim', o => o.copy(this.pD || V3()));
    ctx.label('압력 중심', 'dim', o => { this.cp.updateMatrixWorld(); return o.setFromMatrixPosition(this.cp.matrixWorld).add(V3(0, -1.2, 0)); });
    ctx.fxY.add(Line([V3(-122, -7, 0), V3(-132, -7, 0)], P.ink, { top: true, opacity: 0.6 })); ctx.label('들어오는 흐름', 'dim', o => { ctx.ship.yaw.updateMatrixWorld(); return o.set(-120, -7, 0).applyMatrix4(ctx.ship.yaw.matrixWorld); });
    this.arc = Line([V3(), V3(1, 0, 0)], P.amber, { top: true }); ctx.fxY.add(this.arc);
    this.lA = ctx.label('', 'dim', o => o.copy(this.pA || V3()));
    this.lV = ctx.label('', 'dim', o => o.copy(this.pV || V3()));
    /* 압력 막대: 타와 함께 돈다 */
    if (this.pg) this.pg.parent && this.pg.parent.remove(this.pg);
    const T = ctx.THREE; this.pg = new T.Group(); ctx.ship.rudder.add(this.pg); this.bars = [];
    for (const side of [1, -1]) for (let i = 0; i < 9; i++) { const a = Arrow(side > 0 ? P.jet0 : P.cool0, 0.09, { top: true }); this.pg.add(a); this.bars.push({ a, side, s: (i + 0.5) / 9 }); }
  },
  apply(t) {
    const ship = this.ctx.ship, d = this.dAt(t), dr = d * DEG; this.d = d; this.st.d = d;
    ship.pose(0, 0, 0); ship.rudder.rotation.y = dr;
    const ym = -SH.T + (RUD.y0 + RUD.y1) / 2, dir = V3(-Math.cos(dr), 0, Math.sin(dr)), le = V3(RUD.x, ym, 0).addScaledVector(dir, -RUD.le);
    const xcp = joesselX(d, B), cp = le.clone().addScaledVector(dir, xcp); this.cp.position.copy(cp); this.xcp = xcp;
    const N = normalForce(RUD.area, this.U, d); this.N = N; this.NB = beaufoyN(RUD.area, this.U, d);
    const s = 0.05 * 20 / Math.max(this.U / KN, 4), nDir = V3(-Math.sin(dr), 0, -Math.cos(dr));
    this.aN.set(cp, nDir, N * s); this.aL.set(cp.clone().add(V3(0, 0.7, 0)), V3(0, 0, -1), N * Math.cos(dr) * s); this.aD.set(cp.clone().add(V3(0, -0.7, 0)), V3(-1, 0, 0), N * Math.sin(dr) * s);
    const W = v => { ship.yaw.updateMatrixWorld(); return v.applyMatrix4(ship.yaw.matrixWorld); };
    this.pN = W(cp.clone().addScaledVector(nDir, N * s + 0.9)); this.pL = W(cp.clone().add(V3(0, 0.7, -(N * Math.cos(dr) * s + 0.9)))); this.pD = W(cp.clone().add(V3(-(N * Math.sin(dr) * s + 0.9), -0.7, 0)));
    this.lN.set(d > 0.5 ? '<b style="color:var(--bad)">직압력 N</b>' : ''); this.lL.set(d > 0.5 ? '<b style="color:var(--info)">양력 L</b>' : ''); this.lD.set(d > 3 ? '<b style="color:var(--amber)">항력 D</b>' : '');
    /* 받음각 호 */
    const st = V3(RUD.x, ym + 5.2, 0); const pts = arcPts(st.x, st.z, 5.5, Math.PI, Math.PI - dr, st.y, 24).map(v => V3(v.x, v.y, -v.z));
    if (d > 1) { this.arc.visible = true; setLine(this.arc, pts); this.pA = W(V3(st.x - 6.5, st.y, Math.sin(dr / 2) * 6.5)); this.lA.set(`<b style="color:var(--amber)">받음각 ${fmt(d, 0)}°</b>`); } else { this.arc.visible = false; this.lA.set(''); }
    /* 와류 이름표: 실속 때 흡입면 쪽 */
    if (d > 37.5) { const a = RUD.te * 0.55, b = -4.2, px = -a * Math.cos(dr) + b * Math.sin(dr), pz = a * Math.sin(dr) + b * Math.cos(dr); this.pV = W(V3(RUD.x + px, ym + 2.2, pz)); this.lV.set('<b style="color:var(--cool0)">박리 · 와류</b>'); } else this.lV.set('');
    /* 압력 막대 (타 좌표: 시위는 −x, 압력면은 +z) */
    const stall = Math.max(0, (d - 36) / 9), cn = cnModel(d);
    for (const b of this.bars) {
      const x = RUD.le - b.s * B, th = 0.55 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * b.s - 1, 2))) + 0.08;
      let mag = b.side > 0 ? 0.9 * Math.pow(1 - b.s, 0.5) : 1.6 * Math.pow(1 - b.s, 0.9);
      if (b.side < 0 && b.s > 0.22) mag *= 1 - 0.85 * Math.min(1, stall);
      const L = mag * cn * 3.2 * Math.min(1, d / 6) * (this.U / (12 * KN)) ** 0.5;
      const y = (RUD.y0 + RUD.y1) / 2;
      if (b.side > 0) b.a.set(V3(x, y, th + 0.15 + L), V3(0, 0, -1), L); else b.a.set(V3(x, y, -th - 0.15), V3(0, 0, -1), L);
    }
  },
  read() {
    const d = this.d, dr = d * DEG, tq = this.N * (this.xcp - RUD.le);
    return [['타각', fmt(d, 1) + '° (우현)'], ['유속', fmt(this.U / KN, 0) + ' kn (' + fmt(this.U, 1) + ' m/s)'], ['직압력 N (모델)', fmt(this.N, 0) + ' tf'], ['Beaufoy 식', fmt(this.NB, 0) + ' tf'], ['양력 L = N·cosδ', fmt(this.N * Math.cos(dr), 0) + ' tf'], ['항력 D = N·sinδ', fmt(this.N * Math.sin(dr), 0) + ' tf'],
      ['압력 중심', '앞날에서 ' + fmt(this.xcp, 2) + ' m (폭의 ' + fmt(this.xcp / B * 100, 0) + '%)'], ['타두재 모멘트', fmt(tq, 0) + ' tf·m'], ['상태', d > 37 ? '실속 · 흐름 박리' : d > 31 ? '한계 타각 근처' : d > 0.5 ? '흐름이 붙어 있음' : '중앙', d > 37 ? 'bad' : d > 31 ? 'warn' : '']];
  },
  chart(cv, P, { lineChart }) {
    const m = [], bf = []; for (let d = 0; d <= 45; d++) { m.push([d, cnModel(d)]); bf.push([d, 1.125 * Math.sin(d * DEG)]); }
    lineChart(cv, P, { x0: 0, x1: 45, xt: [[0, '0°'], [15, '15°'], [35, '35°'], [45, '45°']], series: [{ data: m, color: P.deck, min: 0, max: 1.1, yt: [0, 0.5, 1], label: '모형 실험 경향(모델)', mark: [this.d, cnModel(this.d)] }, { data: bf, color: P.muted, dash: [4, 3], min: 0, max: 1.1, label: 'Beaufoy 식' }] });
  },
  field(x, y, z, o, st, time) {
    o.x = -st.U; o.y = 0; o.z = 0; o.k = 0;
    const dr = st.d * DEG; if (y < -SH.T + RUD.y0 - 1 || y > -SH.T + RUD.y1 + 0.5) return;
    const cx = Math.cos(dr), sx = Math.sin(dr), px = x - RUD.x, pz = z;
    const a = -px * cx + pz * sx, bb = px * sx + pz * cx, ac = a - (RUD.te - RUD.le) / 2, e = (ac / 3.9) ** 2 + (bb / 1.1) ** 2;
    if (a > -RUD.le - 6 && a < RUD.te + 2 && Math.abs(bb) < 9) {
      const w = Math.max(0, Math.min(1, 1.6 - e * 0.25)), tx = -cx, tz = sx, vt = o.x * tx + o.z * tz;
      o.x += (tx * vt - o.x) * w * 0.9; o.z += (tz * vt - o.z) * w * 0.9;
      const f = bb > 0 ? 1 - 0.45 * Math.min(1, st.d / 30) * w : 1 + 0.55 * Math.min(1, st.d / 30) * w; o.x *= f; o.z *= f;
      if (e < 1) { const nl = 1.2 * Math.sign(bb || 1); o.x += sx * nl; o.z += cx * nl; }
      o.k = st.d < 0.5 ? 0 : bb > 0 ? 1 : 3;
    } else if (a >= RUD.te + 2 && a < RUD.te + 34 && Math.abs(bb) < 10) {
      const k = (1 - (a - RUD.te) / 34) * (1 - Math.abs(bb) / 10), turn = (st.d > 37 ? 0.25 : 0.7) * dr * k, vx = o.x, vz = o.z;
      o.x = vx * Math.cos(turn) + vz * Math.sin(turn); o.z = -vx * Math.sin(turn) + vz * Math.cos(turn);
    }
    if (st.d > 36.5 && bb < 0 && bb > -10 && a > -RUD.le && a < RUD.te + 26) {
      /* 실속: 흡입면 뒤쪽에서 흐름이 타판을 벗어나(박리) 소용돌이가 생겨 하류로 떠내려간다 */
      const k = Math.min(1, (st.d - 36.5) / 4), sep = RUD.te * 0.1 - 1.2 * k;
      if (a > sep) {
        const dead = Math.min(1, (a - sep) / 2.5) * Math.min(1, (bb + 10) / 3) * k;
        o.x *= 1 - 0.8 * dead; o.z *= 1 - 0.8 * dead;
        for (const c of vort(time, st)) {
          const da = a - c.a, db = bb - c.b, r2 = da * da + db * db, w = st.U * 1.5 * k * c.s / (r2 + 2.2) * 2.2;
          const va = -w * db, vb = w * da;
          o.x += va * -cx + vb * sx; o.z += va * sx + vb * cx; o.y += 0.15 * w * Math.sin(time * 2 + c.a);
        }
        o.k = 3;
      }
    }
  },
  color(spd, o, x, y, z, st, C, c) { const r = spd / st.U; if (o.k === 1) return c.copy(C.j0).lerp(C.j1, Math.min(1, Math.max(0, 1 - r) * 1.6)); if (o.k === 3) return c.copy(C.c0).lerp(C.c1, Math.min(1, Math.max(0, r - 1) * 1.8)); return c.copy(C.w0).lerp(C.w1, 0.55); },
  spawn(p) { boxSpawn([-170, -122, -SH.T + RUD.y0 - 0.5, -SH.T + RUD.y1, -11, 11], p); }, box: [-200, -118, -16, 0, -30, 30]
};
