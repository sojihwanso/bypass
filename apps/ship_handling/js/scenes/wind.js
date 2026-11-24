/* 7-1 바람: 풍압 중심, 풍압 모멘트, 선수의 향풍성, 저속에서 커지는 바람의 영향 */
import { SH, DEG, KN } from '../physics/ship.js';
import { Arrow, Dot, Ribbon, V3 } from '../engine/draw.js';
import { boxSpawn, hullDeflect } from '../engine/flow.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
/* 선수에서 풍압 중심까지 a = (0.291 + 0.0023θ)L, 풍압 모멘트 ∝ sinθ · (0.5 − a/L) (교재 근사식) */
const aRatio = th => 0.291 + 0.0023 * th;
const mWind = th => Math.sin(th * DEG) * (0.5 - aRatio(th));
const KH = 0.00006, KW = 0.0000012; /* head pusher, 풍압 모멘트 계수(가정) */
export default {
  id: 'wind', dur: 30, scale: 8, flowVis: 3, life: 2.4,
  controls: [
    { k: 'th', label: '상대 풍향 (우현에서)', type: 'range', min: 10, max: 170, step: 10, val: 40, fmt: v => v + '°' },
    { k: 'ratio', label: '풍속 / 선속', type: 'seg', opts: [[2, '2'], [4, '4'], [8, '8']], val: 4 }
  ],
  cam: { r: 800, th: 2.3, ph: 0.55, follow: true }, water: { alpha: 0.55, amp: 0.25 }, parts: ['hull'],
  legend: [['air1', '바람'], ['amber', '풍압 횡력과 풍압 중심'], ['info', '물의 저항(head pusher)'], ['deck', '항적']],
  chartTitle: '상대 풍향에 따른 풍압 모멘트 (+ 선수를 풍하로)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, th = p.th, U = 6 * KN, Va = p.ratio * U;
    /* 단순 모델(모델 값): 풍압 횡력에 따른 횡표류, 풍압 모멘트와 비스듬한 흐름이 선수에 만드는 head pusher 모멘트의 합으로 회두 */
    const dt = 1, n = 241, A = { X: [], Z: [], psi: [], v: [], r: [] }; let X = 0, Z = 0, psi = 0, v = 0, r = 0;
    for (let i = 0; i < n; i++) {
      const rel = th - psi / DEG, s = Math.sin(rel * DEG), Y = 0.002 * Va * Va * s;
      A.X.push(X); A.Z.push(Z); A.psi.push(psi); A.v.push(v); A.r.push(r);
      v += (-Y - 0.08 * v * Math.abs(v) * 20) * dt / 60;              /* 풍하(−z)로 표류 */
      r += (KH * U * (-v) - KW * Va * Va * mWind(rel) - 0.05 * r) * dt;
      X += (U * Math.cos(psi) - v * Math.sin(psi)) * dt; Z += (U * Math.sin(psi) + v * Math.cos(psi)) * dt; psi += r * dt;
    }
    this.A = A; this.n = n; this.th = th; this.U = U; this.Va = Va;
    const lead = mWind(th) > 0 && th < 90;
    this.steps = [
      { t: 0, h: `우현 ${th}°에서 바람`, p: `선속 6노트, 풍속은 그 ${p.ratio}배다. 풍압 합력이 걸리는 점이 풍압 중심이다. 선수에서 a = (0.291 + 0.0023θ)L, 지금은 선수에서 약 ${fmt(aRatio(th), 2)}L 지점이다. 바람이 앞에서 올수록 선수 쪽, 뒤로 갈수록 선미 쪽으로 옮겨 간다.` },
      { t: 6, h: '풍하로 밀린다', p: '풍압의 옆 성분 Y = F·sinα가 배를 바람 아래쪽으로 민다. 배는 선수 방향과 어긋난 사선 항적을 그린다. 실제 바람은 고르지 않아 평균 풍속의 1.25배(아주 강하면 1.5배)를 돌풍 요소로 쓴다.' },
      { t: 13, h: lead ? '두 모멘트가 겨룬다' : '두 모멘트가 같은 쪽', p: lead ? '풍압 중심이 무게중심 앞에 있어 바람은 선수를 풍하로 돌리려 한다. 그런데 배가 비스듬히 나아가며 물에 잠긴 선수의 풍하 쪽에 물이 부딪혀 선수를 풍상으로 밀어 올린다(head pusher). 물의 저항이 공기보다 커서 대개 선수는 풍상으로 돈다.' : '풍압 중심이 무게중심 뒤에 있어 바람이 선미를 풍하로 민다. head pusher도 선수를 풍상으로 돌리니 두 모멘트가 더해져 선수가 풍상으로 더 크게 돈다.' },
      { t: 21, h: '선수의 향풍성', p: '전진 중 선수가 바람 쪽으로 돌아가려는 이 경향을 선수의 향풍성이라 한다. 후진 중에는 선미가 바람 쪽으로 돈다(선미의 향풍성). 저속이고 바람이 앞쪽 작은 각도에서 세게 오면 반대로 선수가 바람을 피해 돌기도 한다(이풍성).' }
    ];
    const g = []; for (let i = 0; i < n; i += 3) g.push([A.X[i], A.Z[i]]); this.rib = Ribbon(g, 8, P.deck, 0.6, 0.85); ctx.fxW.add(this.rib);
    this.aY = Arrow(P.amber, 2, { top: true }); this.aH = Arrow(P.info, 2, { top: true }); this.cp = Dot(P.amber, 4); ctx.fxY.add(this.aY, this.aH, this.cp);
    this.lC = ctx.label('', 'dim', o => o.copy(this.pC || V3()));
    this.st = { u: U, v: 0, r: 0, n: 0, cref: U, aref: Va, th };
  },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(this.n - 1, Math.round(ts)), ship = this.ctx.ship;
    ship.pose(A.X[i], A.Z[i], A.psi[i]); this.rib.setCount(i / 3); this.i = i; this.ts = ts;
    const rel = this.th - A.psi[i] / DEG, xa = SH.L / 2 - aRatio(rel) * SH.L, W = v => { ship.yaw.updateMatrixWorld(); return v.applyMatrix4(ship.yaw.matrixWorld); };
    this.cp.position.set(xa, 30, 0); this.aY.set(V3(xa, 30, 60), V3(0, 0, -1), Math.max(1, 0.5 * this.Va * Math.abs(Math.sin(rel * DEG)) * 6));
    this.aH.set(V3(SH.L / 2 - 30, 6, -60), V3(0, 0, 1), t > 6 ? 30 : 0.01);
    this.pC = W(V3(xa, 50, 0)); this.lC.set(`<b style="color:var(--amber)">풍압 중심</b><i>선수에서 ${fmt(aRatio(rel), 2)}L</i>`);
    Object.assign(this.st, { u: this.U, v: A.v[i], r: A.r[i], th: rel, psi: A.psi[i] });
  },
  read() {
    const A = this.A, i = this.i, rel = this.th - A.psi[i] / DEG;
    return [['경과 시간', realTime(this.ts)], ['상대 풍향', fmt(rel, 0) + '° (우현)'], ['풍속 / 선속', this.p.ratio + ' (풍속 ' + fmt(this.Va, 1) + ' m/s)'], ['풍압 중심', '선수에서 ' + fmt(aRatio(rel), 2) + 'L'],
      ['선수방위 변화', fmt(Math.abs(A.psi[i] / DEG), 1) + '° ' + (A.psi[i] > 0.001 ? '(풍상 쪽)' : A.psi[i] < -0.001 ? '(풍하 쪽)' : '')], ['풍하 표류', fmt(-A.Z[i], 0) + ' m'], ['결과', '선수의 향풍성 (모델 값)']];
  },
  chart(cv, P, { lineChart }) {
    const a = []; for (let th = 0; th <= 180; th += 2) a.push([th, mWind(th)]);
    lineChart(cv, P, { x0: 0, x1: 180, xt: [[0, '정선수'], [40, '40°'], [90, '정횡'], [140, '140°'], [180, '정선미']], series: [{ data: a, color: P.amber, min: -0.15, max: 0.15, yt: [-0.1, 0, 0.1], hlines: [0], label: '풍압 모멘트 (Ymax·L 단위)', mark: [this.th, mWind(this.th)] }] });
  },
  field(x, y, z, o, st) {
    if (y > 0.5) { const a = (st.th || 0) * DEG; o.x = -st.u - st.aref * Math.cos(a); o.y = 0; o.z = -st.aref * Math.sin(a); o.k = 2; if (Math.abs(x) < SH.L / 2 && Math.abs(z) < 30 && y < 40) { o.y += 2; } return; }
    o.x = -st.u; o.z = -st.v; o.y = 0; o.k = 0; hullDeflect(x, y, z, o);
  },
  spawn(p) { if (Math.random() < 0.6) { boxSpawn([-260, 260, 4, 46, -140, 140], p, 2); } else boxSpawn([-260, 300, -14, -0.5, -110, 110], p); }, box: [-320, 340, -18, 60, -180, 180]
};
