/* 6-1 선수 쓰러스터: 선수 회전과 횡이동, 전심의 이동, 선속에 따른 효과 감소 */
import { SH, DEG, KN, XA, XF, smooth, hullHalfWidth as hw } from '../physics/ship.js';
import { THR } from '../engine/ship.js';
import { Arrow, Dot, Line, Ghost, V3, setLine } from '../engine/draw.js';
import { baseWater, hullDeflect, boxSpawn, outBox } from '../engine/flow.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
/* 선속에 따른 효과(정지 = 1): 2~2.5노트에서 절반, 6노트에서 약 30% (모델 값) */
const EFF = [[0, 1], [2.25, 0.5], [6, 0.3], [8, 0.25]];
export function thrEff(kn) { for (let i = 1; i < EFF.length; i++) if (kn <= EFF[i][0]) { const [a, fa] = EFF[i - 1], [b, fb] = EFF[i]; return fa + (fb - fa) * (kn - a) / (b - a); } return EFF[EFF.length - 1][1]; }
const T_ON = 20, RAMP = 15, REAL = 600, YC = THR.y - SH.T, ZT = hw(THR.x, THR.y);
const inTunnel = (x, y, z) => Math.abs(x - THR.x) < THR.r * 1.3 && Math.abs(y - YC) < THR.r * 1.3 && Math.abs(z) < ZT + 1.5;
const nearMouth = (x, y) => Math.abs(x - THR.x) < 12 && Math.abs(y - YC) < 8;
export default {
  id: 'thruster', dur: 30, flowVis: 2.4, life: 2.6, noHull: true,
  controls: [
    { k: 'kn', label: '선속(전진)', type: 'range', min: 0, max: 8, step: 0.5, val: 0, fmt: v => v.toFixed(1) + ' kn' },
    { k: 'ps', label: '쓰러스터 출력', type: 'seg', opts: [[1500, '1,500 PS'], [2000, '2,000 PS']], val: 2000 }
  ],
  water: { alpha: 0.38, amp: 0.15 }, parts: ['thruster'],
  legend: [['jet0', '쓰러스터 배출류'], ['amber', '쓰러스터 추력'], ['info', '무게중심의 횡이동'], ['ok', '전심 P'], ['deck', '선수 항적']],
  chartTitle: '선회율과 선수방위 변화 (시간)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, U = p.kn * KN, eff = thrEff(p.kn), Tt = p.ps / 100;
    this.U = U; this.eff = eff; this.Tt = Tt; this.scale = REAL / this.dur;
    /* 정지 상태 2,000 PS에서 정상 선회율 약 18°/분이 되도록 맞춘 단순 모델(모델 값) */
    const rss = 18 * Math.sqrt(p.ps / 2000) * Math.pow(eff, 0.8) * DEG / 60;
    const dt = 0.5, n = Math.round(REAL / dt) + 1, K = ['X', 'Z', 'psi', 'r', 'v', 'on', 'xp', 'ph'], A = {}; for (const k of K) A[k] = new Float32Array(n);
    let X = 0, Z = 0, psi = 0, r = 0, ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt, on = smooth((t - T_ON) / RAMP);
      /* 전심: 처음 G 뒤 0.15L, 횡이동이 붙으면서 0.43L 쪽으로 옮겨 간다 */
      const xp = -SH.L * (0.15 + 0.28 * smooth((t - T_ON - 30) / 300)), v = -xp * r;
      A.X[i] = X; A.Z[i] = Z; A.psi[i] = psi; A.r[i] = r; A.v[i] = v; A.on[i] = on; A.xp[i] = xp; A.ph[i] = ph;
      X += (U * Math.cos(psi) - v * Math.sin(psi)) * dt; Z += (U * Math.sin(psi) + v * Math.cos(psi)) * dt; psi += r * dt;
      r += (rss * on - r) * dt / 70; ph += on * 0.6 * dt;
    }
    A.dt = dt; A.n = n; this.A = A;
    let i90 = -1; for (let i = 0; i < n; i++) if (A.psi[i] >= 90 * DEG) { i90 = i; break; } this.t90 = i90 >= 0 ? i90 * dt - T_ON : null;
    const S = s => s / this.scale, still = p.kn < 0.25;
    this.steps = [
      { t: 0, h: still ? '정지한 배, 쓰러스터 정지' : `${fmt(p.kn, 1)}노트로 전진 중`, p: `선수 쪽 수면 아래, 선체를 좌우로 뚫은 터널 가운데에 프로펠러가 하나 있다(장면에서는 보이도록 양쪽 입구에 그렸다). 출력 ${fmt(p.ps)} PS, 추력은 100 PS당 약 1톤으로 보아 약 ${fmt(Tt)}톤이다. 컨테이너선은 보통 1,500~2,000 PS를 단다.` },
      { t: S(T_ON), h: 'Bow starboard full', p: '터널 속 임펠러가 돌아 물을 좌현 쪽으로 뿜어낸다. 그 반작용으로 선수가 우현 쪽으로 밀린다. 우현 입구로는 물이 빨려 들어간다.' },
      { t: S(T_ON + 40), h: '두 가지 운동: 회전과 횡이동', p: `추력은 무게중심 G 둘레로 배를 돌리고, 동시에 G를 같은 방향으로 옆으로 민다. 회전 모멘트는 추력 × G에서 쓰러스터까지 거리(약 ${fmt(THR.x)} m)다. 쓰러스터를 선수 끝 가까이 다는 이유다.` },
      { t: S(T_ON + 120), h: '전심이 뒤로 옮겨 간다', p: '처음에는 G 뒤 0.1~0.2L 지점을 중심으로 돈다. 큰 선체 저항 때문에 횡이동은 회전보다 늦게 붙는데, 횡이동 속도가 커질수록 전심은 선미 쪽으로 옮겨 가 마지막에는 G 뒤 0.4~0.45L에 이른다(초록 점).' },
      { t: S(330), h: still ? '정지 상태에서 효과가 가장 크다' : `선속 ${fmt(p.kn, 1)}노트: 효과 ${fmt(eff * 100)}%`, p: still ? '배가 멈춰 있을 때 쓰러스터 효과가 가장 크다. 위 \'선속\'을 올려 보자. 배가 나아가면 배출류가 선체 주변 흐름에 휩쓸려 뒤로 꺾이고 효과가 준다. 2~2.5노트면 절반, 6노트면 30% 안팎만 남아 6노트를 사용 한계로 본다.' : `배출류가 선체를 따라 흐르는 물에 휩쓸려 뒤로 꺾인다(흐름선). 같은 출력이라도 효과가 정지 때의 ${fmt(eff * 100)}%로 줄어 선회가 느리다. 6노트 이상이면 사용 한계로 본다.` },
      { t: S(480), h: '쓰러스터로 조선할 때', p: `${this.t90 != null ? `이 조건에서 선수가 90° 도는 데 약 ${fmt(this.t90 / 60, 1)}분 걸렸다(모델 값). ` : ''}선회하는 동안에도 배는 계속 옆으로 밀린다. 접이안, 저속 침로 유지, 후진 중 선수 유지, 묘박 중 스윙 억제에 쓰고, 홀수가 얕거나 선미 트림으로 터널이 덜 잠기면 효과가 준다.` }
    ];
    ctx.fxW.add(Ghost(0, 0, 0, P.muted, 0.55));
    this.trB = Line([V3(), V3(1, 0, 0)], P.deck, { top: true }); this.trS = Line([V3(), V3(1, 0, 0)], P.muted, { top: true, opacity: 0.8 }); ctx.fxW.add(this.trB, this.trS);
    const yTop = SH.D - SH.T + 4;
    this.aT = Arrow(P.amber, 1.1, { top: true }); this.aV = Arrow(P.info, 1.1, { top: true }); ctx.fxY.add(this.aT, this.aV);
    this.dP = Dot(P.ok, 2.4); this.dG = Dot(P.ink, 1.6); this.dG.position.set(0, yTop, 0); ctx.fxY.add(this.dP, this.dG);
    this.cl = Line([V3(XA, yTop - 0.5, 0), V3(XF, yTop - 0.5, 0)], P.muted, { top: true, dash: 6, opacity: 0.8 }); ctx.fxY.add(this.cl);
    const w = o => { this.ctx.ship.yaw.updateMatrixWorld(); return o.applyMatrix4(this.ctx.ship.yaw.matrixWorld); };
    this.lT = ctx.label('', 'dim', o => w(o.set(THR.x, yTop + 8, 18)));
    this.lV = ctx.label('', 'dim', o => w(o.set(0, yTop + 8, 30)));
    this.lP = ctx.label('', 'dim', o => w(o.set(this.xp || 0, yTop + 6, -12)));
    ctx.label('G', 'dim', o => w(o.set(0, yTop + 4, -8)));
    this.yTop = yTop;
    this.cam = { r: 560, th: 2.25, ph: 0.6, follow: true };
    this.st = { u: U, v: 0, r: 0, jet: 0, cref: 3, jref: 6, y0: 0 };
  },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))), ship = this.ctx.ship;
    const psi = A.psi[i], on = A.on[i], Te = this.Tt * this.eff * on, y = this.yTop;
    ship.pose(A.X[i], A.Z[i], psi); ship.setThr(A.ph[i]);
    this.aT.set(V3(THR.x, y, 0), V3(0, 0, 1), on > 0.02 ? 6 + Te * 1.2 : 0);
    this.aV.set(V3(0, y, 0), V3(0, 0, 1), A.v[i] > 0.01 ? 5 + A.v[i] * 70 : 0);
    const r = A.r[i], xp = A.xp[i]; this.xp = xp; this.dP.visible = r > 0.05 * DEG / 60; this.dP.position.set(xp, y, 0);
    const bp = [], sp = []; for (let k = 0; k <= i; k += 4) { const c = Math.cos(A.psi[k]), s = Math.sin(A.psi[k]); bp.push(V3(A.X[k] + 145 * c, 1.2, A.Z[k] + 145 * s)); sp.push(V3(A.X[k] - 145 * c, 1.2, A.Z[k] - 145 * s)); }
    if (bp.length > 1) { setLine(this.trB, bp); setLine(this.trS, sp); } this.trB.visible = this.trS.visible = bp.length > 1;
    this.lT.set(on > 0.02 ? `<b style="color:var(--amber)">추력 ${fmt(Te, 1)} t</b>` : '');
    this.lV.set(A.v[i] > 0.01 ? `<b style="color:var(--info)">횡이동 ${fmt(A.v[i] / KN, 2)} kn</b>` : '');
    this.lP.set(this.dP.visible ? `<b style="color:var(--ok)">전심 P</b>` : '');
    this.cur = { i, ts, Te };
    Object.assign(this.st, { v: A.v[i], r, jet: 7 * Math.cbrt(this.p.ps / 2000) * on });
  },
  read() {
    const A = this.A, c = this.cur, i = c.i, r = A.r[i] / DEG * 60, still = this.p.kn < 0.25;
    return [['경과 시간', realTime(c.ts)], ['선속', fmt(this.p.kn, 1) + ' kn'], ['출력 / 정지 때 추력', fmt(this.p.ps) + ' PS / 약 ' + fmt(this.Tt) + ' t'],
      ['선속에 따른 효과', fmt(this.eff * 100) + '%', this.eff < 0.4 ? 'bad' : this.eff < 0.8 ? 'warn' : 'ok'], ['유효 추력 T', fmt(c.Te, 1) + ' t'],
      ['회전 모멘트 M = T × X', fmt(c.Te * THR.x) + ' t·m'], ['선회율(ROT)', fmt(r, 1) + '°/분'], ['선수방위 변화', fmt(A.psi[i] / DEG, 0) + '°'],
      [still ? 'G의 횡이동 거리' : '처음 진행선에서 옆으로', fmt(A.Z[i], 0) + ' m'], ['전심 P', r > 0.05 ? 'G 뒤 ' + fmt(-A.xp[i] / SH.L, 2) + 'L (모델 값)' : '아직 돌지 않음']];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, r = [], h = []; for (let i = 0; i < A.n; i += 4) { r.push([i * A.dt, A.r[i] / DEG * 60]); h.push([i * A.dt, A.psi[i] / DEG]); }
    const hm = Math.max(30, Math.ceil(Math.max(...h.map(x => x[1])) / 30) * 30);
    lineChart(cv, P, { x0: 0, x1: REAL, upto: this.cur.ts, cursor: this.cur.ts, right: true, xt: [[0, '0'], [120, '2분'], [240, '4분'], [360, '6분'], [480, '8분'], [600, '10분']],
      series: [{ data: r, color: P.ok, min: 0, max: 20, yt: [0, 10, 20], label: '선회율 (°/분)' }, { data: h, color: P.deck, min: 0, max: hm, axis: true, yt: [0, hm / 2, hm], label: '선수방위 변화 (°)' }] });
  },
  field(x, y, z, o, st) {
    const tun = inTunnel(x, y, z);
    if (!tun) baseWater(x, y, z, o, st);
    const J = st.jet || 0;
    if (J > 0.05) {
      const dx = x - THR.x, dy = y - YC, rr = Math.hypot(dx, dy);
      if (Math.abs(z) <= ZT + 0.5 && rr < THR.r * 1.2) { o.x = 0; o.y = 0; o.z = -J; o.k = 1; return; }
      if (z < -ZT) { const s = -z - ZT, R = THR.r * (1.1 + s / 10); if (s < 70 && rr < R) { const k = (1 - rr / R) * (1 - s / 70); o.z -= J * k * 1.15; if (k > 0.12) o.k = 1; } }
      else if (z > ZT) { const s = z - ZT, R = THR.r * 4; if (s < 30 && rr < R) { const k = (1 - rr / R) * (1 - s / 30); o.z -= J * 0.6 * k; o.x -= dx * 0.1 * k; o.y -= dy * 0.1 * k; } }
    }
    if (!tun && !nearMouth(x, y)) hullDeflect(x, y, z, o);
  },
  spawn(p) {
    const r = Math.random();
    if (r < 0.38) { p.x = THR.x + (Math.random() - 0.5) * 10; p.y = YC + (Math.random() - 0.5) * 7; p.z = ZT + 1 + Math.random() * 14; p.k = 0; return; }
    if (r < 0.5) { p.x = THR.x + (Math.random() - 0.5) * 2; p.y = YC + (Math.random() - 0.5) * 2; p.z = (Math.random() * 2 - 1) * ZT; p.k = 1; return; }
    boxSpawn([10, 260, -14, -0.5, -60, 60], p);
  },
  kill(x, y, z) {
    if (outBox(x, y, z, this.box)) return true;
    if (inTunnel(x, y, z)) return false;
    return y > -SH.T && y < 0.5 && x > XA && x < XF && Math.abs(z) < hw(x, y + SH.T);
  },
  box: [-60, 300, -22, 2, -120, 120]
};
