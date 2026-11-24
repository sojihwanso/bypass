/* 3D 무대: 렌더러, 하늘·바다·해저, 카메라 조작(직접 구현), 이름표, 부품 고르기 */
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function readPalette() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  const P = {}; for (const k of ['sky', 'sky2', 'sea', 'sea2', 'seaLine', 'ink', 'muted', 'rule', 'accent', 'warm', 'info', 'bad', 'ok', 'warn', 'surface', 'paper', 'flow0', 'flow1', 'jet0', 'jet1', 'air0', 'air1', 'cool0', 'cool1', 'sand', 'amber', 'deck', 'sea-c', 'navy', 'soft']) P[k] = g('--' + k) || '#888';
  P.dark = document.documentElement.dataset.theme === 'dark';
  return P;
}

export function createStage(el, { onPart } = {}) {
  const THREE = window.THREE;
  const canvas = document.createElement('canvas'); canvas.className = 'stage-cv'; canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none'; el.appendChild(canvas);
  const lbl = document.createElement('div'); lbl.className = 'stage-lbls'; el.appendChild(lbl);
  let renderer = null;
  const nogl = /[?&]nogl=1/.test(location.search);
  try { if (!nogl && THREE) renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
  if (!renderer) {
    const m = document.createElement('div'); m.className = 'stage-nogl';
    m.innerHTML = '<b>이 브라우저에서는 3D 화면을 열 수 없습니다.</b><span>WebGL을 지원하는 최신 브라우저(크롬, 사파리, 엣지)에서 열어 주세요. 아래 설명과 표, 그림은 그대로 볼 수 있습니다.</span>';
    el.appendChild(m); canvas.remove();
    return { ok: false, el, dispose() { el.innerHTML = ''; } };
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  let P = readPalette();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(P.sky);
  scene.fog = new THREE.Fog(new THREE.Color(P.sky), 4500, 13000);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 30000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x4d6a72, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e2, 0.85); sun.position.set(-0.45, 1, 0.3); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdbe8ff, 0.3); fill.position.set(0.6, 0.25, -0.7); scene.add(fill);

  /* 바다: 월드 좌표로 그린 격자와 잔물결. 반투명이라 물속 선체가 보인다. */
  const oceanMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true },
    uniforms: { uTime: { value: 0 }, uAmp: { value: 0.3 }, uAlpha: { value: 0.6 }, cA: { value: new THREE.Color() }, cB: { value: new THREE.Color() }, cL: { value: new THREE.Color() }, cSky: { value: new THREE.Color() }, uGrid: { value: 100 } },
    vertexShader: `uniform float uTime,uAmp;varying vec3 vW;varying float vH;
      float wv(vec2 p){return sin(p.x*.021+uTime*.9)*.55+sin(p.y*.017-uTime*.7+p.x*.006)*.5+sin((p.x+p.y)*.043+uTime*1.6)*.25+sin((p.x-p.y)*.09-uTime*2.1)*.12;}
      void main(){vec4 w=modelMatrix*vec4(position,1.);float h=wv(w.xz);w.y+=h*uAmp;vW=w.xyz;vH=h;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform vec3 cA,cB,cL,cSky;uniform float uAlpha,uGrid;varying vec3 vW;varying float vH;
      float grid(vec2 p){vec2 g=abs(fract(p-.5)-.5)/fwidth(p);return 1.-min(min(g.x,g.y),1.);}
      void main(){float d=length(vW.xz-cameraPosition.xz);
        vec3 c=mix(cB,cA,clamp(.5+vH*.35,0.,1.));
        float l=grid(vW.xz/uGrid)*.28+grid(vW.xz/(uGrid*5.))*.36;
        c=mix(c,cL,l*(1.-smoothstep(1500.,7000.,d)));
        float f=smoothstep(3000.,12000.,d);
        gl_FragColor=vec4(mix(c,cSky,f),mix(uAlpha,1.,f));}`
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(26000, 26000, 220, 220).rotateX(-Math.PI / 2), oceanMat);
  ocean.renderOrder = 2; scene.add(ocean);
  const seabed = new THREE.Group(); seabed.visible = false; scene.add(seabed);
  const sandMat = new THREE.MeshStandardMaterial({ color: P.sand, roughness: 0.95 });
  seabed.add(new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000).rotateX(-Math.PI / 2), sandMat));
  const sgrid = new THREE.GridHelper(3000, 60, 0x8a7a55, 0x8a7a55); sgrid.material.transparent = true; sgrid.material.opacity = 0.3; sgrid.position.y = 0.06; seabed.add(sgrid);

  function applyTheme() {
    P = readPalette();
    scene.background.set(P.sky); scene.fog.color.set(P.sky);
    oceanMat.uniforms.cA.value.set(P.sea); oceanMat.uniforms.cB.value.set(P.sea2); oceanMat.uniforms.cL.value.set(P.seaLine); oceanMat.uniforms.cSky.value.set(P.sky);
    sandMat.color.set(P.sand); hemi.intensity = P.dark ? 0.62 : 0.8; sun.intensity = P.dark ? 0.7 : 0.85;
    return P;
  }
  applyTheme();

  /* 카메라 조작 */
  const orb = { target: new THREE.Vector3(), r: 600, th: 2.4, ph: 1.0, anim: null };
  let dirty = true; const touch = () => { dirty = true; };
  const follow = { on: false, heading: false, obj: null, last: new THREE.Vector3(), lastYaw: 0 };
  function camUpdate() { const sp = Math.sin(orb.ph); camera.position.set(orb.target.x + orb.r * sp * Math.cos(orb.th), orb.target.y + orb.r * Math.cos(orb.ph), orb.target.z + orb.r * sp * Math.sin(orb.th)); camera.lookAt(orb.target); }
  function camTo(o, dur = 0.8) {
    const to = { r: o.r ?? orb.r, th: o.th ?? orb.th, ph: o.ph ?? orb.ph, target: (o.target || orb.target).clone() };
    let d = to.th - orb.th; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; to.th = orb.th + d;
    if (dur <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) { Object.assign(orb, { r: to.r, th: to.th, ph: to.ph }); orb.target.copy(to.target); orb.anim = null; dirty = true; return; }
    orb.anim = { from: { r: orb.r, th: orb.th, ph: orb.ph, target: orb.target.clone() }, to, t: 0, dur }; dirty = true;
  }
  function camStep(dt) {
    const a = orb.anim; if (!a) return; a.t += dt / a.dur; const k = smooth(Math.min(1, a.t));
    orb.r = a.from.r + (a.to.r - a.from.r) * k; orb.th = a.from.th + (a.to.th - a.from.th) * k; orb.ph = a.from.ph + (a.to.ph - a.from.ph) * k;
    orb.target.lerpVectors(a.from.target, a.to.target, k); if (a.t >= 1) orb.anim = null;
  }
  /* 따라가기: 배가 움직인 만큼 시점 중심을 옮긴다. heading이 켜져 있으면 배가 돈 만큼 시점도 같이 돌려
     배와 카메라의 상대 각도와 거리(배율)를 그대로 유지한다 */
  const wrapA = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  function followStep() {
    const o = follow.obj; if (!o) return;
    const d = new THREE.Vector3().subVectors(o.position, follow.last), dy = wrapA(o.rotation.y - follow.lastYaw);
    if (follow.on) {
      const a = orb.anim, tg = a ? [orb.target, a.from.target, a.to.target] : [orb.target];
      for (const t of tg) t.add(d);
      if (follow.heading && dy) {
        const c = Math.cos(dy), s = Math.sin(dy);
        for (const t of tg) { const x = t.x - o.position.x, z = t.z - o.position.z; t.x = o.position.x + x * c + z * s; t.z = o.position.z - x * s + z * c; }
        orb.th -= dy; if (a) { a.from.th -= dy; a.to.th -= dy; }
      }
    }
    follow.last.copy(o.position); follow.lastYaw = o.rotation.y;
  }
  const ptrs = new Map(); let gest = null;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); orb.anim = null;
    if (ptrs.size === 1) gest = { mode: (e.button === 2 || e.shiftKey) ? 'pan' : 'rot', x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    else if (ptrs.size === 2) { const p = [...ptrs.values()]; gest = { mode: 'pinch', d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2 }; }
    el.classList.add('grab');
  });
  function panBy(dx, dy) { camera.updateMatrixWorld(); const R = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), U = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1); const k = orb.r * 0.0016; orb.target.addScaledVector(R, -dx * k).addScaledVector(U, dy * k); }
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) { hover(e); return; }
    p.x = e.clientX; p.y = e.clientY; if (!gest) return;
    if (gest.mode === 'pinch' && ptrs.size === 2) { const q = [...ptrs.values()], d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y), mx = (q[0].x + q[1].x) / 2, my = (q[0].y + q[1].y) / 2; if (d > 0 && gest.d > 0) orb.r = clamp(orb.r * gest.d / d, 12, 9000); panBy(mx - gest.mx, my - gest.my); Object.assign(gest, { d, mx, my }); return; }
    const dx = e.clientX - gest.x, dy = e.clientY - gest.y; gest.x = e.clientX; gest.y = e.clientY;
    if (gest.mode === 'rot') { orb.th += dx * 0.0062; orb.ph = clamp(orb.ph - dy * 0.0062, 0.03, Math.PI - 0.03); } else panBy(dx, dy);
  });
  function up(e) { const g = gest; ptrs.delete(e.pointerId); if (g && g.mode !== 'pinch' && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 5 && performance.now() - g.t < 450) click(e); if (!ptrs.size) { gest = null; el.classList.remove('grab'); } else if (ptrs.size === 1) { const p = [...ptrs.values()][0]; gest = { mode: 'rot', x: p.x, y: p.y, sx: 1e9, sy: 1e9, t: 0 }; } }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  for (const ev of ['pointerdown', 'pointermove', 'wheel']) canvas.addEventListener(ev, touch, { passive: true });
  canvas.addEventListener('wheel', e => { e.preventDefault(); orb.anim = null; orb.r = clamp(orb.r * Math.exp(e.deltaY * 0.0011), 12, 9000); }, { passive: false });

  /* 이름표 */
  const labels = [];
  const _v = new THREE.Vector3();
  let labelsOn = true, obstacles = null, markers = null;
  /* 배 표식: 멀리서 보아 배가 몇 픽셀밖에 안 될 때 선수 방향 화살표로 위치를 알려 준다 */
  const mkEls = [];
  function mkEl(i) {
    if (!mkEls[i]) { const d = document.createElement('div'); d.className = 'ship-mk'; d.setAttribute('aria-hidden', 'true'); d.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 2 L20 21 L12 16.5 L4 21 Z"/></svg>'; lbl.appendChild(d); mkEls[i] = d; }
    return mkEls[i];
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const toPx = (v, w, h) => [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
  const hit = (r, q) => r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h;
  function addLabel(html, cls, getPos, part) {
    const e = document.createElement(part ? 'button' : 'div'); e.className = 'lbl ' + (cls || ''); e.innerHTML = html;
    if (part) { e.type = 'button'; e.addEventListener('click', () => onPart && onPart(part)); }
    lbl.appendChild(e); const L = { el: e, getPos, show: true, part, set(h) { if (e.innerHTML !== h) e.innerHTML = h; } }; labels.push(L); return L;
  }
  function clearLabels(keepParts) { for (let i = labels.length - 1; i >= 0; i--) if (!(keepParts && labels[i].part)) { labels[i].el.remove(); labels.splice(i, 1); } }
  function updateLabels() {
    const w = el.clientWidth, h = el.clientHeight;
    /* 이름표가 피해야 할 자리: 장면 위 버튼 줄 등 */
    const placed = obstacles ? obstacles().map(r => ({ x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 })) : [];
    /* 배 표식 */
    let tiny = false; const ms = markers ? markers() : [];
    ms.forEach((m, i) => {
      const d = mkEl(i); _a.copy(m.bow).project(camera); _b.copy(m.stern).project(camera);
      const [ax, ay] = toPx(_a, w, h), [bx, by] = toPx(_b, w, h), len = Math.hypot(ax - bx, ay - by), mx = (ax + bx) / 2, my = (ay + by) / 2;
      const on = len < 56 && _a.z < 1 && _b.z < 1 && mx > -20 && mx < w + 20 && my > -20 && my < h + 20;
      d.style.display = on ? '' : 'none'; if (!on) return; if (i === 0) tiny = true;
      d.classList.toggle('other', !!m.other);
      d.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%) rotate(${Math.atan2(ay - by, ax - bx) * 180 / Math.PI + 90}deg)`;
      placed.push({ x: mx - 15, y: my - 15, w: 30, h: 30 });
    });
    for (let i = ms.length; i < mkEls.length; i++) mkEls[i].style.display = 'none';
    /* 설명 이름표를 먼저, 부품 이름표를 나중에 놓는다. 겹치면 설명 이름표는 위아래로 비켜 놓고, 부품 이름표는 숨긴다 */
    const order = labels.filter(L => !L.part).concat(labels.filter(L => L.part));
    for (const L of order) {
      const p = L.show && labelsOn && L.el.innerHTML && !(L.part && tiny) ? L.getPos(_v) : null;
      if (!p) { L.el.style.display = 'none'; continue; }
      _v.copy(p).project(camera);
      if (_v.z > 1 || _v.z < -1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) { L.el.style.display = 'none'; continue; }
      L.el.style.display = '';
      const html = L.el.innerHTML; if (L._html !== html) { L._html = html; L._w = L.el.offsetWidth; L._h = L.el.offsetHeight; }
      const [px, sy] = toPx(_v, w, h), bw = L._w, bh = L._h, step = bh + 4, sx = bw + 8 < w ? clamp(px, bw / 2 + 4, w - bw / 2 - 4) : px;
      let dy = null;
      for (const k of L.part ? [0] : [0, 1, -1, 2, -2, 3]) {
        const r = { x: sx - bw / 2, y: sy - 1.3 * bh + k * step, w: bw, h: bh };
        if (r.y < 2 || r.y + r.h > h - 2) continue;
        if (!placed.some(q => hit(r, q))) { dy = k * step; placed.push(r); break; }
      }
      if (dy == null) { if (L.part) { L.el.style.display = 'none'; continue; } dy = 0; }
      L.el.style.transform = `translate(${sx}px,${sy + dy}px) translate(-50%,-130%)`;
    }
  }

  /* 부품 고르기 */
  const pickables = [], ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let allowed = new Set();
  const vis = o => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
  function pickAt(e) {
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const h of ray.intersectObjects(pickables.filter(vis), false)) { const p = h.object.userData.part; if (p && allowed.has(p)) return p; }
    return null;
  }
  const partMeshes = {};
  function registerPart(obj, part) { obj.traverse(o => { if (o.isMesh) { o.userData.part = part; pickables.push(o); (partMeshes[part] = partMeshes[part] || []).push(o); } }); }
  function unregister(obj) { obj.traverse(o => { const i = pickables.indexOf(o); if (i >= 0) pickables.splice(i, 1); if (o.userData.part) { const a = partMeshes[o.userData.part]; if (a) { const j = a.indexOf(o); if (j >= 0) a.splice(j, 1); } } }); }
  let hovered = null, hoverT = 0;
  function setHover(p) {
    if (p === hovered) return;
    const set = (part, on) => { for (const m of partMeshes[part] || []) for (const mt of [].concat(m.material)) if (mt.emissive) mt.emissive.set(on ? (P.dark ? '#3b5a48' : '#4b6f58') : '#000000'); };
    if (hovered) set(hovered, false); hovered = p; if (p) set(p, true); el.classList.toggle('hot', !!p);
  }
  function hover(e) { const n = performance.now(); if (n - hoverT < 60) return; hoverT = n; setHover(pickAt(e)); }
  function click(e) { const p = pickAt(e); if (p && onPart) onPart(p); }

  function resize() { dirty = true; const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(el); resize();

  return {
    ok: true, THREE, scene, camera, renderer, ocean, oceanMat, seabed, el, canvas, orb, follow,
    get palette() { return P; }, applyTheme,
    camTo, addLabel, clearLabels, setLabelsOn(b) { labelsOn = b; }, setObstacles(fn) { obstacles = fn; }, setMarkers(fn) { markers = fn; }, registerPart, unregister, setAllowedParts(list) { allowed = new Set(list); },
    setWater({ alpha = 0.6, amp = 0.3, visible = true } = {}) { oceanMat.uniforms.uAlpha.value = alpha; oceanMat.uniforms.uAmp.value = amp; ocean.visible = visible; },
    setSeabed(depth) { if (depth == null) { seabed.visible = false; return; } seabed.visible = true; seabed.position.y = -depth; },
    invalidate: touch,
    frame(dt, playing) {
      if (!playing && !dirty && !orb.anim && !(follow.on && follow.obj && (!follow.last.equals(follow.obj.position) || follow.lastYaw !== follow.obj.rotation.y))) return;
      dirty = false;
      if (playing) oceanMat.uniforms.uTime.value += dt;
      followStep();
      camStep(dt); camUpdate();
      ocean.position.set(Math.round(orb.target.x / 500) * 500, 0, Math.round(orb.target.z / 500) * 500);
      seabed.position.x = Math.round(orb.target.x / 100) * 100; seabed.position.z = Math.round(orb.target.z / 100) * 100;
      renderer.render(scene, camera); updateLabels();
    },
    dispose() {
      ro.disconnect();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
      renderer.dispose(); renderer.forceContextLoss(); el.innerHTML = '';
    }
  };
}
