/* 5-2 프로펠러 구조와 종류: 고정피치(FPP)와 가변피치(CPP)의 전진→정지→후진 비교 */
import { DEG, smooth } from '../physics/ship.js';
import { PROP } from '../physics/propeller.js';
import { makePropeller } from '../engine/ship.js';
import { Arrow, Line, V3, setLine } from '../engine/draw.js';
import { boxSpawn } from '../engine/flow.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const Y0 = -8, R = PROP.R, BASE = Math.atan(PROP.P / (2 * Math.PI * 0.7 * R));
export default {
  id: 'propeller', dur: 30, scale: 1, flowVis: 1.4, life: 2.2, noHull: true,
  controls: [
    { k: 'type', label: '종류', type: 'seg', opts: [['fpp', '고정피치 FPP'], ['cpp', '가변피치 CPP']], val: 'fpp' },
    { k: 'n', label: '날개 수', type: 'seg', opts: [[4, '4'], [5, '5'], [6, '6']], val: 5 }
  ],
  cam: { r: 30, th: Math.PI - 0.6, ph: 1.25, target: () => V3(0, -8, 0) }, water: { alpha: 0.12, amp: 0, visible: true }, parts: ['propeller', 'engine'],
  legend: [['deck', '추력 방향'], ['amber', '회전 방향'], ['info', '피치: 한 바퀴에 나아가는 거리'], ['jet0', '배출류']],
  chartTitle: '회전수와 피치, 추력 (시간)',
  get steps() {
    return this.type === 'cpp' ? [
      { t: 0, h: '전진 피치', p: '축은 선미에서 보아 시계 방향으로 일정하게 돈다. 날개가 앞으로 나아가는 나사처럼 비틀려 있어 물을 뒤로 밀어낸다.' },
      { t: 8, h: '피치 0으로', p: '회전수는 그대로 두고 유압 장치로 날개만 돌려 피치를 0으로 만든다. 추력이 사라진다. 기관을 세웠다 다시 시동할 필요가 없다.' },
      { t: 10, h: '피치 0에서 주의할 점', p: '피치 0의 프로펠러는 원반처럼 돌며 타로 가는 흐름을 막는다(disc effect). 타효가 사라져 선수가 뜻하지 않은 쪽으로 돌 수 있다.' },
      { t: 12, h: '후진 피치', p: '날개를 반대쪽으로 더 돌려 피치를 거꾸로 하면, 축은 같은 방향으로 돌아도 물을 앞으로 밀어 후진 추력이 생긴다. 전진에서 후진까지 빠르고 부드럽다.' },
      { t: 20, h: '정리', p: '가변피치는 전후진 전환이 빠르고 아주 느린 속력도 유지하기 쉬워 조종성이 좋다. 여객선, 예인선, 군함에 많이 쓴다. 구조가 복잡하고, 접안 중 계속 도는 날개에 계류삭이 감기지 않게 조심해야 한다.' }
    ] : [
      { t: 0, h: '전진 회전', p: '날개가 보스에 고정되어 피치각이 변하지 않는다. 축이 선미에서 보아 시계 방향(우회전)으로 돌면 물을 뒤로 밀어 전진 추력이 생긴다.' },
      { t: 8, h: '기관 정지', p: '후진하려면 먼저 회전을 멈춰야 한다. 날개는 그대로이니 추력을 바꾸는 방법은 회전 방향과 회전수뿐이다.' },
      { t: 10, h: '재시동, 반대 방향', p: '디젤기관은 압축 공기(시동 공기)로 반대 방향으로 다시 시동한다. 이 사이에 시간이 걸리고, 시동을 자주 되풀이하면 시동 공기가 바닥날 수 있다.' },
      { t: 13, h: '후진 회전', p: '축이 반시계 방향으로 돌면 물을 앞으로 밀어 후진 추력이 생긴다. 후진 때 횡압력은 전진 때와 반대 방향으로 작용한다.' },
      { t: 20, h: '정리', p: '고정피치는 구조가 단순하고 튼튼하며 값이 싸서 대부분의 상선이 쓴다. 날개는 보통 4~6개다. 다만 전후진 전환에 시간이 걸리고 아주 낮은 회전수로는 계속 운전하기 어렵다.' }
    ];
  },
  st0(t) {
    if (this.type === 'cpp') { const pr = t < 8 ? 1 : t < 10 ? 1 - smooth((t - 8) / 2) : t < 12 ? 0 : -0.8 * smooth((t - 12) / 2); return { rpm: 1, pr }; }
    const rpm = t < 8 ? 1 : t < 10 ? 1 - smooth((t - 8) / 2) : t < 11.5 ? 0 : -smooth((t - 11.5) / 2.5);
    return { rpm, pr: 1 };
  },
  build(ctx, p) {
    this.ctx = ctx; this.type = p.type; const P = ctx.P, ship = ctx.ship;
    ship.model.visible = false;
    this.prop = makePropeller(ctx.THREE, { n: +p.n }); this.prop.position.y = Y0; ctx.fxY.add(this.prop); ctx.stage.registerPart(this.prop, 'propeller');
    const T = ctx.THREE, shaftM = new T.MeshStandardMaterial({ color: '#7d878c', metalness: 0.6, roughness: 0.4 });
    const shaft = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 14, 16), shaftM); shaft.rotation.z = Math.PI / 2; shaft.position.set(8, Y0, 0); ctx.fxY.add(shaft);
    if (p.type === 'cpp') { const hb = new T.Mesh(new T.CylinderGeometry(1.25, 1.1, 2.4, 20), new T.MeshStandardMaterial({ color: '#5b6a70', metalness: 0.5, roughness: 0.4 })); hb.rotation.z = Math.PI / 2; hb.position.y = Y0; ctx.fxY.add(hb); }
    this.aT = Arrow(P.deck, 0.35, { top: true }); this.aR = Line([V3(), V3(1, 0, 0)], P.amber, { top: true }); this.aRh = Arrow(P.amber, 0.18, { top: true }); ctx.fxY.add(this.aT, this.aR, this.aRh);
    this.helix = Line([V3(), V3(1, 0, 0)], P.info, { top: true, dash: 0.6 }); ctx.fxY.add(this.helix);
    this.lT = ctx.label('', 'dim', o => o.copy(this.pT || V3())); this.lR = ctx.label('', 'dim', o => o.copy(this.pR || V3())); this.lH = ctx.label('', 'dim', o => o.copy(this.pH || V3()));
    this.angle = 0; this.st = { u: 0, v: 0, r: 0, n: 0, jref: 6, cref: 3 };
  },
  apply(t) {
    const { rpm, pr } = this.st0(t), W = v => { this.ctx.ship.yaw.updateMatrixWorld(); return v.applyMatrix4(this.ctx.ship.yaw.matrixWorld); };
    this.cur = { rpm, pr };
    /* 가변피치: 날개를 반지름 축 둘레로 돌려 피치각을 바꾼다 */
    const target = Math.atan(pr * PROP.P / (2 * Math.PI * 0.7 * R));
    for (const b of this.prop.blades) b.rotation.y = this.type === 'cpp' ? -(target - BASE) : 0;
    const thrust = rpm * Math.abs(rpm) * pr; this.thrust = thrust;
    this.aT.set(V3(thrust >= 0 ? -1.5 : 1.5, Y0, 0), V3(thrust >= 0 ? 1 : -1, 0, 0), Math.abs(thrust) * 7);
    this.pT = W(V3(thrust >= 0 ? 7 : -7, Y0 + 1.2, 0));
    this.lT.set(Math.abs(thrust) > 0.05 ? `<b style="color:var(--deck)">${thrust > 0 ? '전진 추력' : '후진 추력'}</b>` : '<b>추력 없음</b>');
    /* 회전 방향 호 (선미 쪽, x<0 에서 보이게) */
    const sgn = Math.sign(rpm), pts = []; for (let i = 0; i <= 30; i++) { const a = Math.PI * 0.15 + i / 30 * Math.PI * 0.9; pts.push(V3(-2.6, Y0 + (R + 1) * Math.cos(a), sgn * (R + 1) * Math.sin(a))); }
    if (Math.abs(rpm) > 0.05) { this.aR.visible = true; setLine(this.aR, pts); const e = pts[pts.length - 1], d = e.clone().sub(pts[pts.length - 2]).normalize(); this.aRh.set(e, d, 0.9); } else { this.aR.visible = false; this.aRh.visible = false; }
    this.pR = W(V3(-2.6, Y0 + R + 2.4, 0)); this.lR.set(Math.abs(rpm) > 0.05 ? `<b style="color:var(--amber)">${rpm > 0 ? '시계 방향' : '반시계 방향'}</b><i>선미에서 볼 때</i>` : '');
    /* 피치 나선: 날개 끝 한 점이 한 바퀴 돌며 축 방향으로 나아가는 거리 */
    const hp = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * 2 * Math.PI; hp.push(V3(-pr * PROP.P * i / 60, Y0 + R * Math.cos(a), R * Math.sin(a))); }
    setLine(this.helix, hp); this.pH = W(V3(-pr * PROP.P - 1, Y0 + R + 1, 0)); this.lH.set(`<b style="color:var(--info)">피치 ${fmt(Math.abs(pr) * PROP.P, 1)} m</b>`);
    Object.assign(this.st, { n: rpm * 70 * Math.sign(pr || 0) * Math.abs(pr), rpmv: rpm });
  },
  propObj() { return this.prop; },
  tick(dt) { this.prop.rotation.x += this.cur.rpm * dt * 3.2; },
  read() {
    const { rpm, pr } = this.cur, ang = Math.atan(pr * PROP.P / (2 * Math.PI * 0.7 * R)) / DEG;
    return [['종류', this.type === 'cpp' ? '가변피치 (CPP)' : '고정피치 (FPP)'], ['축 회전', Math.abs(rpm) < 0.02 ? '정지' : (rpm > 0 ? '시계 방향' : '반시계 방향') + ' ' + fmt(Math.abs(rpm) * 100, 0) + '%'], ['피치', fmt(pr * PROP.P, 1) + ' m (피치비 ' + fmt(pr * PROP.P / (2 * R), 2) + ')'], ['피치각 (0.7R)', fmt(ang, 1) + '°'], ['추력', Math.abs(this.thrust) < 0.02 ? '없음' : (this.thrust > 0 ? '전진 ' : '후진 ') + fmt(Math.abs(this.thrust) * 100, 0) + '%', Math.abs(this.thrust) < 0.02 ? 'warn' : '']];
  },
  chart(cv, P, { lineChart, t }) {
    const r = [], q = [], th = []; for (let x = 0; x <= this.dur; x += 0.25) { const s = this.st0(x); r.push([x, s.rpm]); q.push([x, s.pr]); th.push([x, s.rpm * Math.abs(s.rpm) * s.pr]); }
    lineChart(cv, P, { x0: 0, x1: this.dur, cursor: t, xt: [[0, '0'], [8, '정지 시작'], [13, '후진'], [30, '30초']], series: [{ data: r, color: P.amber, min: -1.1, max: 1.1, yt: [-1, 0, 1], label: '회전' }, { data: q, color: P.info, min: -1.1, max: 1.1, label: '피치' }, { data: th, color: P.deck, min: -1.1, max: 1.1, label: '추력', width: 2.5 }] });
  },
  field(x, y, z, o, st, time) {
    o.x = -0.4; o.y = 0; o.z = 0; o.k = 0;
    const yy = y - Y0, f = st.n / 70, rr = Math.hypot(yy, z); if (Math.abs(f) < 0.02) return;
    const Rr = R * (1.1 + Math.max(0, -x * Math.sign(f)) / 25);
    if (rr < Rr) { const k = 1 - rr / Rr; o.x -= 6 * f * k; const om = 0.6 * f * k * Math.sign(st.rpmv || 1); o.y -= z * om; o.z += yy * om; o.k = 1; }
    void time;
  },
  spawn(p) { boxSpawn([-30, 14, Y0 - 7, Y0 + 7, -7, 7], p); }, box: [-40, 22, Y0 - 10, Y0 + 10, -10, 10]
};
