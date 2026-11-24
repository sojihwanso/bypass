/* 4-5 조종성능 시험: 선회 시험, 지그재그 시험, 스파이럴 시험 */
import { SH, DEG, KN } from '../physics/ship.js';
import { maneuver } from '../physics/maneuver.js';
import { Ribbon, Line, V3 } from '../engine/draw.js';
import { maneuverField, maneuverSpawn, MBOX } from './zigzag.js';
import { turnRun, turnMeasures } from './turning.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const SPIRAL = [25, 20, 15, 10, 5, 0, -5, -10, -15, -20, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25], HOLD = 150;
/* 침로 안정성이 나쁜 배의 δ–r 관계(모식, 가정): δ = (−a·r + b·r³)/k. 원점 근처 기울기가 거꾸로라 작은 타각 범위에서 고리(불안정 구간)가 생긴다 */
function poorCurve() { const c = []; for (let r = -1.1; r <= 1.1001; r += 0.02) c.push([(-0.6 * r + 1.2 * r * r * r) / 0.03, r]); return c; }
export default {
  id: 'trials', flowVis: 9, life: 2.6, box: MBOX, field: maneuverField, spawn: maneuverSpawn,
  controls: [{ k: 'mode', label: '시험', type: 'seg', opts: [['turn', '선회 시험'], ['zig', '지그재그 시험'], ['spiral', '스파이럴 시험']], val: 'turn', restart: true }],
  get dur() { return this.mode === 'spiral' ? 42 : 34; },
  get cam() { return { r: this.camR || 2600, th: 2.2, ph: 0.32, target: () => (this.center || V3()).clone() }; },
  water: { alpha: 0.6, amp: 0.25 }, parts: ['rudder'],
  get legend() { return this.mode === 'spiral' ? [['deck', '항적'], ['info', '좋은 배의 δ–r 곡선'], ['bad', '나쁜 배(모식)']] : [['deck', '무게중심 항적'], ['muted', '원침로']]; },
  get chartTitle() { return this.mode === 'turn' ? '선수방위 변화 (시간)' : this.mode === 'zig' ? '선수방위와 타각 (시간)' : '타각(가로)과 정상 선회율(세로)'; },
  build(ctx, p) {
    this.ctx = ctx; this.mode = p.mode; const P = ctx.P, U0 = 16 * KN;
    let A;
    if (p.mode === 'turn') { A = turnRun(U0, 35); this.m = turnMeasures(A); }
    else if (p.mode === 'zig') {
      let s = 0; const sw = [];
      A = maneuver({ U0, dur: 600, K0: 1.5, Tp: 1.2, cY: 0.12, loss: 0.15, cmd: st => { if (st.t < 5) return 0; if (s === 0) { s = 1; sw.push(st.t); } if (s > 0 && st.psi >= 10 * DEG) { s = -1; sw.push(st.t); } else if (s < 0 && st.psi <= -10 * DEG) { s = 1; sw.push(st.t); } return s * 10; } });
      this.sw = sw;
    } else {
      const tEnd = SPIRAL.length * HOLD;
      A = maneuver({ U0, dur: tEnd, K0: 1.5, Tp: 1.2, cY: 0.12, loss: 0.3, cmd: st => SPIRAL[Math.min(SPIRAL.length - 1, Math.floor(st.t / HOLD))] });
      this.pts = SPIRAL.map((d, k) => { const i = Math.min(A.n - 1, Math.round(((k + 1) * HOLD - 5) / A.dt)); return [d, A.r[i] / DEG]; });
    }
    this.A = A; this.scale = A.dur / this.dur;
    const S = s => s / this.scale;
    if (p.mode === 'turn') this.steps = [
      { t: 0, h: '선회 시험', p: '일정한 속력으로 직진하다가 최대 타각(35°)으로 전타해 360° 돌 때까지 무게중심의 항적을 잰다. 옛날에는 육상 물표나 부표로 눈으로 쟀지만 지금은 GPS로 연속해서 정확히 잰다.' },
      { t: S(this.m.i90 * A.dt), h: '얻는 값', p: '종거, 횡거, 선회경, 최대 종거, 최대 횡거, 최종 선회경 같은 정적인 값과, 편각·킥·속력 감소처럼 선회가 진행되며 바뀌는 값을 함께 얻는다.' },
      { t: S(this.m.i180 * A.dt), h: '선회경', p: `이 모델의 35° 선회경은 약 ${fmt(this.m.td / SH.L, 1)}L이다. 타각과 속력을 바꿔 여러 번 시험한다.` }
    ];
    else if (p.mode === 'zig') this.steps = [
      { t: 0, h: '지그재그 시험', p: '일정한 속력으로 직진한다. 이 시험으로 추종성 지수 T와 선회성 지수 K를 구한다.' },
      { t: S(5), h: '타각 δ 유지', p: '타를 한쪽으로 10° 쓰고 유지한다.' },
      { t: S(this.sw[1] || 40), h: '선수방위가 δ에 닿으면 반대타', p: '선수방위가 10° 바뀌면 반대쪽으로 10°를 쓰고 유지한다. 선수는 관성으로 조금 더 돈 뒤 돌아온다.' },
      { t: S(this.sw[2] || 80), h: '되풀이', p: '선수방위가 반대쪽 10°에 닿을 때마다 타를 바꾼다. 선수방위가 원침로로 돌아오면 끝낸다. 시간에 따른 타각과 선수방위 기록으로 T와 K를 계산한다.' }
    ];
    else this.steps = [
      { t: 0, h: '스파이럴 시험', p: '침로 안정성을 평가한다. 안정성이 좋은 배는 타를 중앙으로 하면 곧 선회가 멈추고, 나쁜 배는 반대타를 써도 잘 멈추지 않는다.' },
      { t: S(HOLD * 1), h: '타각을 줄여 가며 선회율 재기', p: '우현 큰 타각으로 정상 선회에 들게 한 뒤 선회율(ROT)을 잰다. 타각을 한 단계 줄여 다시 정상 선회가 되면 잰다. 이를 좌현 끝까지 되풀이한다.' },
      { t: S(HOLD * 10.5), h: '되돌아오며 재기', p: '좌현에서 우현 쪽으로도 같은 절차를 되풀이한다. 그래프에 타각과 선회율을 점으로 찍는다.' },
      { t: S(HOLD * 18), h: '곡선으로 평가', p: 'δ–r 곡선이 원점을 지나는 한 줄이면 침로 안정성이 좋다. 원점 근처에서 고리 모양이 생기면 나쁘다. 고리가 걸친 타각 범위(δ1~δ2)가 넓을수록 불안정하다(붉은 선은 나쁜 배의 모식).' }
    ];
    const g = []; for (let i = 0; i < A.n; i += 4) g.push([A.X[i], A.Z[i]]);
    this.rib = Ribbon(g, p.mode === 'spiral' ? 10 : 16, P.deck, 0.6, 0.85); ctx.fxW.add(this.rib);
    ctx.fxW.add(Line([V3(-500, 0.7, 0), V3(1500, 0.7, 0)], P.muted, { dash: 30 }));
    let mx = 0, Mx = 0, mz = 0, Mz = 0; for (let i = 0; i < A.n; i++) { mx = Math.min(mx, A.X[i]); Mx = Math.max(Mx, A.X[i]); mz = Math.min(mz, A.Z[i]); Mz = Math.max(Mz, A.Z[i]); }
    this.center = V3((mx + Mx) / 2, 0, (mz + Mz) / 2); this.camR = Math.max(Mx - mx, Mz - mz) * 1.4 + 400;
    this.st = { u: U0, v: 0, r: 0, n: 60, cref: U0 };
  },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))), ship = this.ctx.ship;
    ship.pose(A.X[i], A.Z[i], A.psi[i], A.phi[i]); ship.rudder.rotation.y = A.del[i];
    this.rib.setCount(i / 4); this.i = i; this.ts = ts;
    Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i] });
  },
  read() {
    const A = this.A, i = this.i, base = [['경과 시간', realTime(this.ts)], ['타각', fmt(A.del[i] / DEG, 1) + '°'], ['선수방위 변화', fmt(A.psi[i] / DEG, 0) + '°'], ['선회율', fmt(A.r[i] / DEG * 60, 0) + '°/분']];
    if (this.mode === 'turn') { const m = this.m; return base.concat([['종거 / 횡거', fmt(m.adv / SH.L, 1) + 'L / ' + fmt(m.tr / SH.L, 1) + 'L'], ['선회경', fmt(m.td / SH.L, 1) + 'L'], ['최종 선회경', fmt(m.fd / SH.L, 1) + 'L']]); }
    if (this.mode === 'zig') return base.concat([['방법', '10°/10° 지그재그']]);
    const k = Math.min(SPIRAL.length - 1, Math.floor(this.ts / HOLD)); return base.concat([['지금 단계', `${k + 1} / ${SPIRAL.length} (타각 ${SPIRAL[k]}°)`]]);
  },
  chart(cv, P, { lineChart }) {
    const A = this.A;
    if (this.mode === 'spiral') {
      const k = Math.floor(this.ts / HOLD), done = this.pts.slice(0, Math.max(0, k)), good = this.pts.slice().sort((a, b) => a[0] - b[0]);
      lineChart(cv, P, { x0: -27, x1: 27, xt: [[-25, '좌 25°'], [0, '0'], [25, '우 25°']], series: [{ data: good, color: P.info, min: -1.2, max: 1.2, yt: [-1, 0, 1], label: '좋은 배 (모델 값, °/초)', ...(done.length ? { mark: done[done.length - 1] } : {}) }, { data: poorCurve().filter(q => Math.abs(q[0]) <= 27), color: P.bad, min: -1.2, max: 1.2, label: '나쁜 배 (모식)', dash: [4, 3], width: 1.5 }] });
      return;
    }
    const h = [], d = []; for (let i = 0; i < A.n; i += 6) { h.push([i * A.dt, A.psi[i] / DEG]); d.push([i * A.dt, A.del[i] / DEG]); }
    if (this.mode === 'turn') lineChart(cv, P, { x0: 0, x1: A.dur, upto: this.ts, cursor: this.ts, xt: [[0, '0'], [120, '2분'], [240, '4분'], [360, '6분']].filter(x => x[0] <= A.dur), series: [{ data: h, color: P.deck, min: 0, max: 380, yt: [0, 90, 180, 360], hlines: [90, 180], label: '선수방위 변화 °' }] });
    else lineChart(cv, P, { x0: 0, x1: A.dur, upto: this.ts, cursor: this.ts, xt: [[0, '0'], [300, '5분'], [600, '10분']], series: [{ data: h, color: P.deck, min: -26, max: 26, yt: [-10, 0, 10], hlines: [10, -10], label: '선수방위 °' }, { data: d, color: P.amber, min: -26, max: 26, label: '타각 °', width: 1.5 }] });
  }
};
