/* 4-4 선회 중 선체 운동: 킥과 선미킥, 편각, 속력 감소, 내방·외방 경사, 전심 */
import { SH, DEG, KN } from '../physics/ship.js';
import { Ribbon, Arrow, Dot, Line, V3, setLine } from '../engine/draw.js';
import { maneuverField, maneuverSpawn, MBOX } from './zigzag.js';
import { turnRun, turnMeasures } from './turning.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const HX = 6; /* 경사를 눈에 보이게 키워 그리는 배율 */
export default {
  id: 'turning-motion', dur: 40, flowVis: 7, life: 2.6, box: MBOX, field: maneuverField, spawn: maneuverSpawn,
  controls: [
    { k: 'del', label: '타각', type: 'seg', opts: [[15, '15°'], [35, '35°']], val: 35 },
    { k: 'U', label: '처음 속력', type: 'range', min: 6, max: 20, step: 1, val: 16, fmt: v => v + ' kn' }
  ],
  cam: { r: 620, th: 2.0, ph: 0.62, follow: true }, water: { alpha: 0.55, amp: 0.25 }, parts: ['rudder', 'hull'],
  legend: [['deck', '무게중심 항적'], ['bad', '선미 항적'], ['ink', '선수 방향'], ['amber', '진행 방향'], ['info', '전심']],
  chartTitle: '경사, 속력 비율, 전심 위치 (모델 값)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, U0 = p.U * KN, del = +p.del;
    const A = turnRun(U0, del, 700); this.A = A; const m = turnMeasures(A); this.m = m; this.scale = A.dur / this.dur;
    let iIn = m.i0, iOut = m.i0; for (let i = m.i0; i < A.n; i++) { if (A.phi[i] > A.phi[iIn]) iIn = i; if (A.phi[i] < A.phi[iOut]) iOut = i; }
    this.iIn = iIn; this.iOut = iOut;
    const S = s => s / this.scale, tAt = i => i * A.dt;
    this.steps = [
      { t: 0, h: '직진', p: `${p.U}노트로 직진한다. 회전하지 않으니 전심도 없다.` },
      { t: S(5), h: '조타 직후 내방경사', p: `타를 쓰면 타의 양력이 선체를 바깥쪽으로 민다. 선체는 관성으로 한동안 곧게 가려 해, 이 두 힘의 짝힘으로 배가 <b>선회하는 안쪽</b>으로 잠깐 기운다. 상선에서는 작고 짧다. 장면은 경사를 ${HX}배로 키워 그렸다.` },
      { t: S(tAt(m.ik)), h: '킥과 선미킥', p: `무게중심이 원침로 바깥으로 밀린 거리가 킥(${fmt(m.kick, 0)} m, 모델 값)이고, 선미가 바깥으로 밀려난 것이 선미킥이다. 선미킥은 보통 배 길이의 1/10~1/8로, 선수방위가 5~10° 돌았을 때 가장 크다. 반대쪽 부두나 부표에 주의하고, 익수자나 부유물은 그쪽으로 타를 써서 선미를 떼어 낸다.` },
      { t: S(tAt(m.i90) * 0.55), h: '편각과 전심', p: '선수는 안쪽, 선미는 바깥쪽으로 돌며 배가 비스듬히 나아간다. 선수 방향과 무게중심의 진행 방향 사이가 편각이다. 선수미선 위에서 옆으로 미끄러지지 않는 점이 전심으로, 조타 직후 무게중심 조금 앞에 나타나 선회가 진행되며 선수 쪽으로 옮겨 간다. 보통 선수에서 1/4~1/3L 지점이다.' },
      { t: S(tAt(iOut)), h: '외방경사와 속력 감소', p: '선회가 자리 잡으면 원심력이 커져 배가 <b>바깥쪽</b>으로 기운다. 내방경사에서 외방경사로 넘어갈 때 관성 때문에 가장 크게 기우는데, 이것이 최대 외방경사다. 속력도 프로펠러 효율 감소, 타의 항력, 선체 저항 증가로 90° 회두 때 처음의 약 65%까지 준다.' },
      { t: Math.min(this.dur - 4, S(tAt(m.i180))), h: '큰 외방경사를 막으려면', p: '외방경사가 클 때 갑자기 타를 중앙으로 하면 타의 모멘트가 사라져 오히려 더 기울고, 반대타를 쓰면 내방경사까지 더해져 더 나빠진다. 충분한 복원성을 두고, 저속에서 작은 타각으로 돈다.' }
    ];
    const g = s => { const a = []; for (let i = 0; i < A.n; i += 4) a.push(s(i)); return a; };
    this.rib = Ribbon(g(i => [A.X[i], A.Z[i]]), 10, P.deck, 0.6, 0.85); this.ribS = Ribbon(g(i => [A.X[i] - Math.cos(A.psi[i]) * SH.L / 2, A.Z[i] - Math.sin(A.psi[i]) * SH.L / 2]), 7, P.bad, 0.5, 0.75); ctx.fxW.add(this.rib, this.ribS);
    ctx.fxW.add(Line([V3(m.X0 - 500, 0.7, 0), V3(m.X0 + m.mxA + 300, 0.7, 0)], P.muted, { dash: 30 }));
    this.aH = Arrow(P.ink, 2.2, { top: true }); this.aV = Arrow(P.amber, 2.2, { top: true }); ctx.fxY.add(this.aH, this.aV);
    this.pp = Dot(P.info, 5); ctx.fxY.add(this.pp); this.ppL = Line([V3(), V3(0, 40, 0)], P.info, { top: true }); ctx.fxY.add(this.ppL);
    this.lB = ctx.label('', 'dim', o => o.copy(this.pB || V3())); this.lP = ctx.label('', 'dim', o => o.copy(this.pP || V3())); this.lH = ctx.label('', 'dim', o => o.copy(this.pH || V3()));
    this.st = { u: U0, v: 0, r: 0, n: 60, cref: U0 };
  },
  /* 전심: 컨테이너선 전진 선회 실험 경향(조타 직후 GP ≈ 0.13L, 선회하며 ≈ 0.3L로 앞으로)을 따른 값 */
  pivot(i) { const A = this.A; if (Math.abs(A.r[i]) < 0.0004) return null; const f = Math.min(1, Math.abs(A.psi[i]) / (60 * DEG)); return (0.13 + 0.17 * f) * SH.L; },
  apply(t) {
    const A = this.A, ts = t * this.scale, i = Math.min(A.n - 1, Math.max(0, Math.round(ts / A.dt))), ship = this.ctx.ship;
    ship.pose(A.X[i], A.Z[i], A.psi[i], A.phi[i] * HX); ship.rudder.rotation.y = A.del[i];
    this.rib.setCount(i / 4); this.ribS.setCount(i / 4); this.i = i; this.ts = ts;
    const W = v => { ship.yaw.updateMatrixWorld(); return v.applyMatrix4(ship.yaw.matrixWorld); };
    const beta = Math.atan2(-A.v[i], Math.max(0.3, A.u[i])), y = 34;
    this.aH.set(V3(0, y, 0), V3(1, 0, 0), 140); this.aV.set(V3(0, y, 0), V3(Math.cos(beta), 0, -Math.sin(beta)), 140);
    this.pB = W(V3(150, y + 8, -30)); this.lB.set(beta / DEG > 0.5 ? `<b style="color:var(--amber)">편각 ${fmt(beta / DEG, 1)}°</b>` : '');
    const xp = this.pivot(i); this.pp.visible = this.ppL.visible = xp != null;
    if (xp != null) { this.pp.position.set(xp, 30, 0); setLine(this.ppL, [V3(xp, 4, 0), V3(xp, 30, 0)]); this.pP = W(V3(xp, 44, 0)); this.lP.set(`<b style="color:var(--info)">전심</b><i>G 앞 ${fmt(xp / SH.L, 2)}L</i>`); } else this.lP.set('');
    const ph = A.phi[i] / DEG; this.pH = W(V3(-60, 50, 0)); this.lH.set(Math.abs(ph) > 0.05 ? `<b>${ph > 0 ? '내방경사' : '외방경사'} ${fmt(Math.abs(ph), 1)}°</b><i>그림은 ${HX}배</i>` : '');
    Object.assign(this.st, { u: A.u[i], v: A.v[i], r: A.r[i] });
  },
  read() {
    const A = this.A, m = this.m, i = this.i, ph = A.phi[i] / DEG, xp = this.pivot(i);
    return [['경과 시간', realTime(this.ts)], ['선수방위 변화', fmt(A.psi[i] / DEG, 0) + '°'], ['킥 / 선미킥', i >= m.ik ? fmt(m.kick, 0) + ' m / ' + fmt(m.sk, 0) + ' m (' + fmt(m.sk / SH.L * 100, 0) + '%L)' : '—'],
      ['편각', fmt(Math.atan2(-A.v[i], Math.max(0.3, A.u[i])) / DEG, 1) + '°'], ['속력', fmt(A.u[i] / KN, 1) + ' kn (처음의 ' + fmt(A.u[i] / A.u[0] * 100, 0) + '%)'],
      ['경사', Math.abs(ph) < 0.05 ? '거의 없음' : (ph > 0 ? '내방 ' : '외방 ') + fmt(Math.abs(ph), 1) + '°'], ['최대 외방경사', fmt(-A.phi[this.iOut] / DEG, 1) + '°'], ['전심 위치', xp == null ? '없음(회전 없음)' : '무게중심 앞 ' + fmt(xp / SH.L, 2) + 'L (선수에서 ' + fmt((SH.L / 2 - xp) / SH.L, 2) + 'L)']];
  },
  chart(cv, P, { lineChart }) {
    const A = this.A, h = [], s = [], q = []; for (let i = 0; i < A.n; i += 6) { h.push([i * A.dt, A.phi[i] / DEG]); s.push([i * A.dt, A.u[i] / A.u[0]]); const xp = this.pivot(i); if (xp != null) q.push([i * A.dt, xp / SH.L]); }
    const mh = Math.max(1, ...h.map(x => Math.abs(x[1]))) * 1.2;
    lineChart(cv, P, { x0: 0, x1: A.dur, upto: this.ts, cursor: this.ts, xt: [[0, '0'], [120, '2분'], [240, '4분']].filter(x => x[0] <= A.dur), series: [{ data: h, color: P.amber, min: -mh, max: mh, yt: [0], label: '경사 °(+ 내방)' }, { data: s, color: P.deck, min: 0, max: 1.05, label: '속력 비율' }, { data: q, color: P.info, min: -0.1, max: 0.6, label: '전심 GP/L(무게중심 앞)', width: 1.5 }] });
  }
};
