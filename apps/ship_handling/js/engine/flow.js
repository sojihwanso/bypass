/* 흐름선: 입자마다 지나온 자리를 꼬리처럼 그린다. 장면이 field(x,y,z,out,st,time)로 속도를 준다.
   kind: 0 물, 1 분사·배출류(따뜻한 색), 2 바람, 3 빠른 물(차가운 색) */
import { SH } from '../physics/ship.js';
import { PROP } from '../physics/propeller.js';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const HA = SH.L / 2 + 3, HB = SH.B / 2 + 2.5;

export function createFlow(N = 760, M = 16) {
  const THREE = window.THREE;
  const P = new Float32Array(N * 3), tr = new Float32Array(N * M * 3), head = new Int32Array(N), age = new Float32Array(N), life = new Float32Array(N), col = new Float32Array(N * 3), kind = new Uint8Array(N);
  const S = N * (M - 1) * 2, pos = new Float32Array(S * 3), cbuf = new Float32Array(S * 3), abuf = new Float32Array(S);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(cbuf, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('alpha', new THREE.BufferAttribute(abuf, 1).setUsage(THREE.DynamicDrawUsage));
  /* 선 두께: WebGL 선은 1픽셀이라, 같은 선을 화면에서 약 1.2픽셀 비켜 한 번 더 그려 살짝 굵게 보이게 한다 */
  const FRAG = 'varying float vA;varying vec3 vC;void main(){if(vA<.01)discard;gl_FragColor=vec4(vC,vA);}';
  const BOOST = { value: 1 };
  const mkLine = off => {
    const u = { uOff: { value: new THREE.Vector2() }, uBoost: BOOST }, m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
      vertexShader: 'uniform vec2 uOff;uniform float uBoost;attribute float alpha;attribute vec3 color;varying float vA;varying vec3 vC;void main(){vA=min(1.,alpha*1.15*uBoost);vC=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.xy+=uOff*gl_Position.w;}',
      fragmentShader: FRAG });
    const l = new THREE.LineSegments(g, m), sz = new THREE.Vector2(); l.frustumCulled = false; l.renderOrder = 3;
    if (off) l.onBeforeRender = r => { r.getDrawingBufferSize(sz); u.uOff.value.set(off * 2 / sz.x, off * 2 / sz.y); };
    return l;
  };
  const obj = new THREE.Group(); obj.add(mkLine(0), mkLine(1.2 * (window.devicePixelRatio || 1)));
  const C = { w0: new THREE.Color(), w1: new THREE.Color(), j0: new THREE.Color(), j1: new THREE.Color(), a0: new THREE.Color(), a1: new THREE.Color(), c0: new THREE.Color(), c1: new THREE.Color() };
  const _c = new THREE.Color(), o = { x: 0, y: 0, z: 0, k: 0 }, p = { x: 0, y: 0, z: 0, k: 0 };
  let sc = null, active = N, time = 0, every = 1, tick = 0;

  function setPalette(pal) { C.w0.set(pal.flow0); C.w1.set(pal.flow1); C.j0.set(pal.jet0); C.j1.set(pal.jet1); C.a0.set(pal.air0); C.a1.set(pal.air1); C.c0.set(pal.cool0); C.c1.set(pal.cool1); }
  function color(spd, k, st) {
    if (k === 1) return _c.copy(C.j0).lerp(C.j1, clamp(spd / ((st && st.jref) || 6), 0, 1));
    if (k === 2) return _c.copy(C.a0).lerp(C.a1, clamp(spd / ((st && st.aref) || 15), 0, 1));
    if (k === 3) return _c.copy(C.c0).lerp(C.c1, clamp(spd / ((st && st.cref) || 6) - 0.6, 0, 1));
    return _c.copy(C.w0).lerp(C.w1, clamp(spd / ((st && st.cref) || 6) / 1.5, 0, 1));
  }
  function spawnOne(i, init) {
    let n = 0; do { sc.spawn(p); n++; } while (n < 12 && insideHull(p.x, p.y, p.z, sc));
    const b = i * 3; P[b] = p.x; P[b + 1] = p.y; P[b + 2] = p.z; kind[i] = p.k || 0;
    for (let m = 0; m < M; m++) { const t = (i * M + m) * 3; tr[t] = p.x; tr[t + 1] = p.y; tr[t + 2] = p.z; }
    life[i] = (sc.life || 2.4) * (sc.lifeScale ?? 1 + (every - 1) * 0.5) * (0.6 + 0.8 * Math.random()); age[i] = init ? Math.random() * life[i] : 0;
    const c = color(0, kind[i], sc.st); col[b] = c.r; col[b + 1] = c.g; col[b + 2] = c.b;
  }
  function write() {
    let v = 0;
    for (let i = 0; i < N; i++) {
      const la = i < active ? Math.min(1, age[i] / 0.35) * Math.min(1, (life[i] - age[i]) / 0.5) : 0, cr = col[i * 3], cg = col[i * 3 + 1], cb = col[i * 3 + 2];
      for (let k = 0; k < M - 1; k++) {
        const a = (i * M + (head[i] + 1 + k) % M) * 3, b = (i * M + (head[i] + 2 + k) % M) * 3;
        pos[v * 3] = tr[a]; pos[v * 3 + 1] = tr[a + 1]; pos[v * 3 + 2] = tr[a + 2]; cbuf[v * 3] = cr; cbuf[v * 3 + 1] = cg; cbuf[v * 3 + 2] = cb; abuf[v] = la * Math.pow(k / (M - 1), 1.3) * 0.95; v++;
        pos[v * 3] = tr[b]; pos[v * 3 + 1] = tr[b + 1]; pos[v * 3 + 2] = tr[b + 2]; cbuf[v * 3] = cr; cbuf[v * 3 + 1] = cg; cbuf[v * 3 + 2] = cb; abuf[v] = la * Math.pow((k + 1) / (M - 1), 1.3) * 0.95; v++;
      }
    }
    g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.alpha.needsUpdate = true;
  }
  return {
    obj, setPalette,
    get time() { return time; },
    reset(scene) {
      sc = scene; BOOST.value = scene.flowBoost || 1;
      /* 흐름 범위가 넓은 장면은 꼬리 자리를 몇 걸음마다 한 번씩 남겨 선을 길게 한다(입자 속도는 그대로) */
      const bx = scene.box, span = bx ? Math.max(bx[1] - bx[0], bx[5] - bx[4]) : 0; every = scene.trailEvery ?? clamp(Math.round(span / 150), 1, 6); tick = 0; active = scene.field && scene.spawn ? Math.min(N, scene.flowN ?? N) : 0;
      if (active) for (let i = 0; i < N; i++) spawnOne(i, true); else { age.fill(0); life.fill(1); }
      write(); obj.visible = active > 0;
    },
    step(dt) {
      if (!sc || !sc.field || !active) return; time += dt;
      const sub = dt > 0.05 ? 2 : 1, h = dt / sub, adv = (++tick % every) === 0;
      for (let i = 0; i < active; i++) {
        const b = i * 3; let x = P[b], y = P[b + 1], z = P[b + 2];
        for (let s = 0; s < sub; s++) { o.x = 0; o.y = 0; o.z = 0; o.k = kind[i]; sc.field(x, y, z, o, sc.st, time); x += o.x * h; y += o.y * h; z += o.z * h; }
        P[b] = x; P[b + 1] = y; P[b + 2] = z; if (adv) head[i] = (head[i] + 1) % M; const t = (i * M + head[i]) * 3; tr[t] = x; tr[t + 1] = y; tr[t + 2] = z;
        const c = sc.color ? sc.color(Math.hypot(o.x, o.y, o.z), o, x, y, z, sc.st, C, _c) : color(Math.hypot(o.x, o.y, o.z), o.k, sc.st);
        col[b] = c.r; col[b + 1] = c.g; col[b + 2] = c.b; age[i] += dt;
        if (age[i] > life[i] || (sc.kill ? sc.kill(x, y, z) : outBox(x, y, z, sc.box)) || insideHull(x, y, z, sc)) spawnOne(i, false);
      }
      write();
    }
  };
}
export function outBox(x, y, z, b) { return x < b[0] || x > b[1] || y < b[2] || y > b[3] || z < b[4] || z > b[5]; }
export function insideHull(x, y, z, sc) {
  if (sc.noHull) return false; const top = sc.airTop ?? 0.5, dy = sc.st && sc.st.y0 ? sc.st.y0 : 0;
  if (y - dy < -SH.T - 0.5 || y > top) return false;
  return (x * x) / (HA * HA) + (z * z) / (HB * HB) < 0.97;
}
export function hullDeflect(x, y, z, o, top = 0.5) {
  if (y < -SH.T - 2 || y > top) return;
  const e = (x * x) / (HA * HA) + (z * z) / (HB * HB); if (e >= 1.75) return;
  let nx = x / (HA * HA), nz = z / (HB * HB); const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
  const w = clamp((1.75 - e) / 0.75, 0, 1), vn = o.x * nx + o.z * nz;
  if (vn < 0) { o.x -= vn * nx * w * 1.05; o.z -= vn * nz * w * 1.05; }
  const sp = 1 + 0.3 * w; o.x *= sp; o.z *= sp; if (y < -SH.T + 1) o.y -= 0.1 * w;
}
/* 선박 방위 틀에서 본 상대 물 흐름: 선속 u, 횡속 v, 선회율 r */
export function baseWater(x, y, z, o, st) { o.x = -st.u + st.r * z; o.y = 0; o.z = -st.v - st.r * x; }
/* 우회전 프로펠러 배출류. st.n: RPM(+ 전진, − 후진) */
export function propJet(x, y, z, o, st) {
  const n = st.n || 0; if (Math.abs(n) < 1) return;
  const f = n / 70, yp = PROP.y - SH.T, dy = y - yp, rr = Math.hypot(dy, z), dx = PROP.x - x;
  if (f > 0) {
    if (dx > -2 && dx < 120) { const R = PROP.R * (1.15 + dx / 70); if (rr < R) { const k = (1 - rr / R) * (1 - dx / 130); o.x -= 7 * f * k; const om = 0.5 * f * k; o.y -= z * om; o.z += dy * om; o.k = 1; } }
    else if (dx <= -2 && dx > -35) { const R = PROP.R * 1.6; if (rr < R * 1.6) { const k = (1 - rr / (R * 1.6)) * (1 + dx / 35); o.x -= 2.5 * f * k; o.y -= dy * 0.08 * k; o.z -= z * 0.08 * k; } }
  } else {
    const ax = -dx;
    if (ax > -3 && ax < 70) { const R = PROP.R * (1.15 + ax / 40); if (rr < R) { const k = (1 - rr / R) * (1 - ax / 80); o.x += 6 * -f * k; const om = 0.5 * f * k; o.y -= z * om; o.z += dy * om; o.z += 2.2 * -f * k; o.y += 0.8 * -f * k; o.k = 1; } }
  }
}
export function boxSpawn(b, p, k = 0) { p.x = b[0] + Math.random() * (b[1] - b[0]); p.y = b[2] + Math.random() * (b[3] - b[2]); p.z = b[4] + Math.random() * (b[5] - b[4]); p.k = k; }
