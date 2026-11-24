/* 8-1 침로 유지: 바람·수류의 옆 힘으로 생기는 풍압차(leeway)와, 그만큼 바람 쪽으로 선수를 두는 수정 */
import { SH, DEG, KN } from '../physics/ship.js';
import { Arrow, Ribbon, Line, Ghost, V3, setLine } from '../engine/draw.js';
import { boxSpawn, hullDeflect } from '../engine/flow.js';
import { realTime } from '../engine/player.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
/* 풍압차 β = k·(Ba/Ld)·(Va/Vs)². 대상선 Ba/Ld와 k를 묶어 K로 둔 모델 값(가정) */
const K = 0.3;
export const leeway = (Va, Vs) => Math.min(25, K * (Va / Vs) ** 2);
const REAL = 600; /* 장면 30초 = 실제 10분 */
export default {
  id: 'keep', dur: 30, flowVis: 3, life: 2.4,
  controls: [
    { k: 'fix', label: '조타', type: 'seg', opts: [['none', '선수를 원침로에'], ['fix', '풍압차만큼 바람 쪽으로']], val: 'none' },
    { k: 'Vs', label: '선속', type: 'range', min: 4, max: 16, step: 2, val: 8, fmt: v => v + ' kn' },
    { k: 'Va', label: '정횡 바람 (우현)', type: 'seg', opts: [[10, '10 m/s'], [15, '15 m/s'], [20, '20 m/s']], val: 15 }
  ],
  cam: { r: 1000, th: 2.5, ph: 0.95, follow: true },
  water: { alpha: 0.6, amp: 0.3 }, parts: ['hull', 'rudder'],
  legend: [['deck', '실제 항적'], ['muted', '계획 침로'], ['air1', '바람'], ['amber', '선수 방향']],
  chartTitle: '선속에 따른 풍압차 (정횡 바람, 모델 값)',
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const P = ctx.P, Vs = p.Vs * KN, b = leeway(p.Va, Vs) * DEG;
    this.Vs = Vs; this.b = b; this.scale = REAL / this.dur;
    /* 바람은 우현(+z)에서 불어 배를 좌현(−z)으로 민다. 수정하면 선수를 +b(바람 쪽)로 둔다 */
    this.psi = p.fix === 'fix' ? b : 0; this.cog = this.psi - b;
    const D = Vs * REAL; this.D = D;
    ctx.fxW.add(Line([V3(-300, 0.6, 0), V3(D + 400, 0.6, 0)], P.muted, { dash: 30, opacity: 0.7 }));
    ctx.label('계획 침로', 'dim', o => o.set(D + 380, 8, 30));
    const g = []; for (let i = 0; i <= 60; i++) { const s = D * i / 60; g.push([s * Math.cos(this.cog), s * Math.sin(this.cog)]); }
    this.rib = Ribbon(g, 8, P.deck, 0.7, 0.9); ctx.fxW.add(this.rib);
    this.hd = Line([V3(), V3(1, 0, 0)], P.amber, { top: true, dash: 14 }); ctx.fxW.add(this.hd);
    this.lH = ctx.label('', 'dim', o => o.copy(this.pH || V3()));
    this.xt = Line([V3(), V3(1, 0, 0)], P.bad, { top: true }); ctx.fxW.add(this.xt); this.lX = ctx.label('', 'dim', o => o.set(this.X || 0, 10, (this.Z || 0) / 2));
    for (let k = 0; k < 5; k++) { const a = Arrow(P.air1, 3, { top: false }); a.set(V3(k * D / 4, 40, 380), V3(0, 0, -1), 140); ctx.fxW.add(a); }
    this.aW = Arrow(P.air1, 2.4, { top: true }); ctx.fxY.add(this.aW); this.aW.set(V3(0, 30, 110), V3(0, 0, -1), 50);
        const off = fmt(Math.abs(D * Math.sin(this.cog)), 0);
    this.steps = [
      { t: 0, h: '계획 침로를 따라', p: `${p.Vs}노트로 계획 침로를 간다. 우현 정횡에서 ${p.Va} m/s 바람이 분다. 바람과 조류의 옆 힘이 무게중심을 밀어, 배는 전진력과 옆 힘의 합성 방향으로 나아간다.` },
      { t: 6, h: p.fix === 'fix' ? '바람 쪽으로 선수를 둔다' : '선수는 원침로, 항적은 비스듬히', p: p.fix === 'fix' ? `선수를 바람 쪽으로 약 ${fmt(b / DEG, 1)}° 돌려 두면, 옆으로 밀리는 만큼이 상쇄돼 실제 항적이 계획 침로 위에 놓인다. 선수방위와 항적이 서로 다르다는 점을 잊지 않는다.` : `선수는 계획 침로를 가리키지만 항적은 바람 아래쪽으로 약 ${fmt(b / DEG, 1)}° 비스듬하다. 원침로와 실제 항적 사이 이 각이 풍압차(leeway)다.` },
      { t: 14, h: '세 힘의 평형', p: '풍압차는 바람·조류의 옆 힘, 타의 옆 성분, 비스듬히 나아가는 선체가 받는 물의 저항이 평형을 이룰 때의 각이다. 바람이 선수를 돌리려는 모멘트는 약간의 타로 맞받는다.' },
      { t: 22, h: '느릴수록 커진다', p: p.fix === 'fix' ? '같은 바람이라도 선속이 줄면 전진력과 물의 저항이 함께 줄어 옆 힘의 비중이 커진다. 풍압차는 (풍속/선속)²에 비례해 커지므로 감속할 때마다 수정각을 다시 잡는다.' : `10분 동안 계획 침로에서 약 ${off} m 벗어났다. 선속이 줄면 풍압차는 (풍속/선속)²에 비례해 커져, 같은 바람에도 저속선은 생각보다 크게 밀린다.` }
    ];
    this.st = { u: Vs, v: -Vs * Math.sin(b), r: 0, n: 60, cref: Vs, aref: p.Va };
  },
  apply(t) {
    const ts = t * this.scale, s = this.Vs * ts, X = s * Math.cos(this.cog), Z = s * Math.sin(this.cog), ship = this.ctx.ship;
    ship.pose(X, Z, this.psi); ship.rudder.rotation.y = (this.p.fix === 'fix' ? -3 : -2) * DEG; this.rib.setCount(60 * ts / REAL);
    const HL = 900, tip = V3(X + HL * Math.cos(this.psi), 6, Z + HL * Math.sin(this.psi)); setLine(this.hd, [V3(X, 6, Z), tip]); this.pH = tip;
    this.lH.set('<b style="color:var(--amber)">선수 방향</b>'); setLine(this.xt, [V3(X, 3, Z), V3(X, 3, 0)]); this.lX.set(Math.abs(Z) > 20 ? `<b style="color:var(--bad)">벗어난 거리</b><i>${fmt(Math.abs(Z), 0)} m</i>` : ''); this.ts = ts; this.X = X; this.Z = Z;
  },
  read() {
    const b = this.b / DEG;
    return [['경과 시간', realTime(this.ts)], ['풍속 / 선속', fmt(this.p.Va / this.Vs, 1)], ['풍압차', fmt(b, 1) + '°', b > 8 ? 'warn' : ''], ['선수방위', this.p.fix === 'fix' ? '계획 침로 + ' + fmt(b, 1) + '° (바람 쪽)' : '계획 침로'], ['계획 침로에서 벗어난 거리', fmt(Math.abs(this.Z), 0) + ' m', Math.abs(this.Z) > 200 ? 'bad' : Math.abs(this.Z) > 60 ? 'warn' : 'ok']];
  },
  chart(cv, P, { lineChart }) {
    const sr = v => { const a = []; for (let k = 3; k <= 16; k += 0.25) a.push([k, leeway(v, k * KN)]); return a; };
    lineChart(cv, P, { x0: 3, x1: 16, xt: [[4, '4 kn'], [8, '8'], [12, '12'], [16, '16 kn']], series: [
      { data: sr(this.p.Va), color: P.amber, min: 0, max: 25, yt: [0, 10, 20], label: `풍압차 ° (바람 ${this.p.Va} m/s)`, mark: [this.p.Vs, leeway(this.p.Va, this.Vs)] }] });
  },
  field(x, y, z, o, st) {
    if (y > 0.5) { o.x = -st.u; o.y = 0; o.z = -st.aref; o.k = 2; return; }
    o.x = -st.u; o.z = -st.v; o.y = 0; o.k = 0; hullDeflect(x, y, z, o);
  },
  spawn(p) { if (Math.random() < 0.5) boxSpawn([-260, 260, 4, 46, -60, 200], p, 2); else boxSpawn([-260, 300, -14, -0.5, -110, 110], p); }, box: [-320, 340, -18, 60, -200, 240]
};
