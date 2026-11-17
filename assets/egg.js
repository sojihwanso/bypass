/* BYPASS 이스터에그: 우회 항해 (미니게임)
   여는 법 (일부러 안 알려 줌)
   - 키보드로 b-y-p-a-s-s 를 차례로 치기 (글 쓰는 칸 밖에서)
   - 왼쪽 위 BYPASS 로고를 2초 안에 5번 누르기 (폰)
   게임: 마스코트가 탄 작은 배가 부표·암초를 뛰어넘고, 갈매기는 숙여서 피한다.
         스페이스/↑/화면 누르기 = 점프, ↓/아래로 밀기 = 숙이기, Esc = 닫기. 최고 점수는 이 브라우저에만. */
(function () {
  'use strict';
  if (window.__bypassEgg) return; window.__bypassEgg = true;

  /* ----- 여는 방법 ----- */
  const WORD = 'bypass';
  let typed = '';
  addEventListener('keydown', (e) => {
    if (open) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    typed = (typed + e.key.toLowerCase()).slice(-WORD.length);
    if (typed === WORD) { typed = ''; start(); }
  });
  let taps = [];
  addEventListener('click', (e) => {
    const logo = e.target.closest && e.target.closest('.brand, header .nav a[href="#top"]');
    if (!logo) return;
    const now = Date.now();
    taps = taps.filter((t) => now - t < 2000).concat(now);
    if (taps.length >= 5) { taps = []; e.preventDefault(); start(); }
  }, true);

  /* ----- 화면 ----- */
  let open = false, ov, cv, ctx, raf = 0, scoreEl, msgEl, bestEl;
  const BEST = 'bypass-egg-best';
  const best = () => { try { return Number(localStorage.getItem(BEST)) || 0; } catch (e) { return 0; } };
  const setBest = (n) => { try { localStorage.setItem(BEST, String(n)); } catch (e) { /* 저장 못 함 */ } };

  const LOGO = new Image();
  LOGO.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 130 130"><path d="M66 4 L128 66 L66 128 L4 66 Z" fill="#EE6A1F" stroke="#1C211E" stroke-width="5" stroke-linejoin="round"/><path d="M66 15 L117 66 L66 117 L15 66 Z" fill="none" stroke="#1C211E" stroke-width="5" stroke-linejoin="round"/><g transform="translate(34 32) scale(0.64)" fill="#1C211E"><ellipse cx="44" cy="60" rx="27" ry="23"/><path d="M51 45 C55 37 58 31 61 25 L72 30 C68 36 66 44 64 53 Z"/><circle cx="66" cy="26" r="10"/><path d="M72 20 C83 19 93 24 95 32 C96 38 91 41 88 37 C86 34 82 33 74 33 Z"/><path d="M19 52 C10 47 7 40 11 34 C14 43 20 46 23 46 Z"/><path d="M37 80 L35 92 L27 95 L41 95 L42 81 Z"/><path d="M51 80 L51 92 L44 95 L58 95 L56 81 Z"/><circle cx="68" cy="23.5" r="2" fill="#EE6A1F"/></g></svg>');

  function build() {
    ov = document.createElement('div');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '우회 항해 미니게임');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;background:rgba(10,12,16,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;opacity:0;transition:opacity .25s';
    const box = document.createElement('div');
    box.style.cssText = 'position:relative;width:min(760px,calc(100vw - 24px));border-radius:22px;overflow:hidden;background:#FFF8EE;box-shadow:0 30px 80px rgba(0,0,0,.45);touch-action:none;user-select:none;-webkit-user-select:none';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;background:#16181D;color:#fff;font-size:14px;font-weight:700';
    const ttl = document.createElement('span'); ttl.textContent = '⚓ 우회 항해'; ttl.style.flex = '1';
    scoreEl = document.createElement('span'); scoreEl.style.cssText = 'font-variant-numeric:tabular-nums';
    bestEl = document.createElement('span'); bestEl.style.cssText = 'color:#9AA1AD;font-weight:600;font-variant-numeric:tabular-nums';
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', '게임 닫기');
    x.style.cssText = 'margin-left:6px;width:30px;height:30px;border:0;border-radius:8px;background:#2A2E36;color:#fff;font-size:14px;cursor:pointer';
    x.addEventListener('click', stop);
    bar.append(ttl, scoreEl, bestEl, x);
    cv = document.createElement('canvas'); cv.style.cssText = 'display:block;width:100%;aspect-ratio:760/300;cursor:pointer';
    msgEl = document.createElement('div');
    msgEl.style.cssText = 'position:absolute;left:0;right:0;top:46px;bottom:0;display:grid;place-items:center;text-align:center;color:#16181D;pointer-events:none;font-size:15px;line-height:1.7';
    box.append(bar, cv, msgEl);
    ov.append(box);
    ov.addEventListener('click', (e) => { if (e.target === ov) stop(); });
    // 조작
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); sy = e.clientY; press(); });
    cv.addEventListener('pointermove', (e) => { if (sy != null && e.clientY - sy > 24) duck(true); });
    addEventListener('pointerup', () => { sy = null; duck(false); });
  }
  let sy = null;
  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); stop(); return; }
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); if (e.type === 'keydown') press(); }
    if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); duck(e.type === 'keydown'); }
  }

  /* ----- 게임 ----- */
  let W = 760, K = 1;   // 폰에서는 화면을 당겨서(가로 480) 크게 보이게, 속도도 그만큼 천천히
  const H = 300, SEA = 228, G = 2100, JUMP = 760;
  let S;   // 상태
  function reset() {
    S = { t: 0, run: false, over: false, speed: 300, dist: 0, score: 0, y: 0, vy: 0, ducking: false, obs: [], next: 1.2, clouds: [], waves: 0, flash: 0 };
    for (let i = 0; i < 4; i++) S.clouds.push({ x: Math.random() * W, y: 20 + Math.random() * 70, s: 0.6 + Math.random() * 0.8 });
    paintHud();
  }
  function paintHud() {
    scoreEl.textContent = String(Math.floor(S.score)).padStart(5, '0');
    bestEl.textContent = `최고 ${String(best()).padStart(5, '0')}`;
  }
  function say(html) { msgEl.innerHTML = html; msgEl.style.display = html ? 'grid' : 'none'; }
  function press() {
    if (S.over) { if (S.t - S.overAt < 0.4) return; reset(); S.run = true; say(''); return; }
    if (!S.run) { S.run = true; say(''); }
    if (S.y === 0 && !S.ducking) S.vy = JUMP;
  }
  function duck(on) { if (!S || !S.run || S.over) { if (S) S.ducking = false; return; } S.ducking = on; if (on && S.y > 0) S.vy = Math.min(S.vy, -JUMP); }
  function spawn() {
    const lvl = Math.min(1, S.dist / 9000);
    const r = Math.random();
    if (r < 0.45) S.obs.push({ k: 'buoy', x: W + 20, w: 26, h: 40 });
    else if (r < 0.7) S.obs.push({ k: 'rock', x: W + 20, w: 46 + Math.random() * 24, h: 26 });
    else if (lvl > 0.15) S.obs.push({ k: 'gull', x: W + 20, w: 34, h: 18, y: Math.random() < 0.5 ? 58 : 30, f: 0 });
    else S.obs.push({ k: 'buoy', x: W + 20, w: 26, h: 40 });
    S.next = (0.9 + Math.random() * 1.1) * (1.15 - lvl * 0.45);
  }
  function hit(o) {
    const bx = 92, bw = 46, bh = S.ducking ? 26 : 44, by = SEA - S.y - bh;   // 배+마스코트 상자 (조금 너그럽게)
    const ox = o.x + 4, ow = o.w - 8;
    const oy = o.k === 'gull' ? SEA - o.y - o.h : SEA - o.h + 4, oh = o.h - 4;
    return bx < ox + ow && bx + bw > ox && by < oy + oh && by + bh > oy;
  }
  function step(dt) {
    S.t += dt;
    if (S.flash > 0) S.flash -= dt;
    S.waves += dt * (S.run && !S.over ? S.speed : 40);
    S.clouds.forEach((c) => { c.x -= dt * 14 * c.s; if (c.x < -80) { c.x = W + 40; c.y = 20 + Math.random() * 70; } });
    if (!S.run || S.over) return;
    S.speed = Math.min(720, 300 + S.dist / 30) * K;
    S.dist += S.speed / K * dt; S.score = S.dist / 10;
    if (Math.floor(S.score / 100) !== Math.floor((S.score - S.speed / K * dt / 10) / 100)) S.flash = 0.35;
    // 점프
    S.vy -= G * dt * (S.ducking ? 2.2 : 1); S.y = Math.max(0, S.y + S.vy * dt); if (S.y === 0) S.vy = 0;
    // 장애물
    S.next -= dt; if (S.next <= 0) spawn();
    S.obs.forEach((o) => { o.x -= (S.speed + (o.k === 'gull' ? 60 * K : 0)) * dt; if (o.k === 'gull') o.f += dt * 10; });
    S.obs = S.obs.filter((o) => o.x > -100);
    if (S.obs.some(hit)) {
      S.over = true; S.overAt = S.t;
      const sc = Math.floor(S.score), b = best();
      if (sc > b) setBest(sc);
      say(`<div><div style="font-size:22px;font-weight:800;margin-bottom:4px">좌초! ${sc > b ? '🎉 최고 기록' : ''}</div><div>${sc}점 · 다시 하려면 누르거나 스페이스</div></div>`);
    }
    paintHud();
  }
  function draw() {
    const c = ctx;
    c.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    // 하늘
    const sky = c.createLinearGradient(0, 0, 0, SEA);
    sky.addColorStop(0, '#FFE7C7'); sky.addColorStop(1, '#FFF8EE');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    // 해
    c.fillStyle = '#FFB36B'; c.beginPath(); c.arc(W - 120, 70, 34, 0, Math.PI * 2); c.fill();
    // 구름
    c.fillStyle = 'rgba(255,255,255,.9)';
    S.clouds.forEach((k) => { c.beginPath(); c.ellipse(k.x, k.y, 34 * k.s, 11 * k.s, 0, 0, Math.PI * 2); c.ellipse(k.x + 18 * k.s, k.y - 6 * k.s, 20 * k.s, 10 * k.s, 0, 0, Math.PI * 2); c.fill(); });
    // 바다
    c.fillStyle = '#2B6CB0'; c.fillRect(0, SEA, W, H - SEA);
    c.fillStyle = '#3B82C4';
    for (let i = -1; i < W / 40 + 2; i++) { const x = i * 40 - (S.waves % 40); c.beginPath(); c.arc(x + 20, SEA + 2, 20, Math.PI, 0); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 12; i++) { const x = (i * 97 - S.waves * 0.6) % (W + 60); c.fillRect((x + W + 60) % (W + 60) - 30, SEA + 26 + (i % 3) * 18, 26, 2); }
    // 장애물
    S.obs.forEach((o) => {
      if (o.k === 'buoy') {
        c.fillStyle = '#E5484D'; c.beginPath(); c.moveTo(o.x + 13, SEA - o.h); c.lineTo(o.x + o.w, SEA - 8); c.lineTo(o.x, SEA - 8); c.closePath(); c.fill();
        c.fillStyle = '#fff'; c.fillRect(o.x + 5, SEA - 22, o.w - 10, 5);
        c.fillStyle = '#16181D'; c.fillRect(o.x - 2, SEA - 9, o.w + 4, 9);
      } else if (o.k === 'rock') {
        c.fillStyle = '#4B5563'; c.beginPath(); c.moveTo(o.x, SEA + 2); c.quadraticCurveTo(o.x + o.w * 0.3, SEA - o.h - 6, o.x + o.w * 0.55, SEA - o.h); c.quadraticCurveTo(o.x + o.w * 0.9, SEA - o.h + 6, o.x + o.w, SEA + 2); c.fill();
      } else {
        const y = SEA - o.y - o.h / 2, fl = Math.sin(o.f) * 7;
        c.strokeStyle = '#16181D'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(o.x, y - fl); c.quadraticCurveTo(o.x + o.w / 4, y - 8, o.x + o.w / 2, y); c.quadraticCurveTo(o.x + o.w * 3 / 4, y - 8, o.x + o.w, y - fl); c.stroke();
      }
    });
    // 배 + 마스코트
    const by = SEA - S.y, tilt = S.y > 0 ? -0.12 : Math.sin(S.t * 6) * 0.03;
    c.save(); c.translate(115, by); c.rotate(tilt);
    if (S.ducking) c.scale(1.12, 0.7);
    c.fillStyle = '#16181D'; c.beginPath(); c.moveTo(-34, -14); c.lineTo(34, -14); c.lineTo(24, 0); c.lineTo(-26, 0); c.closePath(); c.fill();
    c.fillStyle = '#EE6A1F'; c.fillRect(-30, -14, 60, 4);
    if (LOGO.complete) c.drawImage(LOGO, -21, -54, 42, 42);
    c.restore();
    // 100점마다 반짝
    if (S.flash > 0) { c.fillStyle = `rgba(238,106,31,${S.flash})`; c.font = '800 18px -apple-system, sans-serif'; c.textAlign = 'right'; c.fillText(`${Math.floor(S.score / 100) * 100}!`, W - 20, 34); c.textAlign = 'left'; }
  }
  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    step(dt); draw();
    raf = requestAnimationFrame(loop);
  }
  function fit() {
    W = innerWidth < 600 ? 480 : 760; K = W === 760 ? 1 : 0.78;
    cv.style.aspectRatio = `${W}/${H}`;
    const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  let prevFocus = null;
  function start() {
    if (open) return;
    open = true;
    if (!ov) { build(); ctx = cv.getContext('2d'); }
    prevFocus = document.activeElement;
    document.body.append(ov); fit(); reset();
    say('<div><div style="font-size:24px;font-weight:800;margin-bottom:6px">⚓ 우회 항해</div><div>부표·암초는 <b>점프</b> (스페이스 · ↑ · 화면 누르기)<br>갈매기는 <b>숙이기</b> (↓ · 아래로 밀기)</div><div style="margin-top:10px;color:#6B7280">눌러서 출항</div></div>');
    requestAnimationFrame(() => { ov.style.opacity = '1'; });
    addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true); addEventListener('resize', fit);
    document.documentElement.style.overflow = 'hidden';
    ov.querySelector('button').focus();
    last = 0; raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (!open) return;
    open = false; cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); removeEventListener('resize', fit);
    document.documentElement.style.overflow = '';
    ov.style.opacity = '0';
    setTimeout(() => { if (!open) ov.remove(); }, 250);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  }
})();
