/* BYPASS 이스터에그: 컨테이너 쌓기 (미니게임)
   여는 법 (일부러 안 알려 줌)
   - 키보드로 b-y-p-a-s-s 를 차례로 치기 (글 쓰는 칸 밖에서)
   - 왼쪽 위 BYPASS 로고를 2초 안에 5번 누르기 (폰)
   게임: 크레인에 매달려 왔다 갔다 하는 컨테이너를 눌러서 떨어뜨려 배 위에 쌓는다.
         삐져나온 만큼 잘려 바다에 빠지고, 딱 맞추면 PERFECT (3번 연속이면 다시 넓어짐).
         누르기 / 스페이스 = 떨어뜨리기, Esc = 닫기. 최고 기록은 이 브라우저에만. */
(function () {
  'use strict';
  if (window.__bypassEgg) return; window.__bypassEgg = true;

  /* ----- 여는 방법 ----- */
  const WORD = 'bypass';
  let typed = '', open = false;
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

  /* ----- 크루 랭킹 (supabase/035_game_scores.sql) ----- */
  const GAME = 'stack';
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let sbP = null;
  function getSb() {   // 랜딩처럼 회원 스크립트가 없는 페이지에서는 그때 불러온다
    if (window.BYPASS && window.BYPASS.sb) return Promise.resolve(window.BYPASS.sb);
    if (sbP) return sbP;
    const load = (src) => new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = no; document.head.append(sc); });
    sbP = (window.supabase ? Promise.resolve() : load('/assets/vendor/supabase-js-2.117.2.js'))
      .then(() => (window.BYPASS ? null : load('/assets/auth.js')))
      .then(() => (window.BYPASS && window.BYPASS.sb) || null)
      .catch(() => null);
    return sbP;
  }
  async function member() {
    const sb = await getSb(); if (!sb) return null;
    try { const { data } = await sb.auth.getSession(); return data && data.session ? sb : null; } catch (e) { return null; }
  }
  async function topList(sb, n) {
    const { data, error } = await sb.rpc('game_top', { p_game: GAME, p_limit: n });
    return error ? null : data || [];
  }
  function rankHtml(rows, n) {
    if (!rows) return '<div style="opacity:.7;font-size:13px">랭킹을 불러오지 못했어요</div>';
    if (!rows.length) return '<div style="opacity:.8;font-size:13px">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</div>';
    const medal = (r) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `${r}`);
    return `<div style="margin-top:4px;text-align:left;font-size:14px;min-width:220px">${rows.slice(0, n + 1).map((r) => `<div style="display:flex;gap:10px;align-items:center;padding:4px 8px;border-radius:8px;${r.me ? 'background:rgba(238,106,31,.28);' : ''}"><span style="width:26px;text-align:center;font-weight:800">${medal(Number(r.rank))}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}${r.me ? ' (나)' : ''}</span><b style="font-variant-numeric:tabular-nums">${r.best}층</b></div>`).join('')}</div>`;
  }

  /* ----- 저장 ----- */
  const BEST = 'bypass-egg-stack';
  const best = () => { try { return Number(localStorage.getItem(BEST)) || 0; } catch (e) { return 0; } };
  const setBest = (n) => { try { localStorage.setItem(BEST, String(n)); } catch (e) { /* 저장 못 함 */ } };

  /* ----- 화면 ----- */
  let ov, cv, ctx, raf = 0, scoreEl, bestEl, msgEl, prevFocus = null;
  const FONT = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  function build() {
    ov = document.createElement('div');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '컨테이너 쌓기 미니게임');
    ov.style.cssText = `position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;background:rgba(10,12,16,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:${FONT};opacity:0;transition:opacity .25s`;
    const box = document.createElement('div');
    box.style.cssText = 'position:relative;width:min(440px,calc(100vw - 24px),calc((100dvh - 110px) * .75 ));border-radius:22px;overflow:hidden;background:#FFF8EE;box-shadow:0 30px 80px rgba(0,0,0,.45);touch-action:none;user-select:none;-webkit-user-select:none';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;background:#16181D;color:#fff;font-size:14px;font-weight:700';
    const ttl = document.createElement('span'); ttl.textContent = '📦 컨테이너 쌓기'; ttl.style.flex = '1';
    scoreEl = document.createElement('span'); scoreEl.style.cssText = 'font-variant-numeric:tabular-nums';
    bestEl = document.createElement('span'); bestEl.style.cssText = 'color:#9AA1AD;font-weight:600;font-variant-numeric:tabular-nums';
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', '게임 닫기');
    x.style.cssText = 'margin-left:6px;width:30px;height:30px;border:0;border-radius:8px;background:#2A2E36;color:#fff;font-size:14px;cursor:pointer';
    x.addEventListener('click', stop);
    bar.append(ttl, scoreEl, bestEl, x);
    cv = document.createElement('canvas'); cv.style.cssText = 'display:block;width:100%;aspect-ratio:3/4;cursor:pointer';
    msgEl = document.createElement('div');
    msgEl.style.cssText = 'position:absolute;left:0;right:0;top:54px;bottom:0;display:grid;place-items:center;text-align:center;color:#fff;pointer-events:none;font-size:15px;line-height:1.7;align-items:start;padding-top:22%';
    box.append(bar, cv, msgEl);
    ov.append(box);
    ov.addEventListener('click', (e) => { if (e.target === ov) stop(); });
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); act(); });
  }
  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); stop(); return; }
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); if (!e.repeat) act(); }
  }
  function say(html) { msgEl.innerHTML = html ? `<div style="max-width:86%;padding:18px 22px;border-radius:18px;background:rgba(22,24,29,.82);box-shadow:0 10px 30px rgba(0,0,0,.25)">${html}</div>` : ''; msgEl.style.display = html ? 'grid' : 'none'; }

  /* ----- 게임 ----- */
  const W = 420, H = 560, BH = 28, DECK = 470, BASE_W = 200, DROP = 78;   // DROP: 크레인에서 꼭대기까지
  const COLORS = [['#EE6A1F', '#C9531A'], ['#2F6FD6', '#2558AB'], ['#16A394', '#11847A'], ['#E5484D', '#BE3A3E'], ['#F2B417', '#CC960E'], ['#7C5CDB', '#6447B7'], ['#3E9B4F', '#2F7C3E']];
  let S;
  function reset() {
    S = {
      t: 0, state: 'ready', stack: [{ x: (W - BASE_W) / 2, w: BASE_W, c: -1 }], cur: null, dir: 1,
      falls: [], parts: [], pops: [], cam: 0, camTo: 0, combo: 0, score: 0, shake: 0, sway: 0,
    };
    next();
    paintHud();
  }
  const topOf = () => S.stack[S.stack.length - 1];
  const yOf = (i) => DECK - i * BH;            // i층 컨테이너의 바닥 높이 (0 = 갑판)
  function next() {
    const top = topOf(), n = S.stack.length;
    const from = n % 2 ? -1 : 1;
    S.cur = { x: from < 0 ? -top.w * 0.6 : W - top.w * 0.4, w: top.w, c: (n - 1) % COLORS.length, drop: 0, vy: 0, y: 0 };
    S.dir = from < 0 ? 1 : -1;
    S.speed = Math.min(430, 160 + n * 9);
    S.camTo = Math.max(0, (n - 6) * BH);
  }
  function paintHud() { scoreEl.textContent = `${S.score}층`; bestEl.textContent = `최고 ${best()}층`; }
  function act() {
    if (S.state === 'ready') { S.state = 'play'; say(''); return; }
    if (S.state === 'over') { if (S.t - S.overAt > 0.5) { reset(); S.state = 'play'; say(''); } return; }
    if (S.cur.drop) return;
    S.cur.drop = 1;   // 떨어지는 중 (아래 step 에서 착지 판정)
  }
  function land() {
    const c = S.cur, top = topOf();
    const l = Math.max(c.x, top.x), r = Math.min(c.x + c.w, top.x + top.w), ov2 = r - l;
    const yTop = yOf(S.stack.length);
    if (ov2 <= 0) {   // 완전히 빗나감 → 바다로
      S.falls.push({ x: c.x, y: yTop - BH, w: c.w, c: c.c, vx: S.dir * 60, vy: 0, a: 0, va: (c.x < top.x ? -1 : 1) * 2.4 });
      S.cur = null; over(); return;
    }
    const off = c.x - top.x;
    let nx = l, nw = ov2;
    if (Math.abs(off) <= 4) {   // PERFECT: 딱 맞춤
      nx = top.x; nw = top.w; S.combo++;
      let txt = 'PERFECT';
      if (S.combo >= 3) { const grow = Math.min(12, BASE_W - nw); if (grow > 0) { nx -= grow / 2; nw += grow; txt = `PERFECT ×${S.combo} · 넓어짐!`; } else txt = `PERFECT ×${S.combo}`; }
      else if (S.combo > 1) txt = `PERFECT ×${S.combo}`;
      S.pops.push({ t: 0, txt, x: nx + nw / 2, y: yTop - BH - 8 });
      for (let i = 0; i < 18; i++) S.parts.push({ x: nx + Math.random() * nw, y: yTop - BH / 2, vx: (Math.random() - 0.5) * 260, vy: -120 - Math.random() * 220, t: 0, c: Math.random() < 0.5 ? '#FFD43B' : '#fff' });
    } else {
      S.combo = 0;
      // 삐져나온 조각은 잘려서 바다로
      const cutX = off > 0 ? r : c.x, cutW = c.w - ov2;
      S.falls.push({ x: cutX, y: yTop - BH, w: cutW, c: c.c, vx: (off > 0 ? 1 : -1) * 70, vy: 0, a: 0, va: (off > 0 ? 1 : -1) * 3 });
      S.shake = 0.12;
    }
    S.stack.push({ x: nx, w: nw, c: c.c });
    S.score = S.stack.length - 1;
    S.sway = 1;
    paintHud();
    next();
  }
  function over() {
    S.state = 'over'; S.overAt = S.t; S.shake = 0.35;
    const b = best(), sc = S.score;
    if (sc > b) setBest(sc);
    paintHud();
    const line = sc >= 30 ? '전설의 선장' : sc >= 20 ? '노련한 갑판장' : sc >= 10 ? '든든한 항해사' : sc >= 5 ? '견습 갑판원' : '첫 출항';
    const head = `<div style="font-size:30px;font-weight:800">${sc}층</div><div style="font-weight:700">${line}${sc > b && sc > 0 ? ' · 🎉 내 최고 기록' : ''}</div>`;
    const tail = '<div style="margin-top:10px;opacity:.85">다시 하려면 누르거나 스페이스</div>';
    const run = S.t;
    say(`<div>${head}<div style="margin-top:10px;opacity:.7;font-size:13px">크루 랭킹 확인 중…</div>${tail}</div>`);
    (async () => {
      const sb = await member();
      if (S.state !== 'over' || S.overAt !== run) return;   // 그사이 다시 시작함
      if (!sb) { say(`<div>${head}<div style="margin-top:10px;font-size:13px;opacity:.85">로그인하면 크루 랭킹에 기록이 올라가요</div>${tail}</div>`); return; }
      let res = null;
      if (sc > 0) { const r = await sb.rpc('submit_game_score', { p_game: GAME, p_score: sc }); res = r.error ? null : r.data; }
      const rows = await topList(sb, 5);
      if (S.state !== 'over' || S.overAt !== run) return;
      const mine = res ? `<div style="margin-top:6px;font-size:13px;opacity:.9">크루 ${res.total}명 중 <b>${res.rank}위</b>${res.new_best ? ' · 랭킹 기록 갱신!' : ` · 내 기록 ${res.best}층`}</div>` : '';
      say(`<div>${head}${mine}<div style="margin-top:10px;font-weight:800;font-size:13px;opacity:.8">🏆 크루 랭킹</div>${rankHtml(rows, 5)}${tail}</div>`);
    })();
  }
  function step(dt) {
    S.t += dt;
    S.cam += (S.camTo - S.cam) * Math.min(1, dt * 6);
    S.shake = Math.max(0, S.shake - dt);
    S.sway = Math.max(0, S.sway - dt * 1.6);
    if (S.state === 'play' && S.cur) {
      const c = S.cur;
      if (!c.drop) {
        c.x += S.dir * S.speed * dt;
        const lo = -c.w * 0.6, hi = W - c.w * 0.4;
        if (c.x < lo) { c.x = lo; S.dir = 1; } else if (c.x > hi) { c.x = hi; S.dir = -1; }
      } else {
        c.vy += 2600 * dt; c.y += c.vy * dt;
        if (c.y >= DROP) land();   // 크레인 높이에서 쌓인 꼭대기까지
      }
    }
    S.falls.forEach((f) => { f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va * dt; });
    S.falls = S.falls.filter((f) => f.y - S.cam < H + 200);
    S.parts.forEach((p) => { p.t += dt; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    S.parts = S.parts.filter((p) => p.t < 1.1);
    S.pops.forEach((p) => { p.t += dt; }); S.pops = S.pops.filter((p) => p.t < 1.2);
  }

  /* ----- 그리기 ----- */
  function box(c, x, y, w, ci, alpha) {
    const [fill, dark] = ci < 0 ? ['#16181D', '#16181D'] : COLORS[ci];
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.fillStyle = fill; c.fillRect(x, y, w, BH - 2);
    c.fillStyle = dark;
    for (let i = x + 6; i < x + w - 4; i += 7) c.fillRect(i, y + 4, 2, BH - 10);   // 골판 줄
    c.fillRect(x, y, w, 3); c.fillRect(x, y + BH - 5, w, 3);
    if (w > 70 && ci >= 0 && ci % 3 === 0) { c.fillStyle = 'rgba(255,255,255,.9)'; c.font = `800 11px ${FONT}`; c.textAlign = 'center'; c.fillText('BYPASS', x + w / 2, y + BH / 2 + 2); c.textAlign = 'left'; }
    c.globalAlpha = 1;
  }
  function draw() {
    const c = ctx, n = S.stack.length;
    c.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    // 하늘: 높이 쌓을수록 낮 → 노을 → 밤
    const k = Math.min(1, S.score / 40);
    const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
    const top = k < 0.5 ? mix([255, 231, 199], [255, 154, 120], k * 2) : mix([255, 154, 120], [28, 32, 64], (k - 0.5) * 2);
    const bot = k < 0.5 ? mix([255, 248, 238], [255, 214, 170], k * 2) : mix([255, 214, 170], [60, 58, 96], (k - 0.5) * 2);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (k > 0.6) { c.fillStyle = `rgba(255,255,255,${(k - 0.6) * 2})`; for (let i = 0; i < 40; i++) c.fillRect((i * 97) % W, (i * 53) % 260, 2, 2); }
    const sh = S.shake > 0 ? (Math.random() - 0.5) * 10 * S.shake / 0.35 : 0;
    c.save(); c.translate(sh, S.cam);
    // 해/달
    c.fillStyle = k > 0.6 ? '#F4F1DE' : '#FFB36B'; c.beginPath(); c.arc(360, 70 - S.cam * 0.7, 26, 0, Math.PI * 2); c.fill();
    // 배 + 쌓인 컨테이너 (출렁임)
    const bob = Math.sin(S.t * 1.6) * 3, tilt = Math.sin(S.t * 1.1) * 0.012 + Math.sin(S.t * 9) * 0.02 * S.sway;
    c.save(); c.translate(W / 2, DECK + bob); c.rotate(tilt); c.translate(-W / 2, -DECK);
    c.fillStyle = '#16181D'; c.beginPath(); c.moveTo(60, DECK); c.lineTo(W - 40, DECK); c.lineTo(W - 70, DECK + 46); c.lineTo(84, DECK + 46); c.closePath(); c.fill();
    c.fillStyle = '#EE6A1F'; c.fillRect(64, DECK + 6, W - 108, 5);
    c.fillStyle = '#fff'; c.font = `800 12px ${FONT}`; c.fillText('M/V BYPASS', 96, DECK + 32);
    // 선교(브리지)
    c.fillStyle = '#F3F4F6'; c.fillRect(W - 92, DECK - 34, 40, 34); c.fillStyle = '#16181D'; c.fillRect(W - 86, DECK - 26, 28, 7);
    for (let i = 1; i < n; i++) box(c, S.stack[i].x, yOf(i) - BH, S.stack[i].w, S.stack[i].c);
    c.restore();
    // 바다 (앞)
    c.fillStyle = '#2B6CB0'; c.fillRect(0, DECK + 30, W, 400);
    c.fillStyle = '#3B82C4';
    for (let i = -1; i < W / 34 + 2; i++) { const x = i * 34 - ((S.t * 30) % 34); c.beginPath(); c.arc(x + 17, DECK + 32, 17, Math.PI, 0); c.fill(); }
    // 떨어지는 조각
    S.falls.forEach((f) => { c.save(); c.translate(f.x + f.w / 2, f.y + BH / 2); c.rotate(f.a); box(c, -f.w / 2, -BH / 2, f.w, f.c, f.y > DECK + 30 ? 0.5 : 1); c.restore(); });
    // 크레인 + 움직이는 컨테이너
    if (S.cur && S.state !== 'over') {
      const cy = yOf(n) - BH - DROP + S.cur.y;
      if (!S.cur.drop) { c.strokeStyle = '#16181D'; c.lineWidth = 2; c.beginPath(); c.moveTo(S.cur.x + S.cur.w / 2, cy - 200); c.lineTo(S.cur.x + S.cur.w / 2, cy); c.stroke(); c.fillStyle = '#16181D'; c.fillRect(S.cur.x + S.cur.w / 2 - 8, cy - 6, 16, 6); }
      box(c, S.cur.x, cy, S.cur.w, S.cur.c);
      // 떨어질 자리 안내 (아주 옅게)
      const t = topOf(); c.fillStyle = 'rgba(22,24,29,.06)'; c.fillRect(t.x, yOf(n) - BH, t.w, BH - 2);
    }
    // 반짝이
    S.parts.forEach((p) => { c.globalAlpha = 1 - p.t / 1.1; c.fillStyle = p.c; c.fillRect(p.x, p.y, 4, 4); }); c.globalAlpha = 1;
    S.pops.forEach((p) => { c.globalAlpha = 1 - p.t / 1.2; c.fillStyle = '#16181D'; c.font = `800 16px ${FONT}`; c.textAlign = 'center'; c.fillText(p.txt, p.x, p.y - p.t * 40); c.textAlign = 'left'; }); c.globalAlpha = 1;
    c.restore();
  }
  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    step(dt); draw();
    raf = requestAnimationFrame(loop);
  }
  function fit() { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  function start() {
    if (open) return;
    open = true;
    if (!ov) { build(); ctx = cv.getContext('2d'); }
    prevFocus = document.activeElement;
    document.body.append(ov); fit(); reset();
    const intro = '<div style="font-size:26px;font-weight:800;margin-bottom:6px">📦 컨테이너 쌓기</div><div>크레인이 옮기는 컨테이너를<br><b>눌러서</b> 떨어뜨려 쌓으세요 (스페이스도 됨)</div><div style="margin-top:8px;opacity:.85">딱 맞추면 PERFECT · 3번 연속이면 다시 넓어져요</div>';
    const go = '<div style="margin-top:12px;font-weight:700">눌러서 시작</div>';
    say(`<div>${intro}${go}</div>`);
    // 크루 1~3위를 시작 화면에 살짝
    member().then((sb) => (sb ? topList(sb, 3) : null)).then((rows) => {
      if (!open || S.state !== 'ready' || !rows || !rows.length) return;
      say(`<div>${intro}<div style="margin-top:12px;font-weight:800;font-size:13px;opacity:.8">🏆 크루 랭킹</div>${rankHtml(rows, 3)}${go}</div>`);
    });
    requestAnimationFrame(() => { ov.style.opacity = '1'; });
    addEventListener('keydown', onKey, true); addEventListener('resize', fit);
    document.documentElement.style.overflow = 'hidden';
    ov.querySelector('button').focus();
    last = 0; raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (!open) return;
    open = false; cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true); removeEventListener('resize', fit);
    document.documentElement.style.overflow = '';
    ov.style.opacity = '0';
    setTimeout(() => { if (!open) ov.remove(); }, 250);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  }
})();
