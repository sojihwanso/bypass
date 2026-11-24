/* 2-1 6자유도 운동: 하나씩 또는 한꺼번에. 복원력 있는 운동(히빙·롤링·피칭)에는 부력과 무게 화살표를 겹쳐 보인다. */
import { SH, DEG } from '../physics/ship.js';
import { SEC0, bmLong } from '../physics/stability.js';
import { Arrow, Dot, V3 } from '../engine/draw.js';
import { baseWater, hullDeflect, boxSpawn } from '../engine/flow.js';
const sgn = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const M = [
  { n: '서징 (Surging)', kr: '전후동요', ax: 'x', rot: false, A: 10, u: 'm', rest: false, h: '서징, 전후동요', p: 'x축(선수미 방향)을 따라 앞뒤로 움직인다. 선수나 선미에서 오는 파도, 추력과 저항의 차이 때문에 생긴다. 이 방향으로는 되돌려 놓는 힘이 없다.' },
  { n: '스웨잉 (Swaying)', kr: '좌우동요', ax: 'y', rot: false, A: 8, u: 'm', rest: false, h: '스웨잉, 좌우동요', p: 'y축(정횡 방향)을 따라 옆으로 밀린다. 옆에서 오는 파도와 바람, 예선이 미는 힘이 원인이다. 밀린 배를 제자리로 돌려놓는 힘은 없다.' },
  { n: '히빙 (Heaving)', kr: '상하동요', ax: 'z', rot: false, A: 3, u: 'm', rest: true, h: '히빙, 상하동요', p: 'z축(연직)을 따라 오르내린다. 더 가라앉으면 잠긴 부피가 늘어 부력이 무게보다 커지고, 떠오르면 반대가 된다. 이 차이가 배를 원래 흘수로 되돌린다.' },
  { n: '롤링 (Rolling)', kr: '횡동요', ax: 'x', rot: true, A: 10, u: '°', rest: true, h: '롤링, 횡동요', p: 'x축을 중심으로 좌우로 기운다. 기울면 부심 B가 낮아진 쪽으로 옮겨 가 부력과 무게가 짝힘을 이루고, 이 짝힘이 배를 되돌린다. 되돌아오는 주기는 GM으로 정해진다.' },
  { n: '피칭 (Pitching)', kr: '종동요', ax: 'y', rot: true, A: 2.5, u: '°', rest: true, h: '피칭, 종동요', p: 'y축을 중심으로 선수와 선미가 번갈아 들린다. 롤링과 같은 원리로 되돌아오는데, 배가 길어 종방향 복원력이 훨씬 커서 각도가 작고 빨리 되돌아온다.' },
  { n: '요잉 (Yawing)', kr: '선수동요', ax: 'z', rot: true, A: 6, u: '°', rest: false, h: '요잉, 선수동요', p: 'z축을 중심으로 선수가 좌우로 돈다. 수평으로 돌 뿐 잠긴 모양은 그대로라 되돌리는 힘이 없다. 그래서 침로는 조타로 계속 잡아 줘야 한다.' }
];
export default {
  id: 'dof', scale: 1, flowVis: 6, life: 3,
  get dur() { return this.solo >= 0 ? 12 : 36; },
  controls: [{ k: 'mode', label: '보기', type: 'seg', many: true, opts: [['one', '차례로'], ['all', '한꺼번에'], ['0', '서징'], ['1', '스웨잉'], ['2', '히빙'], ['3', '롤링'], ['4', '피칭'], ['5', '요잉']], val: 'one', restart: true }],
  cam: { r: 560, th: 2.3, ph: 1.12 }, water: { alpha: 0.55, amp: 1.0 }, parts: ['hull', 'propeller', 'rudder', 'radar', 'engine'],
  legend: [['amber', 'x 선수미축'], ['sea-c', 'y 정횡축'], ['deck', 'z 연직축'], ['info', '부력'], ['bad', '무게']],
  chartTitle: '여섯 운동의 지금 크기 (최대 대비)',
  build(ctx, p) {
    this.mode = p.mode; this.solo = /^[0-5]$/.test(String(p.mode)) ? +p.mode : -1; const P = ctx.P;
    this.steps = this.solo >= 0 ? [{ t: 0, h: M[this.solo].h, p: M[this.solo].p + ' 다른 운동은 멈춰 두었다. \'조건 바꾸기\' 칸에서 다른 운동을 고르거나 \'차례로\'로 돌아간다.' }] : p.mode === 'one' ? M.map((m, i) => ({ t: i * 6, h: m.h, p: m.p })) : [
      { t: 0, h: '여섯 운동이 함께', p: '실제 바다에서는 여섯 운동이 서로 다른 주기로 겹친다. 비스듬히 파도를 받으면 롤링, 피칭, 히빙, 요가 함께 생긴다. 이렇게 섞인 움직임을 결합운동이라 한다.' },
      { t: 12, h: '롤링과 요잉의 결합', p: '배가 기울면 물에 잠긴 모양이 좌우 비대칭이 되어 선수가 한쪽으로 돌려는 힘이 생긴다. 롤링이 클수록 침로를 잡기 어려운 이유다.' },
      { t: 24, h: '되돌아오는 운동과 아닌 운동', p: '히빙·롤링·피칭은 부력과 무게가 어긋나며 생기는 힘으로 제자리로 돌아온다. 서징·스웨잉·요잉에는 그런 힘이 없어, 바람과 파도에 밀린 만큼 그대로 남는다.' }
    ];
    const mk = (c, len, dir) => { const a = Arrow(c, 0.9, { top: true }); ctx.fxR.add(a); a.set(V3(), dir, len); return a; };
    this.ax = { x: mk(P.amber, 190, V3(1, 0, 0)), y: mk(P['sea-c'] || P.info, 60, V3(0, 0, 1)), z: mk(P.deck || P.accent, 52, V3(0, 1, 0)) };
    const lp = (x, y, z) => o => { ctx.fxR.updateMatrixWorld(); return o.set(x, y, z).applyMatrix4(ctx.fxR.matrixWorld); };
    ctx.label('x 선수미축', 'dim', lp(200, 0, 0)); ctx.label('y 정횡축', 'dim', lp(0, 0, 68)); ctx.label('z 연직축', 'dim', lp(0, 60, 0));
    const T = ctx.THREE;
    this.ring = new T.Mesh(new T.TorusGeometry(1, 0.014, 6, 64, Math.PI * 1.6), new T.MeshBasicMaterial({ color: P.amber, depthTest: false, transparent: true })); this.ring.renderOrder = 6; ctx.fxR.add(this.ring);
    this.aB = Arrow(P.info, 0.8, { top: true }); this.aW = Arrow(P.bad, 0.8, { top: true }); this.dB = Dot(P.info, 1.6); this.dG = Dot(P.bad, 1.6);
    ctx.fxY.add(this.aB, this.aW, this.dB, this.dG);
    this.lB = ctx.label('', 'dim', o => o.copy(this.pB || V3())); this.lG = ctx.label('', 'dim', o => o.copy(this.pG || V3()));
    this.ctx = ctx; this.st = { u: 1.0, v: 0, r: 0, cref: 2 };
  },
  vals(t) {
    const v = [0, 0, 0, 0, 0, 0];
    if (this.solo >= 0) { const k = this.solo; v[k] = M[k].A * Math.min(1, t / 1.2) * Math.sin(2 * Math.PI * t / 3); return { v, k }; }
    if (this.mode === 'one') { const k = Math.min(5, Math.max(0, Math.floor(t / 6))), tau = t - k * 6, env = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, tau / 6))), 0.6); v[k] = M[k].A * env * Math.sin(2 * Math.PI * tau / 3); return { v, k }; }
    const Pd = [9, 11, 7, 12.4, 6.3, 15], ph = [0, 1, 2, 0.5, 0.3, 2];
    for (let i = 0; i < 6; i++) v[i] = M[i].A * 0.55 * Math.sin(2 * Math.PI * t / Pd[i] + ph[i]);
    return { v, k: -1 };
  },
  apply(t) {
    const { v, k } = this.vals(t); this.cur = { v, k }; const ship = this.ctx.ship;
    ship.pose(v[0], v[1], v[5] * DEG, v[3] * DEG, v[4] * DEG, v[2]);
    for (const [key, a] of Object.entries(this.ax)) a.mat.opacity = (k < 0 || M[k].ax === key) ? 1 : 0.22;
    if (k >= 0 && M[k].rot) {
      this.ring.visible = true; const ax = M[k].ax; this.ring.scale.setScalar(ax === 'x' ? 26 : ax === 'y' ? 40 : 60); this.ring.rotation.set(0, 0, 0);
      if (ax === 'x') { this.ring.rotation.y = Math.PI / 2; this.ring.position.set(90, 0, 0); } else if (ax === 'y') this.ring.position.set(0, 0, 30); else { this.ring.rotation.x = Math.PI / 2; this.ring.position.set(0, 20, 0); }
    } else this.ring.visible = false;
    /* 부력·무게 화살표 (복원력이 있는 운동에서만) */
    const show = k >= 0 && M[k].rest;
    for (const o of [this.aB, this.aW, this.dB, this.dG]) o.visible = show;
    this.lB.set(show ? '<b style="color:var(--info)">부력 (B)</b>' : ''); this.lG.set(show ? '<b style="color:var(--bad)">무게 (G)</b>' : '');
    if (show) {
      const KG = ship.KG, Gy = KG - SH.T + v[2], phi = v[3] * DEG, th = v[4] * DEG;
      const Bz = SEC0.BM * Math.sin(phi) * 0.9, Bx = -bmLong() * Math.sin(th) * 0.9, By = SEC0.KB - SH.T + v[2] * 0.5;
      const lenW = 40, lenB = 40 * (1 - v[2] / 3 * 0.35);
      const G = V3(v[0], Gy, v[1]), B = V3(v[0] + Bx, By, v[1] + Bz);
      this.dG.position.copy(G); this.dB.position.copy(B);
      this.aW.set(G, V3(0, -1, 0), lenW); this.aB.set(B, V3(0, 1, 0), lenB);
      const w = o => { ship.yaw.updateMatrixWorld(); return o.applyMatrix4(ship.yaw.matrixWorld); };
      this.pB = w(B.clone().add(V3(0, lenB + 4, 0))); this.pG = w(G.clone().add(V3(0, -lenW - 4, 0)));
    }
  },
  read() {
    const { v, k } = this.cur;
    if (k < 0) return [['지금 운동', '여섯 운동이 함께'], ['롤링', sgn(v[3]) + '°'], ['피칭', sgn(v[4]) + '°'], ['요잉', sgn(v[5]) + '°'], ['히빙', sgn(v[2]) + ' m']];
    const m = M[k];
    return [['지금 운동', m.n], ['우리말', m.kr], ['축', m.ax + '축 ' + (m.ax === 'x' ? '(선수미)' : m.ax === 'y' ? '(정횡)' : '(연직)')], ['구분', m.rot ? '회전 운동' : '직선 운동'], ['복원력', m.rest ? '있음' : '없음', m.rest ? 'ok' : ''], ['지금 값', sgn(v[k]) + ' ' + m.u]];
  },
  chart(cv, P, { chartBegin }) {
    const { g, w, h } = chartBegin(cv), v = this.cur.v, rh = (h - 8) / 6;
    M.forEach((m, i) => {
      const y = 4 + i * rh, x0 = 112, cw = w - x0 - 8, cx = x0 + cw / 2, f = Math.max(-1, Math.min(1, v[i] / m.A));
      g.fillStyle = P.muted; g.textAlign = 'left'; g.fillText(m.n.split(' ')[0] + (m.rest ? ' ●' : ''), 0, y + rh / 2 + 4);
      g.fillStyle = P.soft; g.fillRect(x0, y + 6, cw, rh - 12);
      g.fillStyle = m.rot ? P.amber : P.info; g.fillRect(f > 0 ? cx : cx + f * cw / 2, y + 6, Math.abs(f) * cw / 2, rh - 12);
      g.fillStyle = P.ink; g.fillRect(cx, y + 3, 1, rh - 6);
    });
  },
  field(x, y, z, o, st) { baseWater(x, y, z, o, st); hullDeflect(x, y, z, o); },
  spawn(p) { boxSpawn([-260, 300, -16, -0.6, -110, 110], p); }, box: [-280, 320, -18, 1, -130, 130]
};
