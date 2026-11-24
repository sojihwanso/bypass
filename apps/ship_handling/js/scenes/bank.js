/* 7-4 안벽 효과: 안벽 가까이 나란히 갈 때 선수 쿠션(반발)과 선미 쪽 흡인, 그리고 안벽 쪽으로 쓰는 대응 타 */
import { SH, DEG, KN, XA, XF, hullHalfWidth as hw } from '../physics/ship.js';
import { Arrow, Ribbon, Line, V3 } from '../engine/draw.js';
import { hullDeflect, boxSpawn } from '../engine/flow.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
/* 안벽은 우현(+z) 쪽. 간격 g(선측~안벽)가 작고 속력이 클수록 힘이 커진다(모델 값, 가정 계수) */
function sim(U, g0, helm) {
  const dt = 1, n = 241, A = { X: [], Z: [], psi: [], gap: [], del: [] }; let X = 0, Z = 0, psi = 0, v = 0, r = 0, del = 0;
  for (let i = 0; i < n; i++) {
    const gap = Math.max(3, g0 - Z - Math.sin(psi) * SH.L / 4), f = (U / (8 * KN)) ** 2 * (30 / (gap + 10)) ** 2;
    A.X.push(X); A.Z.push(Z); A.psi.push(psi); A.gap.push(gap); A.del.push(del);
    const cushion = -0.00006 * f, suction = 0.0045 * f;            /* 선수를 안벽 반대(−)로 돌리는 모멘트, 선체를 안벽 쪽(+)으로 끄는 힘 */
    const want = helm ? Math.min(15, Math.max(0, 2.5 * f + 3 * (-1.5 - psi / DEG) - 40 * r / DEG)) : 0; /* 선수를 안벽 반대 1.5°에 두도록 안벽 쪽 타 */ del += Math.max(-2.3, Math.min(2.3, want - del)) * dt;
    const rud = 0.000016 * (U / (8 * KN)) ** 2 * del;              /* 안벽 쪽(+) 타: 선수를 안벽 쪽으로 */
    r += (cushion + rud - 0.06 * r) * dt; v += (suction - 0.05 * v - 0.6 * psi * U * 0.01) * dt * 0.5;
    X += U * Math.cos(psi) * dt; Z += (U * Math.sin(psi) + v) * dt; psi += r * dt;
  }
  return A;
}
export default {
  id: 'bank', dur: 30, scale: 8, flowVis: 3, life: 2.4,
  controls: [
    { k: 'helm', label: '조타', type: 'seg', opts: [['none', '타 중앙'], ['bank', '안벽 쪽으로 대응타']], val: 'none' },
    { k: 'gap', label: '안벽까지 간격', type: 'seg', opts: [[20, '20 m'], [40, '40 m'], [80, '80 m']], val: 20 },
    { k: 'U', label: '선속', type: 'seg', opts: [[6, '6 kn'], [10, '10 kn']], val: 10 }
  ],
  cam: { r: 640, th: 1.2, ph: 0.6, follow: true }, water: { alpha: 0.5, amp: 0.2 }, parts: ['rudder'],
  legend: [['bad', '선수 쿠션(반발)'], ['info', '안벽 쪽 흡인'], ['cool0', '빨라진 물'], ['deck', '항적']],
  chartTitle: '선측과 안벽 사이 간격 (m)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, U = p.U * KN, g0 = +p.gap; this.U = U; this.g0 = g0;
    this.A = sim(U, g0, p.helm === 'bank'); const A = this.A, T = ctx.THREE;
    const zw = hw(0, SH.T) + g0; this.zw = zw;
    const wall = new T.Mesh(new T.BoxGeometry(4000, 30, 6), new T.MeshStandardMaterial({ color: P.sand, roughness: 0.9 })); wall.position.set(1500, -8, zw + 3); ctx.fxW.add(wall);
    const g = []; for (let i = 0; i < A.X.length; i += 3) g.push([A.X[i], A.Z[i]]); this.rib = Ribbon(g, 6, P.deck, 0.6, 0.85); ctx.fxW.add(this.rib);
    this.aC = Arrow(P.bad, 2, { top: true }); this.aS = Arrow(P.info, 2, { top: true }); ctx.fxY.add(this.aC, this.aS);
    const helm = p.helm === 'bank';
    this.steps = [
      { t: 0, h: '안벽 가까이 나란히', p: `${p.U}노트로 안벽(우현)에서 ${g0} m 떨어져 간다. 선체와 안벽 사이로 빠져나가는 물이 빨라져 압력이 떨어진다.` },
      { t: 5, h: '선수 쿠션과 흡인', p: '선수 앞의 높은 압력이 안벽에 막혀 선수를 안벽 반대쪽으로 민다(쿠션 모멘트). 동시에 선체 중앙 쪽 낮은 압력이 무게중심을 안벽 쪽으로 끈다(bank suction). 선미는 안벽 쪽으로 붙는다.' },
      { t: 13, h: helm ? '안벽 쪽으로 대응타' : '타를 쓰지 않으면', p: helm ? '타를 안벽 쪽으로 써서 선수가 밀려나는 모멘트를 맞받는다. 옆 힘과 회두 모멘트가 균형을 이루도록 조타한다. 타각은 15° 이내, 되도록 5° 안쪽이 좋다.' : '선수가 안벽에서 멀어지며 배가 상대 흐름에 비스듬히 놓인다. 비스듬히 나아가면 같은 방향의 모멘트가 더해져 선수가 더 돌아간다. 선미는 안벽에 가까워진다.' },
      { t: 21, h: '더 강해지는 조건', p: '안벽에 가까울수록, 빠를수록, 수심이 얕을수록 세진다. 간격을 지키기 어려우면 속력을 줄인다. 안벽에서 배 길이만큼 떨어지면 영향에서 벗어난다. 경사진 해저를 따라갈 때도 선수가 깊은 쪽으로 돌려 하므로 얕은 쪽으로 타를 쓴다.' }
    ];
    this.st = { u: U, v: 0, r: 0, n: 60, cref: U, zw, gap: g0 };
  },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(A.X.length - 1, Math.round(ts)), ship = this.ctx.ship;
    ship.pose(A.X[i], A.Z[i], A.psi[i]); ship.rudder.rotation.y = A.del[i] * DEG; this.rib.setCount(i / 3); this.i = i; this.ts = ts;
    const f = Math.min(2.5, (30 / (A.gap[i] + 10)) ** 2 * (this.U / (8 * KN)) ** 2);
    this.aC.set(V3(SH.L / 2 - 10, 12, hw(SH.L / 2 - 20, SH.T) + 12), V3(0, 0, -1), 10 + 25 * f);
    this.aS.set(V3(-20, 12, hw(0, SH.T) + 2), V3(0, 0, 1), 6 + 14 * f);
    Object.assign(this.st, { psi: A.psi[i], gap: A.gap[i], zs: A.Z[i] });
  },
  read() {
    const A = this.A, i = this.i;
    return [['경과 시간', realTime(this.ts)], ['선수 쪽 간격', fmt(A.gap[i], 0) + ' m', A.gap[i] < 10 ? 'bad' : A.gap[i] < 20 ? 'warn' : ''], ['선미와 안벽 간격', fmt(this.g0 - A.Z[i] + Math.sin(A.psi[i]) * SH.L / 2, 0) + ' m', this.g0 - A.Z[i] + Math.sin(A.psi[i]) * SH.L / 2 < 18 ? 'warn' : ''], ['선수방위', fmt(Math.abs(A.psi[i] / DEG), 1) + '° ' + (A.psi[i] < -0.001 ? '(안벽 반대쪽)' : A.psi[i] > 0.001 ? '(안벽 쪽)' : '')], ['타각', A.del[i] > 0.2 ? '안벽 쪽 ' + fmt(A.del[i], 0) + '°' : '중앙'], ['선속', this.p.U + ' kn']];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, a = []; for (let i = 0; i < A.X.length; i += 3) a.push([i, A.gap[i]]);
    lineChart(cv, P, { x0: 0, x1: 240, upto: this.ts, cursor: this.ts, xt: [[0, '0'], [120, '2분'], [240, '4분']], series: [{ data: a, color: P.info, min: 0, max: Math.max(100, this.g0 * 1.6), yt: [0, 20, 40, 80], label: '간격 m' }] });
  },
  field(x, y, z, o, st) {
    o.x = -st.u; o.y = 0; o.z = 0; o.k = 0;
    const zr = st.zw - (st.zs || 0); if (z > 0 && z < zr && Math.abs(x) < SH.L / 2 + 20) { o.x *= 1 + 1.2 * Math.max(0, 1 - (zr - hw(0, SH.T)) / 90); o.k = 3; }
    hullDeflect(x, y, z, o);
  },
  spawn(p) { boxSpawn([-200, 260, -14, -0.5, -70, 90], p); }, box: [-260, 320, -18, 1, -120, 140]
};
