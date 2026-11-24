/* 9-1 계류: 계선줄 장력 T의 앞뒤(T·cosα·cosβ), 옆(T·cosα·sinβ), 위아래(T·sinα) 성분. α 수직각, β 선수미선과 이루는 수평각 */
import { SH, DEG, hullHalfWidth as hw } from '../physics/ship.js';
import { Arrow, Line, Dot, V3, setLine } from '../engine/draw.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const ZQ = () => -(Math.max(hw(0, SH.T), hw(0, SH.D)) + 3);          /* 부두 앞면(좌현 접안, 방현재 3 m) */
export const LINES = {
  head: ['Head line', 138, 215], fbr: ['Fore breast line', 118, 118], fsp: ['Fore spring line', 95, 25],
  asp: ['After spring line', -95, -25], abr: ['After breast line', -122, -122], stern: ['Stern line', -140, -215]
};
const QH = 3, SET = 6, T0 = 30; /* 부두 높이(수면 위), 볼라드가 부두 끝에서 들어간 거리, 장력(t) */
export function comps(key, fb) {
  const [, xf, xb] = LINES[key], zf = -hw(xf, SH.D), zb = ZQ() - SET, dx = xb - xf, dz = zb - zf, dy = QH - fb, h = Math.hypot(dx, dz);
  const a = Math.atan2(Math.abs(dy), h), b = Math.atan2(Math.abs(dz), Math.abs(dx));
  return { a, b, FA: T0 * Math.cos(a) * Math.cos(b), TR: T0 * Math.cos(a) * Math.sin(b), V: T0 * Math.sin(a), sx: Math.sign(dx), len: Math.hypot(h, dy), xf, zf, xb, zb };
}
export default {
  id: 'mooring', dur: 30, scale: 1,
  controls: [
    { k: 'line', label: '살펴볼 계선줄', type: 'seg', many: true, opts: Object.entries(LINES).map(([k, v]) => [k, v[0]]), val: 'fsp' },
    { k: 'fb', label: '페어리더 높이 (수면 위)', type: 'range', min: 6, max: 22, step: 1, val: 11, fmt: v => v + ' m' }
  ],
  cam: { r: 380, th: -1.25, ph: 0.5, target: () => V3(20, 6, ZQ() - 5) }, water: { alpha: 0.6, amp: 0.15 }, parts: ['hull'],
  legend: [['amber', '살펴보는 줄'], ['bad', '앞뒤 성분'], ['info', '옆 성분'], ['deck', '위아래 성분']],
  chartTitle: '수평각 β에 따른 성분 (T = 30톤, 지금 α에서)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, T3 = ctx.THREE, zq = ZQ(), fb = +p.fb;
    ctx.ship.pose(0, 0, 0, 0, 0, fb - (SH.D - SH.T));
    const quay = new T3.Mesh(new T3.BoxGeometry(700, 30, 60), new T3.MeshStandardMaterial({ color: P.sand, roughness: 0.95 })); quay.position.set(0, QH - 15, zq - 30); ctx.fxW.add(quay);
    for (const x of [-100, -35, 35, 100]) { const f = new T3.Mesh(new T3.CylinderGeometry(1.6, 1.6, 6, 16), new T3.MeshStandardMaterial({ color: P.ink, roughness: 0.8 })); f.rotation.x = Math.PI / 2; f.position.set(x, 1, zq + 1.5); ctx.fxW.add(f); }
    this.lines = {};
    for (const k of Object.keys(LINES)) {
      const c = comps(k, fb), sel = k === p.line;
      const a0 = V3(c.xf, fb, c.zf), a1 = V3(c.xb, QH + 1, c.zb), tube = new T3.Mesh(new T3.CylinderGeometry(sel ? 0.9 : 0.5, sel ? 0.9 : 0.5, a0.distanceTo(a1), 8), new T3.MeshBasicMaterial({ color: sel ? P.amber : P.muted, transparent: true, opacity: sel ? 1 : 0.85 }));
      tube.position.copy(a0).add(a1).multiplyScalar(0.5); tube.quaternion.setFromUnitVectors(V3(0, 1, 0), a1.clone().sub(a0).normalize()); ctx.fxW.add(tube);
      const bo = new T3.Mesh(new T3.CylinderGeometry(0.8, 0.9, 1.6, 12), new T3.MeshStandardMaterial({ color: P.ink })); bo.position.set(c.xb, QH + 0.8, c.zb); ctx.fxW.add(bo);
      ctx.label(`<b${sel ? ' style="color:var(--amber)"' : ''}>${LINES[k][0]}</b>`, 'dim', o => o.set(c.xb, QH + 8, c.zb - 6));
      this.lines[k] = c;
    }
    const c = this.lines[p.line]; this.c = c;
    this.aFA = Arrow(P.bad, 1.8, { top: true }); this.aTR = Arrow(P.info, 1.8, { top: true }); this.aV = Arrow(P.deck, 1.8, { top: true }); ctx.fxW.add(this.aFA, this.aTR, this.aV);
    const o = V3(c.xf, fb + 1, c.zf); this.o = o;
    this.aFA.set(o, V3(c.sx, 0, 0), 2 + c.FA * 2.4); this.aTR.set(o, V3(0, 0, -1), 2 + c.TR * 2.4); this.aV.set(o, V3(0, -1, 0), 2 + c.V * 2.4);
    const nm = LINES[p.line][0];
    this.steps = [
      { t: 0, h: '줄마다 맡은 일', p: 'Breast line은 선체를 부두에 붙여 두고, Spring line은 앞뒤로 움직이는 것을 막고, Head line·Stern line은 선수미 위치를 잡고 요잉을 누른다. 모든 줄을 고르게, 팽팽하게 잡는다.' },
      { t: 8, h: `${nm}: 수평각 β = ${fmt(c.b / DEG, 0)}°`, p: `${nm}에 30톤이 걸리면 앞뒤로 ${fmt(c.FA, 1)}톤, 옆으로 ${fmt(c.TR, 1)}톤, 위아래로 ${fmt(c.V, 1)}톤이다. 선수미선과 나란할수록(β 작을수록) 앞뒤를, 정횡에 가까울수록(β 클수록) 옆을 잘 잡는다.` },
      { t: 16, h: `수직각 α = ${fmt(c.a / DEG, 1)}°`, p: '줄이 수평에 가까울수록(α 작을수록) 수평 계류력이 커진다. 공선이라 페어리더가 높거나 볼라드가 가까우면 α가 커져 같은 장력에도 붙잡는 힘이 준다. 높이를 바꿔 보자.' },
      { t: 23, h: '볼라드 위치가 정한다', p: '실제 줄 배치는 부두의 비트와 볼라드 위치에 달려 있다. 조선자는 앞뒤, 옆, 위아래 계류력을 고르게 얻도록 줄을 나눠 잡는다. 황천에 대비한 곧은 계선주(storm bitt)는 더 멀리 두어 수평 계류력을 더 얻는다.' }
    ];
  },
  apply(t) {
    const s = 1 + 0.15 * Math.sin(t * 0.8), c = this.c;
    this.aFA.set(this.o, V3(c.sx, 0, 0), 2 + c.FA * 2.4 * s); this.aTR.set(this.o, V3(0, 0, -1), 2 + c.TR * 2.4 * s); this.aV.set(this.o, V3(0, -1, 0), 2 + c.V * 2.4 * s); this.s = s;
  },
  read() {
    const c = this.c, s = this.s || 1;
    return [['계선줄', LINES[this.p.line][0]], ['장력 T', fmt(T0 * s, 1) + ' t (바람·파도에 따라 변함)'], ['수직각 α · 수평각 β', fmt(c.a / DEG, 1) + '° · ' + fmt(c.b / DEG, 0) + '°'], ['앞뒤 T·cosα·cosβ', fmt(c.FA * s, 1) + ' t'], ['옆 T·cosα·sinβ', fmt(c.TR * s, 1) + ' t'], ['위아래 T·sinα', fmt(c.V * s, 1) + ' t'], ['줄 길이', fmt(c.len, 0) + ' m']];
  },
  chart(cv, P, { lineChart }) {
    const ca = Math.cos(this.c.a), fa = [], tr = []; for (let b = 0; b <= 90; b += 2) { fa.push([b, T0 * ca * Math.cos(b * DEG)]); tr.push([b, T0 * ca * Math.sin(b * DEG)]); }
    const b = this.c.b / DEG;
    lineChart(cv, P, { x0: 0, x1: 90, xt: [[0, '0° (선수미선과 나란)'], [45, '45°'], [90, '90° (정횡)']], series: [{ data: fa, color: P.bad, min: 0, max: 32, yt: [0, 10, 20, 30], label: '앞뒤 t', mark: [b, this.c.FA] }, { data: tr, color: P.info, min: 0, max: 32, label: '옆 t', mark: [b, this.c.TR] }] });
  }
};
