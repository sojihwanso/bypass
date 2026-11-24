/* 6-2 예선: 멈춘 배를 예선이 옆으로 밀 때, 미는 위치에 따라 전심과 움직임이 어떻게 달라지는가 */
import { SH, DEG, KN, XA, XF, hullHalfWidth as hw } from '../physics/ship.js';
import { Arrow, Dot, Ribbon, V3, Line } from '../engine/draw.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
/* 미는 위치: 선수 끝에서 잰 거리(L 단위). 교재 시뮬레이션의 작용점 A~F 가운데 넷 */
const POS = { A: [0.02, '선수 끝'], C: [0.3, '선수에서 0.3L'], G: [0.5, '무게중심 근처'], F: [0.98, '선미 끝'] };
const F = 22.5 * 9810, REAL = 600, Mv = SH.disp * 1000 * 2.0, k = 0.25 * SH.L, Iz = SH.disp * 1000 * 2.0 * k * k; /* 옆 방향 부가 질량을 배수량만큼 더함(가정) */
const Cv = 0.5 * 1025 * 0.9 * SH.L * SH.T, Cr = 0.5 * 1025 * 0.9 * SH.T * (SH.L ** 4) / 32;
function sim(xa) {
  const dt = 0.5, n = REAL / dt + 1, A = { X: new Float32Array(n), Z: new Float32Array(n), psi: new Float32Array(n), v: new Float32Array(n), r: new Float32Array(n), dt, n };
  let X = 0, Z = 0, psi = 0, v = 0, r = 0;
  for (let i = 0; i < n; i++) {
    const t = i * dt, on = Math.min(1, Math.max(0, (t - 10) / 20)), Ft = F * on;
    A.X[i] = X; A.Z[i] = Z; A.psi[i] = psi; A.v[i] = v; A.r[i] = r;
    v += (Ft - Cv * v * Math.abs(v)) / Mv * dt; r += (Ft * xa - Cr * r * Math.abs(r)) / Iz * dt;
    X += -v * Math.sin(psi) * dt; Z += v * Math.cos(psi) * dt; psi += r * dt;
  }
  return A;
}
export default {
  id: 'tug', dur: 30, scale: REAL / 30,
  controls: [{ k: 'at', label: '예선이 미는 곳', type: 'seg', opts: Object.entries(POS).map(([k, v]) => [k, v[1]]), val: 'A' }],
  cam: { r: 620, th: 2.0, ph: 0.5 }, water: { alpha: 0.55, amp: 0.2 }, parts: ['tug'],
  legend: [['amber', '예선 추력 22.5 t'], ['info', '전심 P'], ['deck', '선수 항적'], ['bad', '선미 항적']],
  chartTitle: '전심 위치(무게중심 앞 +, L)와 선수방위 변화',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, xa = SH.L / 2 - POS[p.at][0] * SH.L; this.xa = xa;
    const A = sim(xa); this.A = A; this.S = REAL / this.dur;
    const ex = { A: '추력을 선수 끝에 주면 전심은 처음에 무게중심 뒤 약 0.1L에 나타난다. 선회가 진행되며 뒤로 옮겨 가다, 많이 돌면 전진 운동이 앞서 다시 앞으로 온다.', C: '선수 쪽을 밀면 회전과 횡이동이 함께 일어난다. 전심은 무게중심 뒤쪽에 나타난다.', G: '무게중심 가까이를 밀면 배는 거의 돌지 않고 옆으로 밀려 간다. 전심은 선수나 선미 끝에서 멀리, 선수미선 연장선 위에 있다.', F: '선미 끝을 밀면 선수 끝을 밀 때와 반대로, 전심이 무게중심 앞쪽에 나타난다.' }[p.at];
    this.steps = [
      { t: 0, h: '멈춰 있는 배', p: '6,000TEU 컨테이너선이 물 위에 멈춰 있다. 좌현에 예선 한 척이 붙어 있다. 직진하거나 멈춰 있으면 전심은 없다.' },
      { t: 10 / this.S, h: `${POS[p.at][1]}을 민다`, p: `예선이 22.5톤으로 선수미선에 직각으로 민다. ${ex}` },
      { t: 120 / this.S, h: '전심은 미는 곳에 따라 정해진다', p: '초기 전심 위치는 예선 추력의 크기와 상관없이 추력을 주는 곳에 따라 정해진다. 무게중심에서 멀리 밀수록 전심은 무게중심 가까이에 생긴다(GP = k² / GC).' },
      { t: 360 / this.S, h: '비교해 보자', p: '위에서 미는 곳을 바꿔 선수·선미 항적과 전심을 비교해 보자. 앞에서 당기고 뒤에서 미는 등 예선 배치를 고르는 근거가 된다.' }
    ];
    const g = f => { const a = []; for (let i = 0; i < A.n; i += 6) a.push(f(i)); return a; };
    const end = (i, s) => [A.X[i] + s * Math.cos(A.psi[i]) * SH.L / 2, A.Z[i] + s * Math.sin(A.psi[i]) * SH.L / 2];
    this.rb = Ribbon(g(i => end(i, 1)), 6, P.deck, 0.6, 0.85); this.rs = Ribbon(g(i => end(i, -1)), 6, P.bad, 0.6, 0.85); ctx.fxW.add(this.rb, this.rs);
    this.tug = ctx.tug; this.tug.visible = true;
    this.aF = Arrow(P.amber, 1.6, { top: true }); ctx.fxY.add(this.aF);
    this.pp = Dot(P.info, 4.5); ctx.fxY.add(this.pp); this.ppL = ctx.label('', 'dim', o => o.copy(this.pP || V3()));
    ctx.fxW.add(Line([V3(XA - 40, 0.8, 0), V3(XF + 40, 0.8, 0)], P.muted, { dash: 12, opacity: 0.7 }));
    this.st = { u: 0, v: 0, r: 0, n: 0, cref: 1 };
  },
  pivot(i) { const A = this.A; if (Math.abs(A.r[i]) < 1e-5) return null; return -A.v[i] / A.r[i]; },
  apply(t) {
    const A = this.A, ts = t * this.S, i = Math.min(A.n - 1, Math.round(ts / A.dt)), ship = this.ctx.ship;
    ship.pose(A.X[i], A.Z[i], A.psi[i]); this.rb.setCount(i / 6); this.rs.setCount(i / 6); this.i = i; this.ts = ts;
    const zt = -(hw(this.xa, SH.T) + 16.5), on = Math.min(1, Math.max(0, (ts - 10) / 20));
    ship.yaw.updateMatrixWorld(); const wp = V3(this.xa, 0, zt).applyMatrix4(ship.yaw.matrixWorld);
    this.tug.position.set(wp.x, 0, wp.z); this.tug.rotation.set(0, -A.psi[i] - Math.PI / 2, 0);
    this.aF.set(V3(this.xa, 14, zt - 30), V3(0, 0, 1), on > 0.02 ? 22 + 10 * on : 0.01);
    const xp = this.pivot(i), show = xp != null && Math.abs(A.psi[i]) > 0.002;
    this.pp.visible = show && Math.abs(xp) < SH.L * 1.5; if (show) { this.pp.position.set(Math.max(-SH.L * 1.5, Math.min(SH.L * 1.5, xp)), 12, 0); ship.yaw.updateMatrixWorld(); this.pP = this.pp.position.clone().add(V3(0, 10, 0)).applyMatrix4(ship.yaw.matrixWorld); }
    this.ppL.set(show ? `<b style="color:var(--info)">전심</b><i>${xp >= 0 ? 'G 앞' : 'G 뒤'} ${fmt(Math.abs(xp) / SH.L, 2)}L</i>` : '');
    this.st.v = A.v[i]; this.st.r = A.r[i];
  },
  read() {
    const A = this.A, i = this.i, xp = this.pivot(i);
    return [['경과 시간', realTime(this.ts)], ['미는 곳', POS[this.p.at][1] + ' (G에서 ' + fmt(Math.abs(this.xa) / SH.L, 2) + 'L ' + (this.xa >= 0 ? '앞' : '뒤') + ')'], ['선수방위 변화', fmt(A.psi[i] / DEG, 1) + '°'], ['선회율', fmt(A.r[i] / DEG * 60, 1) + '°/분'], ['무게중심 횡이동', fmt(Math.hypot(A.X[i], A.Z[i]), 0) + ' m'], ['횡이동 속도', fmt(A.v[i] / KN, 2) + ' kn'],
      ['전심 P', xp == null || Math.abs(A.psi[i]) < 0.002 ? '—' : (Math.abs(xp) > SH.L / 2 ? '선체 밖 ' : '') + (xp >= 0 ? 'G 앞 ' : 'G 뒤 ') + fmt(Math.abs(xp) / SH.L, 2) + 'L (모델 값)']];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, q = [], h = []; for (let i = 0; i < A.n; i += 6) { const xp = this.pivot(i); if (xp != null && Math.abs(A.psi[i]) > 0.002) q.push([i * A.dt, Math.max(-0.8, Math.min(0.8, xp / SH.L))]); h.push([i * A.dt, A.psi[i] / DEG]); }
    const hm = Math.max(10, ...h.map(x => Math.abs(x[1])));
    lineChart(cv, P, { x0: 0, x1: REAL, upto: this.ts, cursor: this.ts, right: true, xt: [[0, '0'], [300, '5분'], [600, '10분']], series: [{ data: q, color: P.info, min: -0.8, max: 0.8, yt: [-0.5, 0, 0.5], hlines: [0], label: '전심 (L)' }, { data: h, color: P.deck, min: -hm, max: hm, axis: true, label: '선수방위 °' }] });
  }
};
