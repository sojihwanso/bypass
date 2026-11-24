/* 7-5 선박 간 상호작용: 마주칠 때와 추월할 때, 위치에 따라 바뀌는 반발·흡인과 회두 모멘트 */
import { SH, DEG, KN } from '../physics/ship.js';
import { Arrow, Ghost, Line, V3, footprint } from '../engine/draw.js';
import { hullDeflect, boxSpawn } from '../engine/flow.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const LAT = 95; /* 두 선박 중심선 사이 거리(m) */
/* s = (A의 x − B의 x) / L. 교재의 단계별 방향을 따른 모식(가정): 반환값 force(+ 서로 멀어짐), yawA(+ A의 선수가 B 반대쪽) */
function meet(s) { const f = Math.exp(-(((s - 0.9) / 0.35) ** 2)) * 0.8 - Math.exp(-((s / 0.45) ** 2)) * 1.0 + Math.exp(-(((s + 0.9) / 0.35) ** 2)) * 0.8; const y = Math.exp(-(((s - 0.8) / 0.35) ** 2)) - Math.exp(-((s / 0.4) ** 2)) * 0.9 + Math.exp(-(((s + 0.8) / 0.35) ** 2)); return { f, y }; }
function over(s) {
  const f = Math.exp(-(((s + 1.0) / 0.3) ** 2)) * 0.3 - Math.exp(-(((s + 0.35) / 0.35) ** 2)) * 0.6 - Math.exp(-((s / 0.35) ** 2)) * 1.0 + Math.exp(-(((s - 0.5) / 0.35) ** 2)) * 0.5 + Math.exp(-(((s - 1.0) / 0.3) ** 2)) * 0.25;
  const y = -Math.exp(-(((s + 0.9) / 0.3) ** 2)) * 0.35 - Math.exp(-(((s + 0.45) / 0.3) ** 2)) * 0.8 + Math.exp(-((s / 0.35) ** 2)) * 1.0 + Math.exp(-(((s - 0.5) / 0.3) ** 2)) * 0.4 - Math.exp(-(((s - 1.0) / 0.3) ** 2)) * 0.3;
  return { f, y };
}
const PH_MEET = [[0.9, '① 선수끼리 다가옴', '선수의 높은 압력끼리 밀어내 두 배의 선수가 서로 바깥으로 돈다.'], [0, '② 나란히', '가운데의 낮은 압력이 두 배를 끌어당기고, 선수를 서로 안쪽으로 돌린다.'], [-0.9, '③ 선미끼리 가까움', '선미의 높은 압력이 밀어내 선수를 다시 바깥으로 돌린다.']];
const PH_OVER = [[-1.0, '① 뒤에서 다가옴', 'A의 선수가 B 쪽으로 약하게 돈다. 약한 반발력.'], [-0.45, '② A의 선수가 B의 중앙 근처', 'A의 선수를 B 쪽으로 돌리는 모멘트가 커지고, 반발력이 흡인력으로 바뀐다.'], [0, '③ 나란히', '아주 강한 흡인력이 두 배를 끌어당기고, 강한 모멘트가 선수를 서로 바깥으로 민다.'], [0.5, '④ A의 선미가 B의 중앙 근처', '흡인력이 반발력으로 바뀌고, A의 선수를 바깥으로 미는 모멘트가 약하게 남는다.'], [1.0, '⑤ 거의 지나침', '약하지만 A의 선수가 다시 B 쪽으로 향한다.']];
export default {
  id: 'interaction', dur: 30, scale: 1, flowVis: 3, life: 2.2,
  controls: [{ k: 'mode', label: '상황', type: 'seg', opts: [['over', '추월 (A가 B의 우현으로)'], ['meet', '마주침']], val: 'over', restart: true }],
  cam: { r: 900, th: 2.0, ph: 0.75, target: () => V3(0, 0, -LAT / 2) }, water: { alpha: 0.5, amp: 0.2 }, parts: ['hull'],
  legend: [['bad', '반발력'], ['info', '흡인력'], ['amber', '선수를 돌리는 모멘트'], ['deck', '배 A (조종하는 배)']],
  chartTitle: '배 A가 받는 힘(+ 반발)과 회두 모멘트(+ 바깥으로), 위치에 따라',
  build(ctx, p) {
    this.ctx = ctx; this.mode = p.mode; const P = ctx.P;
    this.B = Ghost(0, -LAT, 0, P.ink, 0.9); ctx.fxW.add(this.B);
    const T = ctx.THREE, shp = new T.Shape(footprint().map(v => new T.Vector2(v.x, -v.z))), hullB = new T.Mesh(new T.ExtrudeGeometry(shp, { depth: 16, bevelEnabled: false }), new T.MeshStandardMaterial({ color: P.muted, transparent: true, opacity: 0.6, roughness: 0.8 })); hullB.rotation.x = -Math.PI / 2; hullB.position.y = -6; this.B.add(hullB);
    this.lB = ctx.label('<b>배 B</b>', 'dim', o => o.copy(this.B.position).add(V3(0, 30, 0))); this.lA = ctx.label('<b style="color:var(--deck)">배 A</b>', 'dim', o => { this.ctx.ship.yaw.updateMatrixWorld(); return o.setFromMatrixPosition(this.ctx.ship.yaw.matrixWorld).add(V3(0, 40, 0)); });
    this.aF = Arrow(P.bad, 2.4, { top: true }); this.aY = Arrow(P.amber, 2, { top: true }); ctx.fxY.add(this.aF, this.aY);
    const ph = p.mode === 'meet' ? PH_MEET : PH_OVER, sAt = t => this.sAt(t);
    const tOf = s0 => { for (let t = 0; t <= 30; t += 0.05) if (p.mode === 'meet' ? sAt(t) <= s0 : sAt(t) >= s0) return t; return 0; };
    this.steps = [{ t: 0, h: p.mode === 'meet' ? '서로 마주 보고 다가온다' : '배 A가 배 B를 따라잡는다', p: p.mode === 'meet' ? '두 배가 가까이 반대 방향으로 지나간다. 선체 주변 압력은 선수·선미가 높고 가운데가 낮다. 마주칠 때는 빨리 지나쳐 효과가 잠깐이다.' : '상대 속력이 작아 서로 오래 나란히 있게 되므로 상호작용이 오래 간다. 주의가 가장 필요한 경우다.' }]
      .concat(ph.map(([s, h, d]) => ({ t: tOf(s), h, p: d })))
      .concat([{ t: 28, h: '줄이는 방법', p: '천수 구역에서, 빠를수록, 가까울수록 세지고 작은 배가 더 크게 영향받는다. 충분한 거리(배 길이만큼)를 두고 속력을 줄인다. 부두에 정박한 배 옆을 지날 때도 같은 원리로 정박선이 끌려 나가고 밀려 들어오므로 감속한다.' }]);
    this.st = { u: 6, v: 0, r: 0, n: 0, cref: 6 };
  },
  sAt(t) { return this.mode === 'meet' ? 1.8 - 3.6 * t / 30 : -1.6 + 3.2 * t / 30; },
  apply(t) {
    const s = this.sAt(t), q = (this.mode === 'meet' ? meet : over)(s), ship = this.ctx.ship;
    const xB = this.mode === 'meet' ? -s * SH.L / 2 : -s * SH.L / 2;
    /* B는 A의 좌현(−z)에 있다. + 바깥 = B 반대쪽(+z) */
    ship.pose(s * SH.L / 2, q.f * 6, q.y * 4 * DEG);
    this.B.position.set(xB, 0.8, -LAT - q.f * 4); this.B.rotation.y = this.mode === 'meet' ? Math.PI - q.y * 3 * DEG : q.y * 2 * DEG;
    this.aF.set(V3(0, 26, q.f > 0 ? 10 : -60), V3(0, 0, q.f > 0 ? 1 : -1), Math.abs(q.f) > 0.05 ? 14 + 40 * Math.abs(q.f) : 0.01); this.aF.mat.color.set(q.f > 0 ? this.ctx.P.bad : this.ctx.P.info);
    this.aY.set(V3(SH.L / 2 - 10, 30, 0), V3(0, 0, q.y > 0 ? 1 : -1), Math.abs(q.y) > 0.05 ? 10 + 30 * Math.abs(q.y) : 0.01);
    this.q = q; this.s = s;
  },
  read() {
    const q = this.q || { f: 0, y: 0 };
    return [['A와 B의 앞뒤 위치', fmt(this.s, 2) + 'L (A가 앞이면 +)'], ['A가 받는 힘', Math.abs(q.f) < 0.05 ? '거의 없음' : q.f > 0 ? '반발 (멀어짐)' : '흡인 (끌려감)', q.f < -0.5 ? 'bad' : ''], ['A의 선수', Math.abs(q.y) < 0.05 ? '거의 그대로' : q.y > 0 ? 'B 반대쪽(바깥)으로' : 'B 쪽(안쪽)으로', q.y < -0.5 ? 'bad' : ''], ['두 배 사이 거리', LAT + ' m (모식)']];
  },
  chart(cv, P, { lineChart }) {
    const fn = this.mode === 'meet' ? meet : over, f = [], y = []; for (let s = -1.6; s <= 1.8; s += 0.04) { const q = fn(s); f.push([s, q.f]); y.push([s, q.y]); }
    lineChart(cv, P, { x0: -1.6, x1: 1.8, xt: [[-1, 'A가 뒤 1L'], [0, '나란히'], [1, 'A가 앞 1L']], series: [{ data: f, color: P.bad, min: -1.2, max: 1.2, yt: [-1, 0, 1], hlines: [0], label: '힘(+ 반발, − 흡인)', mark: [this.s, (this.q || { f: 0 }).f] }, { data: y, color: P.amber, min: -1.2, max: 1.2, label: '선수 모멘트(+ 바깥)', dash: [4, 3] }] });
  },
  field(x, y, z, o, st) { o.x = -6; o.y = 0; o.z = 0; o.k = 0; hullDeflect(x, y, z, o); },
  spawn(p) { boxSpawn([-240, 260, -12, -0.5, -150, 60], p); }, box: [-300, 320, -18, 1, -200, 100]
};
