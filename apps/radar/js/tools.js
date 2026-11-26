/* 측정 도구·마크·항적·비디오 플로터 (순수 계산) — 매뉴얼 1.32~1.44, 1.51, 5장 */
import { brgRng, wrap360, angDiff, D2R, makeProj } from './geo.js';

export const UNITS = { NM: 1, km: 1.852, SM: 1.150779, kyd: 2.025372 };
export const toUnit = (nm, unit) => nm * (UNITS[unit] ?? 1);
/* VRM까지 걸리는 시간(분) */
export const vrmTTG = (rngNM, sogKn) => (sogKn > 0.1 ? (rngNM / sogKn) * 60 : null);
export const rangeBetween = (p1, p2) => brgRng(p1.x, p1.y, p2.x, p2.y);

/* 구역: brg0에서 시계 방향으로 brg1까지, 거리 rng0~rng1 */
export function inZone(z, { brg, rng }) {
  if (rng < z.rng0 || rng > z.rng1) return false;
  const span = wrap360(z.brg1 - z.brg0), d = wrap360(brg - z.brg0);
  return d <= span;
}

/* PI선: n개, 간격 interval, 가운데 정렬. PERPENDIC이면 방위 +90° */
export function piLines({ n = 3, brg = 0, interval = 0.5, mode = 'PARALLEL' }) {
  const b = mode === 'PERPENDIC' ? wrap360(brg + 90) : brg;
  return Array.from({ length: n }, (_, i) => ({ brg: b, offset: interval * (i - (n - 1) / 2) }));
}

/* Offset EBL 충돌 평가(매뉴얼 1.34): 물표에 원점을 둔 EBL을 물표 상대 운동 방향에 맞췄을 때 자선을 지나면 위험 */
export function offsetEblRisk(origin, eblBrg, own, tolNM = 0.1) {
  const ux = Math.sin(eblBrg * D2R), uy = Math.cos(eblBrg * D2R), rx = own.x - origin.x, ry = own.y - origin.y;
  const along = rx * ux + ry * uy, cpa = Math.abs(rx * uy - ry * ux);
  return { risk: along > 0 && cpa <= tolNM, cpa: along > 0 ? cpa : Math.hypot(rx, ry) };
}

export const anchorWatch = (anchor, rNM, pos) => Math.hypot(pos.x - anchor.x, pos.y - anchor.y) > rNM;

/* EBL·VRM·커서 도구 상태 */
export function createTools() {
  return {
    ebl: [{ on: false, brg: 0, rel: false, origin: null }, { on: false, brg: 90, rel: false, origin: null }],
    vrm: [{ on: false, rng: 1, origin: null }, { on: false, rng: 2, origin: null }],
    eblTrue(i, hdg) { const e = this.ebl[i]; return e.rel ? wrap360(e.brg + hdg) : e.brg; },
    pi: { on: false, brg: 0, interval: 0.5 },
    drops: [], // {lat, lon}
    zones: [null, null], // 표적 경보 구역 {brg0,brg1,rng0,rng1}
    anchor: null, // {lat, lon}
    cursor: { x: 0, y: 0, brg: 0, rng: 0, lat: 0, lon: 0, on: false },
    map: { marks: [] }, // {lat, lon, type:'buoy'|'danger'|'mark', name}
    ownTrack: [], // {lat, lon, t}
  };
}

/* 에코 항적 래스터: REL이면 자선 기준 NM 좌표, TRUE면 지리 기준 NM 좌표(원점 고정) */
export function createTrails(N = 512) {
  const ts = new Float32Array(N * N).fill(-1e9);
  let cell = 6 / (N / 2), mode = 'REL', ox = 0, oy = 0;
  return {
    get mode() { return mode; }, get cell() { return cell; }, origin: () => ({ x: ox, y: oy }),
    reset(rangeNM, m = mode, origin = { x: 0, y: 0 }) { cell = rangeNM / (N / 2); mode = m; ox = origin.x; oy = origin.y; ts.fill(-1e9); },
    mark(x, y, t) { const c = Math.floor((x - ox) / cell + N / 2), r = Math.floor((y - oy) / cell + N / 2); if (c >= 0 && r >= 0 && c < N && r < N) ts[r * N + c] = t; },
    /* fn(x, y, 나이비율 0..1) — 나이비율 1 이상(오래됨)은 건너뜀 */
    forEach(now, trailSec, fn) {
      for (let i = 0; i < N * N; i++) { const a = (now - ts[i]) / trailSec; if (a < 0 || a >= 1) continue; const r = (i / N) | 0, c = i - r * N; fn(ox + (c + 0.5 - N / 2) * cell, oy + (r + 0.5 - N / 2) * cell, Math.max(a, 1e-6)); }
    },
    clear() { ts.fill(-1e9); },
  };
}

/* 간단 항로: WPT 최대 20개, 0.2 NM 안이면 다음 WPT */
export function createRoute(max = 20) {
  return {
    wpts: [], next: 0,
    add(lat, lon) { if (this.wpts.length >= max) return false; this.wpts.push({ lat, lon }); return true; },
    remove(i) { this.wpts.splice(i, 1); if (this.next >= this.wpts.length) this.next = Math.max(0, this.wpts.length - 1); },
    clear() { this.wpts = []; this.next = 0; },
    legInfo(lat, lon) {
      if (!this.wpts.length) return null;
      const P = makeProj(lat, lon), w = this.wpts[this.next], r = brgRng(0, 0, P.x(w.lon), P.y(w.lat));
      if (r.rng < 0.2 && this.next < this.wpts.length - 1) { this.next++; return this.legInfo(lat, lon); }
      return { index: this.next, brg: r.brg, rng: r.rng };
    },
  };
}
export { angDiff };
