/* 5-1 주기관: 대형 2행정 디젤 기관의 실린더 한 개를 잘라 보고, 크랭크 한 바퀴 동안 소기·압축·폭발·배기를 따라간다 */
import { V3 } from '../engine/draw.js';
const fmt = (v, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const R = 1.7, LR = 6.8, BORE = 0.9;                 /* 크랭크 반지름(행정 3.4 m), 커넥팅 로드, 실린더 지름 (가정: 대형 저속 기관 크기) */
const EVO = 110, EVC = 250, SPO = 140, SPC = 220, INJ0 = -4, INJ1 = 18; /* 배기 밸브 열림·닫힘, 소기구 열림·닫힘, 연료 분사 (크랭크각 °, 상사점 0) */
const CR = 18;                                       /* 압축비 (가정) */
const xPiston = th => R * Math.cos(th) + Math.sqrt(LR * LR - (R * Math.sin(th)) ** 2); /* 크랭크 중심에서 피스톤 핀까지 */
function phase(a) {
  a = ((a % 360) + 360) % 360;
  if (a < INJ1 || a > 360 + INJ0) return { k: 'fire', n: '연료 분사·폭발' };
  if (a < EVO) return { k: 'work', n: '작동(팽창)' };
  if (a < SPO) return { k: 'exh', n: '배기' };
  if (a < SPC) return { k: 'scav', n: '소기' };
  if (a < EVC) return { k: 'exh2', n: '소기 끝, 배기 닫힘 전' };
  return { k: 'comp', n: '압축' };
}
/* 실린더 압력(모델 값, bar): 압축 p∝V^-1.35, 연소 후 팽창 p∝V^-1.3 */
function pressure(a) {
  a = ((a % 360) + 360) % 360; const top = xPiston(0), bot = xPiston(Math.PI), Vc = (top - bot) / (CR - 1);
  const V = d => (top - xPiston(d * Math.PI / 180)) + Vc, Vtdc = Vc, Vbdc = top - bot + Vc, ps = 3.5, pcomp = ps * (Vbdc / Vtdc) ** 1.35, pmax = 150;
  if (a >= EVC) return ps * (V(EVC) / V(a)) ** 1.35;
  if (a < 8) return pcomp + (pmax - pcomp) * Math.min(1, (a + 4) / 12);
  if (a < EVO) return pmax * (V(8) / V(a)) ** 1.3;
  const pe = pmax * (V(8) / V(EVO)) ** 1.3; if (a < SPO) return ps + (pe - ps) * Math.exp(-(a - EVO) / 8);
  return ps;
}
export default {
  id: 'engine', dur: 24, scale: 1,
  controls: [{ k: 'spd', label: '보는 빠르기', type: 'seg', opts: [['slow', '한 바퀴 12초'], ['fast', '한 바퀴 4초']], val: 'slow' }],
  cam: { r: 21, th: 2.0, ph: 1.4, target: () => V3(0, 4.6, 0) }, water: { alpha: 0, amp: 0 }, parts: ['engine'],
  legend: [['ink', '실린더(잘라서 봄)'], ['amber', '피스톤·크랭크'], ['info', '소기(새 공기)'], ['bad', '폭발'], ['muted', '배기']],
  chartTitle: '실린더 압력과 부피 (P–V 선도, 모델 값)',
  steps: [],
  build(ctx, p) {
    this.ctx = ctx; const T = ctx.THREE, P = ctx.P; ctx.ship.model.visible = false;
    this.per = p.spd === 'fast' ? 4 : 12;
    const k = this.per;
    this.steps = [
      { t: 0, h: '연료 분사와 폭발', p: '피스톤이 맨 위(상사점) 가까이 올라오면 고온·고압으로 압축된 공기에 연료를 분사한다. 연료는 압축열로 스스로 불붙어 폭발한다. 디젤 기관은 점화 장치 없이 압축열로 불붙인다.' },
      { t: k * 20 / 360, h: '작동(팽창)', p: '폭발 압력이 피스톤을 밀어 내리고, 커넥팅 로드와 크랭크가 이 직선 운동을 회전으로 바꿔 프로펠러축을 돌린다.' },
      { t: k * EVO / 360, h: '배기', p: '피스톤이 충분히 내려가면 위쪽 배기구가 열려 연소 가스가 빠져나간다.' },
      { t: k * SPO / 360, h: '소기', p: '피스톤이 하사점 가까이 내려가면 아래쪽 소기구가 드러나 새 공기가 들어오며 남은 연소 가스를 밀어낸다. 이것이 소기다.' },
      { t: k * EVC / 360, h: '압축', p: '피스톤이 다시 올라가 소기구를 막고 배기구도 닫히면 새 공기를 압축한다. 압축된 공기는 연료가 스스로 불붙을 만큼 뜨거워진다. 크랭크 한 바퀴(2행정)에 폭발이 한 번 일어난다.' },
      { t: k, h: '되풀이', p: '대형 상선의 저속 2행정 디젤은 분당 100~300번(이보다 낮은 기관도 있다) 이 과정을 되풀이하며 프로펠러를 직접 돌린다.' }
    ];
    this.dur = Math.max(24, k * 2);
    const g = new T.Group(); ctx.fxW.add(g); this.g = g;
    const mLiner = new T.MeshStandardMaterial({ color: P.ink, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false });
    const mSteel = new T.MeshStandardMaterial({ color: P.amber, roughness: 0.45, metalness: 0.3 }), mDark = new T.MeshStandardMaterial({ color: P.muted, roughness: 0.6 });
    const top = xPiston(0), bot = xPiston(Math.PI); this.top = top; this.bot = bot;
    const H = top - bot + 1.6, liner = new T.Mesh(new T.CylinderGeometry(BORE / 2 + 0.06, BORE / 2 + 0.06, H, 40, 1, true, 0, Math.PI * 1.5), mLiner); liner.position.y = bot + H / 2 - 0.4; g.add(liner);
    const cover = new T.Mesh(new T.CylinderGeometry(BORE / 2 + 0.25, BORE / 2 + 0.25, 0.5, 40, 1, false, 0, Math.PI * 1.5), mDark); cover.position.y = top + 0.75 + 0.25; g.add(cover);
    this.piston = new T.Mesh(new T.CylinderGeometry(BORE / 2, BORE / 2, 0.7, 32), mSteel); g.add(this.piston);
    this.rod = new T.Mesh(new T.BoxGeometry(0.18, LR, 0.18), mSteel); g.add(this.rod);
    this.crank = new T.Group(); g.add(this.crank); const web = new T.Mesh(new T.BoxGeometry(0.5, R + 0.6, 0.3), mDark); web.position.y = R / 2; this.crank.add(web);
    const pin = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.5, 16), mSteel); pin.rotation.x = Math.PI / 2; pin.position.y = R; this.crank.add(pin);
    const shaft = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 2.4, 20), mDark); shaft.rotation.x = Math.PI / 2; g.add(shaft);
    this.ports = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 1.5, b = new T.Mesh(new T.BoxGeometry(0.12, 0.35, 0.08), new T.MeshBasicMaterial({ color: P.info, transparent: true, opacity: 0.4 })); b.position.set(Math.sin(a) * (BORE / 2 + 0.07), bot + 0.7, Math.cos(a) * (BORE / 2 + 0.07)); b.rotation.y = a; g.add(b); this.ports.push(b); }
    this.valve = new T.Mesh(new T.CylinderGeometry(0.16, 0.22, 0.12, 20), mDark); g.add(this.valve);
    this.flash = new T.Mesh(new T.SphereGeometry(0.34, 20, 14), new T.MeshBasicMaterial({ color: P.bad, transparent: true, opacity: 0.8 })); g.add(this.flash);
    this.gas = new T.Mesh(new T.CylinderGeometry(BORE / 2 - 0.04, BORE / 2 - 0.04, 1, 28), new T.MeshBasicMaterial({ color: P.info, transparent: true, opacity: 0.18, depthWrite: false })); g.add(this.gas);
    const L = (txt, x, y, z) => ctx.label(txt, 'dim', o => o.set(x, y, z));
    L('실린더 덮개·배기구', 0.9, top + 1.2, 0.4); L('<b style="color:var(--info)">소기구</b>', 0.9, bot + 0.7, 0.5); L('피스톤', -1.1, top - 1.2, 0); L('커넥팅 로드', -1.2, (top + bot) / 2 - 1.8, 0); L('크랭크', -1.2, 0.4, 0.4);
    this.lPh = ctx.label('', 'dim', o => o.set(1.4, top - 0.4, 0.8));
  },
  ang(t) { return (t / this.per) * 360; },
  apply(t) {
    const a = this.ang(t), th = a * Math.PI / 180, top = this.top, bot = this.bot, x = xPiston(th), ph = phase(a);
    this.piston.position.set(0, x + 0.35, 0);
    const cx = R * Math.sin(th), cy = R * Math.cos(th); this.crank.rotation.z = -th;
    this.rod.position.set(cx / 2, (cy + x) / 2, 0); this.rod.rotation.z = Math.atan2(cx, x - cy);
    const am = ((a % 360) + 360) % 360, open = am >= EVO && am < EVC; this.valve.position.set(0, top + 0.75 + (open ? -0.22 : 0), 0);
    const portsOpen = am >= SPO && am < SPC; for (const b of this.ports) b.material.opacity = portsOpen ? 0.95 : 0.25;
    const firing = am < INJ1 || am > 360 + INJ0; this.flash.visible = firing; this.flash.position.set(0, top + 0.35, 0); this.flash.scale.setScalar(firing ? 1 + 0.5 * Math.sin(am / 4) : 1);
    const gh = Math.max(0.05, top + 0.75 - (x + 0.7)); this.gas.scale.y = gh; this.gas.position.y = x + 0.7 + gh / 2;
    this.gas.material.color.set(ph.k === 'scav' || ph.k === 'comp' ? this.ctx.P.info : ph.k === 'fire' || ph.k === 'work' ? this.ctx.P.bad : this.ctx.P.muted);
    this.a = am; this.ph = ph; this.lPh.set(`<b>${ph.n}</b><i>크랭크각 ${fmt(am)}°</i>`);
  },
  read() {
    const a = this.a || 0;
    return [['크랭크각', fmt(a) + '° (상사점 0°)'], ['지금 단계', this.ph ? this.ph.n : '—'], ['실린더 압력', fmt(pressure(a), 0) + ' bar (모델 값)'], ['배기구', a >= EVO && a < EVC ? '열림' : '닫힘'], ['소기구', a >= SPO && a < SPC ? '열림' : '닫힘'], ['행정', '3.4 m (가정)']];
  },
  chart(cv, P, { lineChart }) {
    const top = xPiston(0), bot = xPiston(Math.PI), Vc = (top - bot) / (CR - 1), V = d => ((top - xPiston(d * Math.PI / 180)) + Vc) / (top - bot + Vc);
    const loop = []; for (let d = 0; d <= 360; d += 2) loop.push([V(d), pressure(d)]);
    const a = this.a || 0;
    lineChart(cv, P, { x0: 0, x1: 1.02, xt: [[V(0), '상사점'], [1, '하사점']], series: [{ data: loop, color: P.bad, min: 0, max: 160, yt: [0, 50, 100, 150], label: '압력 bar (세로) – 부피(가로)', mark: [V(a), pressure(a)] }] });
  }
};
