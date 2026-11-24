/* 3-1 타의 기능과 종류: 선미를 가까이서 보며 타 종류를 바꿔 보고, 타가 좌우로 돌아가는 모습을 본다 */
import { SH, DEG } from '../physics/ship.js';
import { PROP } from '../physics/propeller.js';
import { RUD, COL } from '../engine/ship.js';
import { V3 } from '../engine/draw.js';
const TYPES = {
  bal: { n: '평형타', d: '타판이 타두재(회전축) 앞뒤에 걸쳐 있다. 물의 힘이 축 가까이 걸려 조타기 힘이 적게 든다. 대형 상선에서 흔히 쓴다.' },
  unbal: { n: '비평형타', d: '타판이 회전축 뒤쪽에만 있다. 구조가 간단해 분해·조립이 쉽지만 같은 타각에 더 큰 조타 힘이 든다.' },
  semi: { n: '반평형타', d: '위쪽은 비평형타, 아래쪽은 평형타다. 위쪽은 선체에 붙은 혼(horn)이 받친다. 군함이나 쾌속선에서 주로 쓴다.' },
  kort: { n: '콜트 노즐 타', d: '프로펠러를 감싼 관(노즐)이 프로펠러를 지나는 물을 빠르게 해 추력을 키운다. 노즐 뒤에 타를 단다. 예인선, 트롤 어선 등에서 쓴다.' },
  flap: { n: '플랩 타(벡커 타)', d: '타 뒤끝의 플랩이 타각보다 더 많이 꺾인다. 항공기 날개의 보조날개와 같은 생각으로, 일반 타보다 조향성이 약 두 배 좋다고 알려져 있다.' }
};
export default {
  id: 'rudder-kind', dur: 30, scale: 1, flowVis: 2.4, life: 2.2,
  controls: [{ k: 'type', label: '타 종류', type: 'seg', many: true, opts: Object.entries(TYPES).map(([k, v]) => [k, v.n]), val: 'bal' }],
  cam: { r: 42, th: 1.95, ph: 1.52, target: () => V3(RUD.x + 1, -8, 0) }, water: { alpha: 0.16, amp: 0 }, parts: ['rudder', 'propeller'],
  legend: [['bad', '타판'], ['amber', '회전축(타두재)'], ['deck', '플랩·노즐']],
  chartTitle: '시간에 따른 타각',
  steps: [
    { t: 0, h: '타가 하는 일', p: '타는 배가 움직이는 방향과 자세, 위치를 다스린다. 속력은 주기관이 맡고, 저속에서는 쓰러스터와 예선이 타의 일을 돕는다.' },
    { t: 5, h: '타판의 수', p: '한 장의 판에 보강재를 붙인 단판타는 효율이 낮아 소형선에 쓴다. 두 장을 붙여 유선형으로 만든 복판타는 물의 저항이 작아 대부분의 선박이 쓴다. 유선형 타의 두께는 타 폭의 12~18%가 좋다.' },
    { t: 11, h: '회전축의 위치', p: '회전축(타두재)을 직압력 중심 가까이, 타 앞끝에서 폭의 20~30% 되는 곳에 두면 조타기에 드는 힘이 줄어든다. 축 위치에 따라 평형타, 비평형타, 반평형타로 나눈다.' },
    { t: 17, h: '모양과 크기', p: '세로로 긴 타는 작은 타각에서 큰 직압력을 내지만 실속이 일찍 온다. 상선은 종횡비 1.5~2.0의 세로로 긴 타를 주로 쓰고, 타 면적은 물에 잠긴 선체 옆면적의 1.5~2.0% 정도다.' },
    { t: 23, h: '조타 장치', p: '타는 타각 제한 장치로 좌우 35°까지만 돈다. 만재 상태, 최대 속력에서 한쪽 35°에서 반대쪽 30°까지 28초 안에 돌릴 수 있어야 한다. 위의 \'타 종류\'를 바꾸며 모양을 비교해 보자.' }
  ],
  build(ctx, p) {
    this.ctx = ctx; this.p = p; const T = ctx.THREE, P = ctx.P, ship = ctx.ship;
    ship.pose(0, 0, 0); ship.rudder.visible = false; ship.setOpacity(0.8);
    const g = new T.Group(); g.position.y = -ship.KG; ctx.fxR.add(g); this.g = g;
    const mRud = new T.MeshStandardMaterial({ color: COL.rudder, roughness: 0.55, flatShading: true }), mAcc = new T.MeshStandardMaterial({ color: P.deck, roughness: 0.5, flatShading: true }), mStock = new T.MeshStandardMaterial({ color: P.amber, roughness: 0.4 });
    const box = (x0, x1, y0, y1, th, m) => { const b = new T.Mesh(new T.BoxGeometry(Math.abs(x1 - x0), y1 - y0, th), m); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); return b; };
    const pivot = new T.Group(); pivot.position.set(RUD.x, 0, 0); g.add(pivot); this.pivot = pivot;
    const stock = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, RUD.y1 - RUD.y0 + 3, 12), mStock); stock.position.y = (RUD.y0 + RUD.y1) / 2 + 1.5; pivot.add(stock);
    const y0 = RUD.y0, y1 = RUD.y1, ym = (y0 + y1) / 2, ch = RUD.le + RUD.te;
    this.flap = null;
    if (p.type === 'bal') pivot.add(box(RUD.le, -RUD.te, y0, y1, 0.9, mRud));
    if (p.type === 'unbal') { pivot.add(box(-0.2, -ch, y0, y1, 0.9, mRud)); const post = box(1.4, 0.6, y0 - 0.6, y1 + 1.2, 1.1, new T.MeshStandardMaterial({ color: COL.anti })); post.position.x += RUD.x; g.add(post); }
    if (p.type === 'semi') { pivot.add(box(-0.2, -ch, ym, y1, 0.9, mRud)); pivot.add(box(RUD.le, -RUD.te, y0, ym, 0.9, mRud)); const horn = box(RUD.le + 0.1, 0, ym, y1 + 1, 1.0, new T.MeshStandardMaterial({ color: COL.anti })); horn.position.x += RUD.x; g.add(horn); }
    if (p.type === 'kort') {
      pivot.add(box(RUD.le * 0.6, -RUD.te * 0.8, y0 + 1.5, y1 - 1.5, 0.8, mRud));
      const noz = new T.Mesh(new T.CylinderGeometry(PROP.R + 0.55, PROP.R + 0.35, 3.4, 40, 1, true), new T.MeshStandardMaterial({ color: P.deck, side: T.DoubleSide, roughness: 0.5, transparent: true, opacity: 0.85 }));
      noz.rotation.z = Math.PI / 2; noz.position.set(PROP.x, PROP.y, 0); g.add(noz);
    }
    if (p.type === 'flap') {
      const main = ch * 0.72; pivot.add(box(RUD.le, RUD.le - main, y0, y1, 0.9, mRud));
      const hinge = new T.Group(); hinge.position.set(RUD.le - main, 0, 0); hinge.add(box(0, -ch * 0.28, y0, y1, 0.6, mAcc)); pivot.add(hinge); this.flap = hinge;
    }
    this.lT = ctx.label('', 'dim', o => { g.updateMatrixWorld(); return o.set(RUD.x - 6, RUD.y1 + 4, 0).applyMatrix4(g.matrixWorld); });
    this.st = { U: 3 };
  },
  dAt(t) { return 35 * Math.sin(2 * Math.PI * t / 10) * Math.min(1, t / 2); },
  apply(t) {
    const d = this.dAt(t); this.d = d; this.pivot.rotation.y = d * DEG;
    if (this.flap) this.flap.rotation.y = d * DEG * 1.0; /* 플랩은 타각만큼 더 꺾여 뒤끝은 약 두 배 */
    this.ctx.ship.prop.rotation.x = -t * 2 * Math.PI * 1.2;
    this.lT.set(`<b>${TYPES[this.p.type].n}</b>`);
  },
  read() {
    const T = TYPES[this.p.type], d = this.d || 0;
    return [['타 종류', T.n], ['지금 타각', (d >= 0 ? '우현 ' : '좌현 ') + Math.abs(d).toFixed(0) + '°'], ['최대 타각', '좌우 35°'], ['특징', T.d]].concat(this.flap ? [['플랩 끝 각도', Math.abs(2 * d).toFixed(0) + '° (모식)']] : []);
  },
  chart(cv, P, { lineChart, t }) {
    const a = []; for (let s = 0; s <= this.dur; s += 0.2) a.push([s, this.dAt(s)]);
    lineChart(cv, P, { x0: 0, x1: this.dur, upto: t, cursor: t, xt: [[0, '0'], [10, '10초'], [20, '20초'], [30, '30초']], series: [{ data: a, color: P.bad, min: -40, max: 40, yt: [-35, 0, 35], hlines: [35, -35], label: '타각 °(+ 우현)' }] });
  }
};
void SH;
