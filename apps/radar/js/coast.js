/* 해안선: ECDIS 앱의 전체 해상도 데이터(../ecdis/coast/cNN.txt)를 같이 씀.
   형식(ECDIS index.html decodeVar·loadCol과 같음): base64 → varint 스트림.
   열 ci = floor((lon+180)/10), 타일 rj = floor((lat+90)/10), 좌표 = 타일 원점 + 정수/FULLQ (zigzag 차분). */
export const FULLQ = 20000;
const pad2 = (n) => String(n).padStart(2, '0');
const defaultFetch = (ci) => fetch('../ecdis/coast/c' + pad2(ci) + '.txt').then((r) => (r.ok ? r.text() : Promise.reject(r.status)));

function reader(u8, start) {
  let p = start;
  const rv = () => { let v = 0, s = 0, b; do { b = u8[p++]; v += (b & 127) * Math.pow(2, s); s += 7; } while (b & 128); return v; };
  const zz = (v) => (v % 2 ? -(v + 1) / 2 : v / 2);
  return { rv, zz, pos: () => p };
}

export function decodeColumn(b64) {
  const bin = atob(b64.trim()), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  let d = reader(u, 0);
  const nt = d.rv(), tiles = {};
  for (let t = 0; t < nt; t++) {
    const rj = d.rv(), len = d.rv(), st = d.pos(), dd = reader(u, st), nr = dd.rv(), rings = [];
    for (let r = 0; r < nr; r++) {
      const cnt = dd.rv(), q = new Int32Array(cnt * 2);
      let x = 0, y = 0;
      for (let i = 0; i < cnt; i++) { x += dd.zz(dd.rv()); y += dd.zz(dd.rv()); q[i * 2] = x; q[i * 2 + 1] = y; }
      rings.push(q);
    }
    tiles[rj] = rings;
    d = reader(u, st + len);
  }
  return tiles;
}

/* 타일 고리 → 경위도 쌍 (lon, lat 번갈아) */
export function ringsToLonLat(ci, rj, rings) {
  const cx = -180 + ci * 10, cy = -90 + rj * 10;
  return rings.map((q) => { const o = new Float64Array(q.length); for (let i = 0; i < q.length; i += 2) { o[i] = cx + q[i] / FULLQ; o[i + 1] = cy + q[i + 1] / FULLQ; } return o; });
}

function bboxOf(r) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < r.length; i += 2) { if (r[i] < x0) x0 = r[i]; if (r[i] > x1) x1 = r[i]; if (r[i + 1] < y0) y0 = r[i + 1]; if (r[i + 1] > y1) y1 = r[i + 1]; } return { x0, x1, y0, y1 }; }

/* bbox 안 육지 고리만 모아 돌려줌. 불러오기 실패해도 reject하지 않음 */
export async function loadLand(bbox, fetchText = defaultFetch) {
  const out = [];
  try {
    const c0 = Math.floor((bbox.lon0 + 180) / 10), c1 = Math.floor((bbox.lon1 + 180) / 10);
    for (let c = c0; c <= c1; c++) {
      const ci = ((c % 36) + 36) % 36, tiles = decodeColumn(await fetchText(ci));
      for (let rj = Math.floor((bbox.lat0 + 90) / 10); rj <= Math.floor((bbox.lat1 + 90) / 10); rj++) {
        if (!tiles[rj]) continue;
        for (const r of ringsToLonLat(ci, rj, tiles[rj])) {
          const b = bboxOf(r);
          if (b.x1 < bbox.lon0 || b.x0 > bbox.lon1 || b.y1 < bbox.lat0 || b.y0 > bbox.lat1) continue;
          r.bb = b; out.push(r);
        }
      }
    }
    return { rings: out, ok: true };
  } catch (e) {
    return { rings: [], ok: false };
  }
}

/* 고리 하나라도 점을 품으면 육지(고리마다 짝홀 규칙) */
export function pointInLand(rings, lat, lon) {
  for (const r of rings) {
    const b = r.bb || (r.bb = bboxOf(r));
    if (lon < b.x0 || lon > b.x1 || lat < b.y0 || lat > b.y1) continue;
    let inside = false;
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}
