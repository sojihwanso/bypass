/* 9-2 앵커와 양묘기: 묘박법(단묘박, 이묘박, 쌍묘박, V자)에 따라 풍향이 바뀔 때 배가 움직이는 범위가 달라진다 (위에서 본 모식) */
import { SH, DEG } from '../physics/ship.js';
import { Line, Dot, Ribbon, V3, setLine, arcPts } from '../engine/draw.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const DEPTH = 20, L = SH.L;
const METHOD = { single: ['단묘박', 'Riding to a single anchor', 1], two: ['이묘박', 'Riding to two anchors', 2], fa: ['쌍묘박', 'Riding to anchors fore and aft', 1], v: ['V자 묘박 (Open moor)', 'Two anchors in a V', 2] };
export default {
  id: 'windlass', dur: 30, scale: 1,
  controls: [
    { k: 'm', label: '묘박법', type: 'seg', opts: Object.entries(METHOD).map(([k, v]) => [k, v[0]]), val: 'single' },
    { k: 'sc', label: '체인 길이', type: 'seg', opts: [[5, '수심×5 (잔잔)'], [7, '×7 (보통)'], [10, '×10 (악천후)']], val: 7 }
  ],
  cam: { r: 1500, th: 2.2, ph: 0.3, target: () => V3(-260, 0, 0) }, water: { alpha: 0.45, amp: 0.2 }, parts: ['hull'],
  legend: [['amber', '앵커와 체인'], ['deck', '선체 중심이 움직인 자리'], ['air1', '바람'], ['muted', '단묘박이었다면 선회권']],
  chartTitle: '풍향 변화와 선수방위 (°)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, R = Math.sqrt((p.sc * DEPTH) ** 2 - DEPTH * DEPTH); this.R = R;
    const m = p.m, d = R * Math.sin(25 * DEG);
    this.A = m === 'single' ? [V3(0, 0, 0)] : m === 'two' ? [V3(0, 0, 10), V3(0, 0, -10)] : m === 'v' ? [V3(0, 0, d), V3(0, 0, -d)] : [V3(R * 0.6, 0, 0), V3(-L - R * 0.6, 0, 0)];
    for (const a of this.A) { const dot = Dot(P.amber, 5); dot.position.set(a.x, -DEPTH + 1, a.z); ctx.fxW.add(dot); }
    this.ch = this.A.map(() => { const l = Line([V3(), V3(1, 0, 0)], P.amber, { top: true }); ctx.fxW.add(l); return l; });
    ctx.fxW.add(Line(arcPts(0, 0, R + L, 0, 2 * Math.PI, 0.8, 120), P.muted, { dash: 14, opacity: 0.6 }));
    this.wA = Line([V3(), V3(1, 0, 0)], P.air1, { top: true }); ctx.fxW.add(this.wA); this.lW = ctx.label('바람', 'dim', o => o.copy(this.pW || V3()));
    /* 미리 계산: 풍향 θ(t)는 선수 쪽에서 ±70° 흔들린다 */
    const n = 301; this.S = []; const g = [];
    for (let i = 0; i < n; i++) { const t = 30 * i / (n - 1), th = 70 * Math.sin(2 * Math.PI * t / 30) * DEG, s = this.pose(th); this.S.push(s); if (i % 3 === 0) g.push([s.x, s.z]); }
    this.rib = Ribbon(g, 3, P.deck, 0.9, 0.9); ctx.fxW.add(this.rib);
    let ext = 0; for (const s of this.S) ext = Math.max(ext, Math.hypot(s.x - Math.cos(s.psi) * L / 2, s.z - Math.sin(s.psi) * L / 2)); this.ext = ext;
    const nm = METHOD[m][0];
    this.steps = [
      { t: 0, h: `${nm}, 체인 ${p.sc}배`, p: `수심 ${DEPTH} m에 체인을 ${fmt(p.sc * DEPTH, 0)} m 냈다. 바람이 선수 쪽에서 좌우로 바뀌면 배는 앵커를 중심으로 움직인다.` },
      { t: 7.5, h: '풍향이 바뀔 때', p: { single: '단묘박은 바람이 바뀌는 대로 앵커를 중심으로 크게 돈다. 좋은 기상에서 잠시 머물 때 가장 많이 쓴다.', two: '이묘박은 두 앵커를 같은 방향으로 같은 길이로 나란히 낸다. 파주력이 단묘박의 2배쯤이지만 체인이 꼬일 수 있다. 움직이는 범위는 단묘박과 비슷하다.', fa: '쌍묘박은 선수와 선미 쪽에 하나씩 놓아 배가 거의 돌지 않는다. 조류·풍향에 따라 두 앵커에 번갈아 장력이 걸린다. 좁은 수역에 알맞다.', v: '두 체인이 45~60°를 이루는 open moor는 앞바람에 맞서 배의 스윙을 누르고 최적의 파주력을 낸다. 풍향이 크게 바뀌면 한 체인만 걸려 파주력이 준다.' }[m] },
      { t: 15, h: `움직이는 범위 약 ${fmt(ext, 0)} m`, p: '선체가 지나가는 범위만큼 주위에 여유 수역이 있어야 한다. 대형선은 수역이 좁아 황천에도 단묘박을 하는 일이 많은데, 이때 두 번째 앵커를 수심의 약 1.5배만 내어 제진묘로 쓰면 스윙을 절반쯤 줄일 수 있다.' }
    ];
  },
  pose(th) {
    const w = V3(-Math.cos(th), 0, -Math.sin(th)), R = this.R, m = this.p.m;   /* w: 바람이 불어 가는 방향 */
    let bow;
    if (m === 'fa') { const z = 0.25 * R * Math.sin(th); return { x: -L / 2, z, psi: Math.atan2(z * 0.002, 1), bow: V3(0, 0, z), stern: V3(-L, 0, z), th }; }
    if (m === 'single' || m === 'two') bow = V3(0, 0, 0).addScaledVector(w, R);
    else {
      const [a1, a2] = this.A, c = [a1.clone().addScaledVector(w, R), a2.clone().addScaledVector(w, R)].filter((q, k) => q.distanceTo(k ? a1 : a2) <= R + 0.01);
      if (c.length) bow = c.sort((q, r) => r.dot(w) - q.dot(w))[0];
      else { const mid = a1.clone().add(a2).multiplyScalar(0.5), h = a1.distanceTo(a2) / 2, k = Math.sqrt(Math.max(0, R * R - h * h)), dir = V3(-(a2.z - a1.z), 0, a2.x - a1.x).normalize(); bow = mid.clone().addScaledVector(dir, dir.dot(w) > 0 ? k : -k); }
    }
    const psi = Math.atan2(-w.z, -w.x), c = bow.clone().addScaledVector(w, L / 2);
    return { x: c.x, z: c.z, psi, bow, th };
  },
  apply(t) {
    const S = this.S, i = Math.min(S.length - 1, Math.round(t / 30 * (S.length - 1))), s = S[i], ship = this.ctx.ship;
    ship.pose(s.x, s.z, s.psi); this.rib.setCount(i / 3); this.i = i;
    const hb = V3(s.x + Math.cos(s.psi) * (L / 2 - 8), -2, s.z + Math.sin(s.psi) * (L / 2 - 8)), hs = V3(s.x - Math.cos(s.psi) * (L / 2 - 8), -2, s.z - Math.sin(s.psi) * (L / 2 - 8));
    this.A.forEach((a, k) => setLine(this.ch[k], [this.p.m === 'fa' && k === 1 ? hs : hb, V3(a.x, -DEPTH + 1, a.z)]));
    const wf = V3(Math.cos(s.th), 0, Math.sin(s.th)); this.pW = V3(350 * wf.x, 30, 350 * wf.z); setLine(this.wA, [this.pW, V3(200 * wf.x, 30, 200 * wf.z)]);
  },
  read() {
    const s = this.S[this.i], m = METHOD[this.p.m];
    return [['묘박법', m[0] + ' (' + m[1] + ')'], ['풍향 (선수 기준)', fmt(Math.abs(s.th / DEG), 0) + '° ' + (s.th > 0.01 ? '우현 쪽' : s.th < -0.01 ? '좌현 쪽' : '정선수')], ['선수방위', fmt(s.psi / DEG, 0) + '°'], ['체인 길이', fmt(this.p.sc * DEPTH, 0) + ' m (수심 ' + DEPTH + ' m)'], ['파주력 (단묘박 대비)', m[2] === 2 ? '약 2배' : '약 1배'], ['움직이는 범위 (앵커에서)', fmt(this.ext, 0) + ' m']];
  },
  chart(cv, P, { lineChart }) {
    const a = [], b = []; this.S.forEach((s, k) => { if (k % 3 === 0) { a.push([30 * k / (this.S.length - 1), s.th / DEG]); b.push([30 * k / (this.S.length - 1), s.psi / DEG]); } });
    lineChart(cv, P, { x0: 0, x1: 30, upto: 30 * this.i / (this.S.length - 1), cursor: 30 * this.i / (this.S.length - 1), xt: [[0, '0'], [15, '반 주기'], [30, '한 주기']], series: [{ data: a, color: P.air1, min: -80, max: 80, yt: [-60, 0, 60], hlines: [0], label: '풍향 °' }, { data: b, color: P.deck, min: -80, max: 80, label: '선수방위 °', dash: [4, 3] }] });
  }
};
