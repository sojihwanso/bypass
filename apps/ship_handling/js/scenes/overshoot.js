/* 4-2 미드십 타와 반대타의 추가 회두 비교: 같은 초기 상태에서 두 조작을 나란히 */
import { DEG, KN } from '../physics/ship.js';
import { overshootAfter } from '../physics/maneuver.js';
import { Ribbon, Line, Ghost, V3, setLine } from '../engine/draw.js';
import { maneuverField, maneuverSpawn, MBOX, trackPts } from './zigzag.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
export default {
  id: 'overshoot', dur: 30, flowVis: 9, life: 2.6, box: MBOX, field: maneuverField, spawn: maneuverSpawn,
  controls: [
    { k: 'show', label: '배가 따를 조작', type: 'seg', opts: [['counter', '반대타'], ['mid', '미드십 타']], val: 'counter' },
    { k: 'c', label: '반대타 각', type: 'range', min: 5, max: 20, step: 5, val: 10, fmt: v => v + '°' },
    { k: 'T', label: 'T′ 추종성', type: 'range', min: 0.8, max: 3.0, step: 0.1, val: 1.2, fmt: v => fmt(v, 1) }
  ],
  cam: { r: 1700, th: 2.3, ph: 0.5 }, water: { alpha: 0.6, amp: 0.3 }, parts: ['rudder'],
  get legend() { return [['deck', '반대타 항적'], ['amber', '미드십 타 항적'], ['muted', '조작 시점']]; },
  chartTitle: '선수방위 변화 (시간)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P;
    const mid = overshootAfter({ mode: 'mid', Tp: p.T }), ctr = overshootAfter({ mode: 'counter', counter: p.c, Tp: p.T });
    this.mid = mid; this.ctr = ctr; this.main = p.show === 'mid' ? mid : ctr; this.other = p.show === 'mid' ? ctr : mid;
    const dur = Math.max(mid.A.dur, ctr.A.dur) + 30; this.scale = dur / this.dur; this.durS = dur;
    const S = s => s / this.scale, tS = mid.tSwitch;
    this.steps = [
      { t: 0, h: '우현 10° 전타', p: '16노트로 직진하다 우현 10°를 준다. 두 경우 모두 여기까지는 똑같다.' },
      { t: S(tS), h: '선수방위 20°에서 조작', p: `선수가 우현으로 20° 돌았을 때, 한 쪽은 타를 미드십(0°)으로, 다른 쪽은 좌현 ${p.c}° 반대타를 쓴다. 이 순간 두 배는 같은 선회율로 돌고 있다.` },
      { t: S(tS) + 3, h: '회두 관성', p: '타를 돌려도 선수는 바로 멈추지 않는다. 배는 무거운 회전체라서 이미 생긴 선회 관성(회두 각운동량)이 남아 같은 쪽으로 계속 돈다. 이 추가 회두각이 오버슈트각이다.' },
      { t: S(ctr.A.dur), h: `반대타: 추가 회두 ${fmt(ctr.extra, 1)}°`, p: '반대타는 반대쪽 회두 모멘트를 바로 걸어 선회 관성을 적극적으로 줄인다. 선회가 빨리 멈춰 추가 회두각이 작다.' },
      { t: S(mid.A.dur), h: `미드십 타: 추가 회두 ${fmt(mid.extra, 1)}°`, p: '미드십 타는 새 모멘트를 걸지 않고 물의 저항으로 선회 관성이 저절로 줄기를 기다린다. 시간이 오래 걸려 추가 회두각이 크다. T가 클수록(추종성이 나쁠수록) 더 크다.' }
    ].sort((a, b) => a.t - b.t);
    this.ribM = Ribbon(trackPts(this.main.A, 4), 7, p.show === 'mid' ? P.amber : P.deck, 0.7); this.ribO = Ribbon(trackPts(this.other.A, 4), 5, p.show === 'mid' ? P.deck : P.amber, 0.65, 0.7);
    ctx.fxW.add(this.ribM, this.ribO);
    this.ghost = Ghost(0, 0, 0, p.show === 'mid' ? P.deck : P.amber, 0.8); ctx.fxW.add(this.ghost);
    const iS = Math.round(tS / mid.A.dt), X = mid.A.X[iS], Z = mid.A.Z[iS];
    ctx.fxW.add(Line([V3(X, 1, Z - 80), V3(X, 1, Z + 80)], P.muted, { dash: 10 }));
    ctx.label('조작 시점', 'dim', o => o.set(X, 6, Z - 90));
    ctx.fxW.add(Line([V3(-200, 0.6, 0), V3(3000, 0.6, 0)], P.muted, { dash: 30, opacity: 0.5 }));
    this.hM = Line([V3(), V3(1, 0, 0)], p.show === 'mid' ? P.amber : P.deck, { top: true }); this.hO = Line([V3(), V3(1, 0, 0)], p.show === 'mid' ? P.deck : P.amber, { top: true, dash: 12 }); ctx.fxW.add(this.hM, this.hO);
    this.lM = ctx.label('', 'dim', o => o.copy(this.pM || V3())); this.lO = ctx.label('', 'dim', o => o.copy(this.pO || V3()));
    this.cam = { r: 1500, th: 2.6, ph: 0.38, follow: true };
    this.st = { u: 16 * KN, v: 0, r: 0, n: 84, cref: 16 * KN };
  },
  idx(A, ts) { return Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))); },
  apply(t) {
    const ts = t * this.scale, A = this.main.A, B = this.other.A, i = this.idx(A, ts), j = this.idx(B, ts), ship = this.ctx.ship;
    ship.pose(A.X[i], A.Z[i], A.psi[i], A.phi[i] * 2); ship.rudder.rotation.y = A.del[i];
    this.ghost.position.set(B.X[j], 0.8, B.Z[j]); this.ghost.rotation.y = -B.psi[j];
    this.ribM.setCount(i / 4); this.ribO.setCount(j / 4);
    const tS = this.mid.tSwitch, after = ts > tS;
    const HL = 700, tip = (X, Z, ps) => V3(X + HL * Math.cos(ps), 4, Z + HL * Math.sin(ps));
    setLine(this.hM, [V3(A.X[i], 4, A.Z[i]), tip(A.X[i], A.Z[i], A.psi[i])]); setLine(this.hO, [V3(B.X[j], 4, B.Z[j]), tip(B.X[j], B.Z[j], B.psi[j])]);
    this.pM = tip(A.X[i], A.Z[i], A.psi[i]); this.pO = tip(B.X[j], B.Z[j], B.psi[j]);
    const name = m => m === this.mid ? '미드십 타' : `반대타 ${this.p.c}°`;
    this.lM.set(after ? `<b>${name(this.main)}</b><i>+${fmt((A.psi[i] / DEG) - this.main.psiSwitch, 1)}°</i>` : '');
    this.lO.set(after ? `<b>${name(this.other)}</b><i>+${fmt((B.psi[j] / DEG) - this.other.psiSwitch, 1)}°</i>` : '');
    Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i] }); this.ts = ts; this.i = i; this.j = j;
  },
  read() {
    const A = this.main.A, i = this.i, after = this.ts > this.mid.tSwitch;
    return [['경과 시간', realTime(this.ts)], ['따르는 조작', this.p.show === 'mid' ? '미드십 타' : `반대타 ${this.p.c}°`], ['선수방위 변화', sgn(A.psi[i] / DEG, 1) + '°'], ['선회율 ROT', sgn(A.r[i] / DEG * 60, 0) + '°/분'],
      ['추가 회두 (미드십)', after ? fmt(this.mid.extra, 1) + '°' : '조작 전'], ['추가 회두 (반대타)', after ? fmt(this.ctr.extra, 1) + '°' : '조작 전', 'ok']];
  },
  chart(cv, P, { lineChart }) {
    const m = [], c = []; for (let i = 0; i < this.mid.A.n; i += 6) m.push([i * this.mid.A.dt, this.mid.A.psi[i] / DEG]); for (let i = 0; i < this.ctr.A.n; i += 6) c.push([i * this.ctr.A.dt, this.ctr.A.psi[i] / DEG]);
    const mx = Math.max(...m.map(x => x[1])) * 1.15;
    lineChart(cv, P, { x0: 0, x1: this.durS, upto: this.ts, cursor: this.ts, xt: [[0, '0'], [this.mid.tSwitch, '조작'], [this.durS, realTime(this.durS)]], series: [{ data: m, color: P.amber, min: 0, max: mx, yt: [0, 20, Math.round(mx / 1.15)], hlines: [20], label: '미드십 타' }, { data: c, color: P.deck, min: 0, max: mx, label: '반대타' }] });
  }
};
