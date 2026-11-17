/* BYPASS 커뮤니티 — 로그인 안 한 손님용 화면
   community/index.html 이 로그인 기록이 없을 때만 불러 쓴다. 회원 화면 코드와는 따로 돈다.

   손님이 볼 수 있는 것: 결과물(숨기지 않은 것)의 목록·상세·실행, 날씨, 크루 소개
   손님이 못 하는 것: 좋아요·댓글·글쓰기·게시판·회의실 → 누르면 로그인/가입 안내
   데이터: supabase/034_guest_showcase.sql 의 guest_showcase() 하나 + 분류 표(showcase_categories, 원래 누구나 읽기) */
(async function () {
  'use strict';
  const B = window.BYPASS, sb = B && B.sb;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const svgEl = (src) => { const t = document.createElement('template'); t.innerHTML = src; return t.content.firstChild; };
  const HEART = '<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  const GO = '<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  const NEXT = encodeURIComponent('/community/');
  const LOGIN = `/login/?next=${NEXT}`, JOIN = '/?join=1';

  /* ----- 도움 함수 (회원 화면과 같은 모양) ----- */
  const hash = (s) => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
  const TINTS = ['var(--t1)', 'var(--t2)', 'var(--t3)', 'var(--t4)', 'var(--t5)', 'var(--t6)'];
  const initialOf = (name) => { const n = String(name || '?').trim(); return /^[A-Za-z0-9]/.test(n) ? n[0].toUpperCase() : n.slice(0, 1); };
  function ago(iso) {
    const t = Date.parse(iso); if (!t) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return '방금';
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
    const d = new Date(t), now = new Date();
    const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    return `${d.getMonth() + 1}. ${d.getDate()}.${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
  }
  let CATS = [];
  const SLOT = { blue: 'app', violet: 'wiki', orange: 'tool', green: 'lab', teal: 'teal', rose: 'rose', gray: 'gray' };
  const artOf = (name) => { const c = CATS.find((x) => x.name === name), k = SLOT[(c || {}).color] || 'gray'; return { bg: `var(--c-${k}-bg)`, fg: `var(--c-${k}-fg)`, ring: `var(--c-${k}-ring)` }; };
  const safeUrl = (u) => (typeof u === 'string' && (/^https:\/\/[^\s<>"]+$/i.test(u) || /^\/[A-Za-z0-9/_.~%-]*$/.test(u)) ? u : null);

  /* ----- 머리: 회원 메뉴 대신 로그인·가입 ----- */
  document.title = 'BYPASS 커뮤니티 둘러보기';
  const TABS = [['home', '둘러보기'], ['showcase', '결과물'], ['board', '게시판', true]];
  for (const box of [$('[data-tabs]'), $('[data-tabs-sm]')]) {
    if (!box) continue;
    box.setAttribute('aria-label', '메뉴');
    box.replaceChildren(...TABS.map(([id, name, lock]) => {
      const a = el('a', null, name); a.href = `#${id}`; a.dataset.tab = id;
      if (lock) { const l = el('span', 'g-lock', '🔒'); l.setAttribute('aria-label', '회원 전용'); a.append(l); }
      return a;
    }));
  }
  const brand = $('.brand'); if (brand) brand.setAttribute('aria-label', 'BYPASS 커뮤니티 둘러보기');
  const topR = $('.top-r');
  if (topR) {
    const lg = el('a', 'btn btn-soft g-top', '로그인'); lg.href = LOGIN;
    const jn = el('a', 'btn btn-dark g-top', '가입하기'); jn.href = JOIN;
    topR.replaceChildren(lg, jn);
  }

  /* ----- 본문: 회원 화면은 감추고 손님 화면을 붙인다 ----- */
  const main = $('#main');
  $$('#main > *').forEach((x) => { x.hidden = true; });
  const style = el('style');
  style.textContent = `
.g-top { height: 38px; padding: 0 14px; font-size: 14px; }
.g-lock { margin-left: 3px; font-size: 11px; vertical-align: 1px; }
.g-hero .hi-t { font-size: 30px; }
.g-intro p { margin: 0; color: var(--text-2); font-size: 14.5px; line-height: 1.65; }
.g-intro .g-acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; }
.g-pop .lk { display: inline-flex; align-items: center; gap: 3px; color: var(--like-fg, #E5484D); font-size: 13px; font-weight: 700; }
.g-wx { display: flex; align-items: center; gap: 16px; }
.g-wx .ico { font-size: 50px; line-height: 1; }
.g-wx b { display: block; font-size: 40px; font-weight: 800; letter-spacing: -.04em; line-height: 1; }
.g-wx span { display: block; margin-top: 6px; font-size: 14px; color: var(--sub); }
.g-lockbox { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 20px; text-align: center; }
.g-lockbox b { font-size: 18px; }
.g-lockbox p { margin: 0; color: var(--sub); }
.g-lockbox .row { display: flex; gap: 8px; margin-top: 6px; }
.g-note { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; margin-top: 18px; padding: 14px 16px; border-radius: 14px; background: var(--soft2, var(--panel-2)); color: var(--mid); font-size: 14px; }
.g-note .row { display: flex; gap: 6px; margin-left: auto; }
.g-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }
@media (max-width: 980px) { .g-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; } }
@media (max-width: 560px) { .g-grid { grid-template-columns: minmax(0, 1fr); } .g-hero .hi-t { font-size: 26px; } }`;
  document.head.append(style);

  const V = {};
  function section(id, cls) { const s = el('section', cls || 'view'); s.dataset.gview = id; s.hidden = true; main.append(s); V[id] = s; return s; }
  const sHome = section('home', 'view home');
  const sShow = section('showcase');
  const sPost = section('post', 'view page');
  const sLock = section('lock');

  /* ----- 데이터 ----- */
  let rows = null, loadErr = null;
  async function load() {
    const [c, r] = await Promise.all([
      sb.from('showcase_categories').select('name, color, sort').order('sort'),
      sb.rpc('guest_showcase'),
    ]);
    if (!c.error && c.data) CATS = c.data;
    if (r.error) { loadErr = r.error; rows = []; } else rows = r.data || [];
  }

  /* ----- 결과물 카드 (회원 화면 card() 와 같은 모양, ☆ 없음) ----- */
  function thumbBox(r) {
    const a = artOf(r.category);
    const th = el('div', 'thumb'); th.style.background = a.bg;
    const cat = el('span', 'th-cat', r.category); cat.style.color = a.fg;
    const ra = el('span', 'ring a'), rb = el('span', 'ring b');
    ra.style.boxShadow = rb.style.boxShadow = `inset 0 0 0 1px ${a.ring}`;
    ra.setAttribute('aria-hidden', 'true'); rb.setAttribute('aria-hidden', 'true');
    const g = el('span', 'glyph', r.title); g.style.color = a.fg;
    th.append(cat, ra, rb, g);
    if (r.thumb_url) { const im = el('img', 'pic'); im.src = r.thumb_url; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; th.classList.add('has-pic'); th.append(im); }
    if (r.pin_rank) th.append(el('span', 'pin', '추천'));
    return th;
  }
  function card(r) {
    const c = el('div', 'card sc');
    const a = el('a', 'card-a'); a.href = `#p-${r.id}`;
    a.setAttribute('aria-label', `${r.title} · ${r.category} · ${r.author_name || '회원'}`);
    const body = el('div', 'card-b');
    const h = el('h3'); h.append(el('span', 'ct', r.title), svgEl(`<svg class="go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>`)); h.title = r.title;
    body.append(h);
    if (r.body) body.append(el('p', null, r.body));
    const m = el('span', 'card-m');
    const ini = el('span', 'ini', initialOf(r.author_name)); ini.style.background = TINTS[hash(r.author_name) % TINTS.length];
    const lk = el('span', 'lk'); lk.append(svgEl(HEART), document.createTextNode(String(r.likes || 0))); lk.setAttribute('aria-label', `좋아요 ${r.likes || 0}`);
    m.append(ini, el('span', 'who', r.author_name || '회원'), el('span', null, `· ${ago(r.created_at)}`), lk);
    body.append(m);
    a.append(thumbBox(r), body);
    c.append(a);
    const u = safeUrl(r.url);
    if (u) { const o = el('a', 'open', '열기'); o.href = u; o.target = '_blank'; o.rel = 'noopener'; o.setAttribute('aria-label', `${r.title} 바로 열기 (새 창)`); c.append(o); }
    return c;
  }
  const loginRow = () => { const d = el('div', 'row'); const a = el('a', 'btn btn-soft btn-sm', '로그인'); a.href = LOGIN; const b = el('a', 'btn btn-dark btn-sm', '가입하기'); b.href = JOIN; d.append(a, b); return d; };
  const stateP = (t) => el('p', 'state', t);

  /* ----- 둘러보기 (손님용 대시보드) ----- */
  function paintHome() {
    const head = el('div', 'db-head g-hero');
    const top = el('div', 'hi-top');
    top.append(el('p', 'hi-d', new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' })),
      el('h1', 'hi-t', '누구나, 무엇이든.'),
      el('p', 'hi-s', 'BYPASS 크루가 만든 결과물을 둘러보세요. 로그인 없이 바로 열어 쓸 수 있어요.'));
    top.querySelector('h1').id = 'g-hi'; top.querySelector('h1').tabIndex = -1;
    const acts = el('div', 'db-acts');
    const j = el('a', 'mini dark', '가입하기'); j.href = JOIN;
    const l = el('a', 'mini', '로그인'); l.href = LOGIN;
    const all = el('a', 'mini', '결과물 전체'); all.href = '#showcase';
    acts.append(all, l, j);
    head.append(top, acts);

    const grid = el('div', 'db-grid');
    // 새 결과물 (넓게)
    const wNew = el('section', 'wg wide'); wNew.style.setProperty('--i', '0');
    const hN = el('div', 'wg-h'); const more = el('a', 'link-more', '전체 보기'); more.href = '#showcase';
    hN.append(el('h2', null, '새 결과물'), more);
    const newBox = el('div', 'home-show');
    wNew.append(hN, newBox);
    // 인기 결과물
    const wPop = el('section', 'wg g-pop'); wPop.style.setProperty('--i', '1');
    const popBox = el('div');
    wPop.append(Object.assign(el('div', 'wg-h'), {}), popBox); wPop.firstChild.append(el('h2', null, '인기 결과물'));
    // 날씨
    const wWx = el('section', 'wg'); wWx.style.setProperty('--i', '2');
    const wxH = el('div', 'wg-h'); const wxWhen = el('span', 'wg-r hint'); wxH.append(el('h2', null, '목포 날씨'), wxWhen);
    const wxBox = el('div'); wxBox.append(stateP('날씨 불러오는 중…'));
    wWx.append(wxH, wxBox);
    // 크루 소개
    const wIn = el('section', 'wg g-intro wide'); wIn.style.setProperty('--i', '3');
    const ih = el('div', 'wg-h'); const about = el('a', 'link-more', 'BYPASS 소개'); about.href = '/'; ih.append(el('h2', null, 'BYPASS는'), about);
    const ip = el('p', null, '목포해양대 학생들이 자유롭게 만드는 바이브 코딩 크루예요. 코딩을 몰라도, 전공이 달라도 괜찮아요. 가입하면 내 대시보드·좋아요·댓글·게시판을 쓰고, 만든 것을 직접 올릴 수 있어요.');
    const ia = el('div', 'g-acts'); const ij = el('a', 'btn btn-dark btn-sm', '가입하기'); ij.href = JOIN; const il = el('a', 'btn btn-soft btn-sm', '이미 회원이에요'); il.href = LOGIN; ia.append(ij, il);
    wIn.append(ih, ip, ia);
    grid.append(wNew, wPop, wWx, wIn);
    sHome.replaceChildren(head, grid);

    if (!rows) { newBox.append(stateP('불러오는 중…')); popBox.append(stateP('불러오는 중…')); }
    else if (loadErr) { newBox.replaceChildren(stateP('지금은 결과물을 불러오지 못했어요. 잠시 뒤 다시 와 주세요.')); popBox.replaceChildren(stateP('—')); }
    else {
      const latest = rows.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 3);
      newBox.replaceChildren(...(latest.length ? latest.map(card) : [stateP('아직 올라온 결과물이 없어요.')]));
      const pop = rows.filter((r) => r.likes > 0).sort((a, b) => b.likes - a.likes || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 4);
      popBox.replaceChildren(...(pop.length ? pop.map((r) => {
        const a = el('a', 'wg-row'); a.href = `#p-${r.id}`;
        const th = el('span', 'wg-th');
        if (r.thumb_url) { const im = el('img'); im.src = r.thumb_url; im.alt = ''; im.loading = 'lazy'; th.append(im); }
        else { const c = artOf(r.category); th.style.background = c.bg; th.style.color = c.fg; th.textContent = r.title.slice(0, 4); }
        const t = el('span', 't'); t.append(el('b', null, r.title), el('span', null, `${r.category} · ${r.author_name || '회원'}`));
        const lk = el('span', 'lk'); lk.append(svgEl(HEART), document.createTextNode(String(r.likes)));
        a.append(th, t, lk);
        return a;
      }) : [stateP('좋아요를 받은 결과물이 아직 없어요.')]));
    }
    loadWx(wxBox, wxWhen);
  }

  // 날씨: 회원 화면과 같은 Open-Meteo, 간단히 지금만 (20분 동안 이 브라우저에 담아 둠)
  const WX = { 0: ['맑음', '☀️'], 1: ['대체로 맑음', '🌤️'], 2: ['구름 조금', '⛅'], 3: ['흐림', '☁️'], 45: ['안개', '🌫️'], 48: ['안개', '🌫️'], 51: ['이슬비', '🌦️'], 53: ['이슬비', '🌦️'], 55: ['이슬비', '🌧️'],
    61: ['약한 비', '🌦️'], 63: ['비', '🌧️'], 65: ['강한 비', '🌧️'], 71: ['약한 눈', '🌨️'], 73: ['눈', '🌨️'], 75: ['많은 눈', '❄️'], 80: ['소나기', '🌦️'], 81: ['소나기', '🌧️'], 82: ['강한 소나기', '⛈️'], 95: ['뇌우', '⛈️'] };
  async function loadWx(box, when) {
    let w = null;
    try { w = JSON.parse(localStorage.getItem('bypass-gwx-v1') || 'null'); } catch (x) { /* 저장소 못 씀 */ }
    if (!w || Date.now() - w.at > 20 * 60000) {
      try {
        const q = new URLSearchParams({ latitude: '34.79', longitude: '126.38', timezone: 'Asia/Seoul', wind_speed_unit: 'ms', forecast_days: '1',
          current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m', daily: 'temperature_2m_max,temperature_2m_min' });
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
        if (!r.ok) throw new Error(String(r.status));
        const f = await r.json(); w = { at: Date.now(), c: f.current, d: f.daily };
        try { localStorage.setItem('bypass-gwx-v1', JSON.stringify(w)); } catch (x) { /* 저장 못 함 */ }
      } catch (e) { if (!w) { box.replaceChildren(stateP('지금은 날씨를 못 불러왔어요.')); return; } }
    }
    const c = w.c, k = WX[c.weather_code] || ['날씨', '🌡️'];
    const d = el('div', 'g-wx'); const ico = el('span', 'ico', k[1]); ico.setAttribute('aria-hidden', 'true');
    const t = el('div'); const b = el('b', null, `${Math.round(c.temperature_2m)}°`);
    t.append(b, el('span', null, `${k[0]} · 체감 ${Math.round(c.apparent_temperature)}° · 최고 ${Math.round(w.d.temperature_2m_max[0])}° / 최저 ${Math.round(w.d.temperature_2m_min[0])}°`), el('span', null, `바람 ${c.wind_speed_10m.toFixed(1)} m/s`));
    d.append(ico, t);
    box.replaceChildren(d);
    when.textContent = `${new Date(w.at).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })} 기준`;
  }

  /* ----- 결과물 목록 ----- */
  let cat = '전체';
  function paintShow() {
    const head = el('div', 'sec-head');
    const hl = el('div'); const h1 = el('h1', 'view-title', '결과물'); h1.tabIndex = -1; h1.id = 'g-show';
    hl.append(el('p', 'kick', 'SHOWCASE'), h1);
    const up = el('a', 'btn btn-dark', '결과물 올리기'); up.href = LOGIN; up.title = '로그인하면 올릴 수 있어요';
    head.append(hl, up);
    const chips = el('div', 'chips sc-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', '분류로 거르기');
    const list = el('div', 'g-grid'); list.setAttribute('aria-live', 'polite');
    const counts = {}; (rows || []).forEach((r) => { counts[r.category] = (counts[r.category] || 0) + 1; });
    const names = ['전체', ...CATS.map((c) => c.name).filter((n) => counts[n])];
    (rows || []).forEach((r) => { if (!names.includes(r.category)) names.push(r.category); });
    chips.replaceChildren(...names.map((n) => {
      const b = el('button', 'chip', n); b.type = 'button'; b.setAttribute('aria-pressed', String(n === cat));
      if (n !== '전체') { const dot = el('span', 'dot'); dot.style.background = artOf(n).fg; b.prepend(dot); }
      b.append(el('span', 'n', String(n === '전체' ? (rows || []).length : counts[n] || 0)));
      b.addEventListener('click', () => { cat = n; history.replaceState(null, '', n === '전체' ? '#showcase' : `#showcase/${encodeURIComponent(n)}`); paintShow(); });
      return b;
    }));
    const pick = (rows || []).filter((r) => cat === '전체' || r.category === cat);
    if (!rows) list.append(stateP('불러오는 중…'));
    else if (loadErr) list.append(stateP('지금은 결과물을 불러오지 못했어요. 잠시 뒤 다시 와 주세요.'));
    else if (!pick.length) list.append(el('div', 'empty', '이 분류에는 아직 결과물이 없어요.'));
    else list.append(...pick.map(card));
    const note = el('div', 'g-note'); note.append('좋아요·댓글·즐겨찾기는 회원만 쓸 수 있어요.', loginRow());
    sShow.replaceChildren(head, chips, list, note);
  }

  /* ----- 결과물 하나 ----- */
  function paintPost(id) {
    const r = (rows || []).find((x) => String(x.id) === String(id));
    const back = el('a', 'crumb'); back.href = '#showcase'; back.append(svgEl('<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>'), el('span', null, '결과물'));
    const art = el('article', 'panel art');
    if (!rows) { art.append(stateP('불러오는 중…')); sPost.replaceChildren(back, art); return; }
    if (!r) {
      const box = el('div', 'g-lockbox'); box.append(el('b', null, '볼 수 없는 글이에요'), el('p', null, '회원만 볼 수 있는 글이거나 지워진 결과물이에요.'), loginRow());
      art.append(box); sPost.replaceChildren(back, art); document.title = 'BYPASS 커뮤니티'; return;
    }
    document.title = `${r.title} | BYPASS`;
    if (r.thumb_url) { const hero = el('div', 'd-hero'); const im = el('img'); im.src = r.thumb_url; im.alt = ''; hero.append(im); art.append(hero); }
    const kick = el('p', 'kick', r.category);
    const h1 = el('h1', 'art-title', r.title); h1.tabIndex = -1; h1.id = 'g-title';
    const meta = el('div', 'd-meta'); meta.append(`${r.author_name || '회원'} · ${ago(r.created_at)} · 좋아요 ${r.likes || 0}`);
    art.append(kick, h1, meta);
    if (r.body) { const b = el('div', 'd-body'); b.textContent = r.body; art.append(b); }
    const acts = el('div', 'd-acts');
    const u = safeUrl(r.url);
    if (u) { const o = el('a', 'btn btn-dark', '열어 보기 '); o.href = u; if (/^https:/i.test(u)) { o.target = '_blank'; o.rel = 'noopener'; } o.append(svgEl(GO)); acts.append(o); }
    const lk = el('a', 'btn btn-soft like'); lk.href = LOGIN; lk.title = '로그인하면 좋아요를 누를 수 있어요'; lk.append(svgEl(HEART.replace('i sm', 'i')), el('span', null, String(r.likes || 0)));
    acts.append(lk);
    art.append(acts);
    const cs = el('section', 'panel art-c'); const lb = el('div', 'g-lockbox');
    lb.append(el('b', null, '댓글은 회원만 볼 수 있어요'), el('p', null, '로그인하면 댓글을 읽고 남길 수 있어요.'), loginRow());
    cs.append(lb);
    sPost.replaceChildren(back, art, cs);
  }

  /* ----- 회원 전용 화면 ----- */
  function paintLock(what) {
    const p = el('div', 'panel'); const box = el('div', 'g-lockbox');
    const h = el('b', null, `${what}은 회원 전용이에요`); h.tabIndex = -1;
    box.append(svgEl('<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'),
      h, el('p', null, '가입하고 로그인하면 크루와 이야기 나눌 수 있어요.'), loginRow());
    p.append(box); sLock.replaceChildren(p);
  }

  /* ----- 화면 전환 ----- */
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    let v = 'home', m;
    if ((m = h.match(/^p-(\d+)$/))) { v = 'post'; paintPost(m[1]); }
    else if (h === 'showcase' || h.startsWith('showcase/')) { v = 'showcase'; const c = h.split('/')[1]; cat = c || '전체'; paintShow(); }
    else if (/^(board|meeting|me|write|edit|notice|search)/.test(h)) { v = 'lock'; paintLock(h.startsWith('meeting') ? '회의실' : h.startsWith('board') || h.startsWith('notice') ? '게시판' : '이 기능'); }
    else { v = 'home'; paintHome(); if (h && h !== 'home') history.replaceState(null, '', '#home'); document.title = 'BYPASS 커뮤니티 둘러보기'; }
    Object.entries(V).forEach(([k, s]) => { s.hidden = k !== v; });
    document.body.dataset.v = v === 'post' ? 'post' : v;   // 둘러보기·결과물은 회원 화면처럼 회색 바탕
    $$('[data-tab]').forEach((a) => { const on = a.dataset.tab === (v === 'post' ? 'showcase' : v === 'lock' ? 'board' : v); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  route();
  if (!sb) { loadErr = { message: 'no client' }; rows = []; route(); return; }
  try { await load(); } catch (e) { loadErr = e; rows = []; }
  route();
})();
