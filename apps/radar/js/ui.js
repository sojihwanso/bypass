/* 화면 틀: 헤더·빠른 조작 막대·PPI 상자·오른쪽 정보창·메뉴·커서 메뉴·이스터에그
   main.js가 actions(조작 함수)와 refresh(data)로 값을 넘긴다. */
import { S, saveSettings, emit } from './state.js';
import { MENU, getPath, setPath } from './menu.js';
import { t, tl, lang } from './i18n.js';
import { BP_LOGO } from './logo.js';
import { VERSION, PATCH_NOTES } from './version.js';

const $ = (q, r = document) => r.querySelector(q);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICON = {
  tx: P('<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>'),
  mode: P('<circle cx="12" cy="12" r="9"/><path d="M12 6.5l3 8-3-2-3 2z"/>'),
  motion: P('<path d="M4 12h13"/><path d="M13 7l5 5-5 5"/><circle cx="5" cy="12" r="1.5"/>'),
  off: P('<circle cx="12" cy="12" r="9"/><circle cx="9" cy="15" r="2.2"/><path d="M9 3v4M9 19v2M3 15h3M12 15h9"/>'),
  preset: P('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  trail: P('<circle cx="18" cy="6" r="2.2"/><path d="M14.5 9.5l-1.5 1.5M10.5 13.5L9 15M6 18l-1 1" />'),
  pi: P('<path d="M6 21L15 3M11 21L20 3"/><circle cx="4" cy="12" r="1.3"/>'),
  az: P('<path d="M12 20L5.5 8.5a8 8 0 0 1 13 0z"/><path d="M8.5 13.5a5 5 0 0 1 7 0"/>'),
  pause: P('<path d="M9 5v14M15 5v14"/>'),
  speed: P('<path d="M4 6l7 6-7 6zM12 6l7 6-7 6z"/>'),
  pal: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  conn: P('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v8M12 14v8M2 12h8M14 12h8"/>'),
  shot: P('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l2-3h4l2 3"/><circle cx="12" cy="13.5" r="3.5"/>'),
  scn: P('<path d="M5 21V4h12l-2.5 4L17 12H5"/>'),
  help: P('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6v.4"/><circle cx="12" cy="17" r=".6"/>'),
  fs: P('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  mute: P('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/>'),
  panel: P('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'),
};
const QB = [['tx', 'q_tx'], ['mode', 'q_mode'], ['motion', 'q_motion'], ['off', 'q_off'], ['sep'], ['preset', 'q_preset'], ['trail', 'q_trail'], ['pi', 'q_pi'], ['az', 'q_az'], ['sep'], ['pause', 'q_pause'], ['speed', 'q_speed'], ['scn', 'q_scn'], ['sep'], ['pal', 'q_pal'], ['conn', 'q_conn'], ['shot', 'q_shot'], ['menu', 'q_menu']];

export function initUI(root, actions) {
  root.innerHTML = `
<header class="top">
  <div class="brand"><b data-t="brand"></b><span data-t="sub"></span></div>
  <span class="scn-chip" id="scnChip" hidden></span>
  <div class="htools">
    <button class="hbtn rp-toggle" type="button" data-act="rp" aria-label="정보창">${ICON.panel}</button>
    <div class="seg2" role="group" aria-label="Language"><button type="button" data-act="lang" data-v="ko">한</button><button type="button" data-act="lang" data-v="en">EN</button></div>
    <button class="hbtn" type="button" data-act="fs" aria-label="전체 화면">${ICON.fs}</button>
    <button class="ver" type="button" id="verTop" aria-label="버전 ${VERSION}">v${VERSION}</button>
    <a class="bp-logo" id="bpLogo" href="https://teambypass.vercel.app/" title="Team Bypass" aria-label="Team Bypass 메인으로">${BP_LOGO}</a>
  </div>
</header>
<div class="main">
  <nav class="qbar" id="qbar" aria-label="빠른 조작">${QB.map(([k, l]) => (k === 'sep' ? '<div class="qsep"></div>' : `<button type="button" class="qb" data-act="${k}" id="qb_${k}">${ICON[k]}<span data-t="${l}"></span><span class="qv" id="qv_${k}"></span></button>`)).join('')}</nav>
  <section class="ppi-wrap" id="ppiWrap">
    <canvas id="cvEcho"></canvas><canvas id="cvOver" aria-label="레이더 화면"></canvas>
    <div class="tl">
      <div class="bx" id="bxRange" data-wheel="range" style="position:static"><span class="lb">RANGE</span><span class="big" id="vRange">-</span><span class="lb" id="vRing"></span><span class="pm"><button type="button" data-act="rangeUp" aria-label="범위 늘리기">+</button><button type="button" data-act="rangeDn" aria-label="범위 줄이기">−</button></span></div>
      <div class="bx" id="bxMode" style="position:static"><button type="button" data-act="mode" id="vOrient">HU</button><button type="button" data-act="motion" id="vMotion">RM</button><span class="lb" id="vBand">X-BAND</span><button type="button" data-act="pulse" id="vPulse">M1</button></div>
      <div class="bx" id="bxTx" style="position:static"><span class="dot"></span><span id="vTx">STBY</span></div>
    </div>
    <div class="tr"><div class="bx" id="bxEcho" style="position:static">
      <div class="ctl" id="bxGain" data-wheel="gain"><span class="lb">GAIN</span><span class="bar"><i></i></span><span class="md"></span></div>
      <div class="ctl" id="bxSea" data-wheel="sea" data-act="seaAuto"><span class="lb">SEA</span><span class="bar"><i></i></span><span class="md"></span></div>
      <div class="ctl" id="bxRain" data-wheel="rain" data-act="rainAuto"><span class="lb">RAIN</span><span class="bar"><i></i></span><span class="md"></span></div>
      <div class="ctl" id="bxTune" data-wheel="tune" data-act="tuneAuto"><span class="lb">TUNE</span><span class="bar"><i></i></span><span class="md"></span></div>
      <div class="lb" id="vPreset" style="margin-top:4px"></div>
    </div><div class="bx" id="bxCursor" style="position:static"></div></div>
    <div class="bx bl" id="bxEbl"><div class="eb">
      <button type="button" class="tg" data-act="ebl1">EBL1</button><span class="vv" id="vEbl1" data-wheel="ebl1">-</span><button type="button" data-act="eblRef" id="vEblRef">T</button>
      <button type="button" class="tg" data-act="ebl2">EBL2</button><span class="vv" id="vEbl2" data-wheel="ebl2">-</span><span></span></div></div>
    <div class="bx br" id="bxVrm"><div class="eb">
      <button type="button" class="tg" data-act="vrm1">VRM1</button><span class="vv" id="vVrm1" data-wheel="vrm1">-</span><span class="lb" id="vTtg1"></span>
      <button type="button" class="tg" data-act="vrm2">VRM2</button><span class="vv" id="vVrm2" data-wheel="vrm2">-</span><span class="lb" id="vTtg2"></span></div></div>
    <button class="ver-foot" type="button" id="verFoot" aria-label="버전 ${VERSION}">v${VERSION}</button>
  </section>
  <aside class="rp" id="rp">
    <div class="sec" id="pnOwn"><h3><span data-t="own"></span><span class="num" id="vClock"></span></h3>
      <dl class="kv"><dt>HDG</dt><dd class="big" id="vHdg">-</dd><dt>STW</dt><dd id="vStw">-</dd><dt>SOG</dt><dd id="vSog">-</dd><dt>COG</dt><dd id="vCog">-</dd><dt>ROT</dt><dd id="vRot">-</dd><dt data-t="posn"></dt><dd id="vPos">-</dd><dt data-t="elapsed"></dt><dd id="vEl">-</dd></dl></div>
    <button class="help-btn" type="button" id="btnHelp" data-act="help">${ICON.help}<span data-t="help"></span></button>
    <div class="sec" id="pnTgt"><h3><span data-t="tgt"></span></h3><div class="tslots" id="tSlots"></div></div>
    <div class="sec" id="pnTT"><h3><span data-t="ttais"></span><span class="num" id="vCounts"></span></h3><dl class="kv" id="vTT"></dl></div>
    <div class="sec" id="pnAlert"><h3><span data-t="alert"></span><span class="num" id="vAlN"></span></h3><div id="aBox"></div></div>
  </aside>
</div>
<div class="mpanel" id="menuPanel" hidden><header><span data-t="menuTitle"></span><button class="btn" type="button" data-act="menuClose" data-t="close"></button></header><div class="mtabs" id="mTabs"></div><div class="mlist" id="mList"></div></div>
<div class="cmenu" id="cmenu" hidden role="menu"></div>
<dialog id="eggDlg"><div class="dlg-h"><span data-t="egg"></span><button class="btn" type="button" data-act="eggClose" data-t="close"></button></div><div class="dlg-b" id="eggBody"></div><div class="dlg-f"><button class="btn pri" type="button" data-act="patch" data-t="patch"></button></div></dialog>
<dialog id="genDlg"><div class="dlg-h"><span id="genT"></span><button class="btn" type="button" data-act="genClose" data-t="close"></button></div><div class="dlg-b" id="genB"></div><div class="dlg-f" id="genF"></div></dialog>
<div class="rotate"><div><b data-t="rotate" style="font-size:18px"></b><p data-t="rotateSub"></p></div></div>`;

  let menuTab = MENU[0].id;
  const applyLang = () => {
    document.documentElement.lang = lang();
    for (const el of root.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
    for (const b of root.querySelectorAll('[data-act="lang"]')) b.classList.toggle('on', b.dataset.v === lang());
    if (!$('#menuPanel').hidden) renderMenu();
  };
  const applyTheme = () => { document.documentElement.dataset.theme = S.disp.palette; };

  /* ---- 메뉴 패널 ---- */
  function renderMenu() {
    $('#mTabs').innerHTML = MENU.map((m) => `<button type="button" data-tab="${m.id}" class="${m.id === menuTab ? 'on' : ''}">${esc(tl(m))}</button>`).join('');
    const m = MENU.find((x) => x.id === menuTab);
    $('#mList').innerHTML = m.items.map((it) => {
      const nm = `<div class="nm">${esc(tl(it))}<small>${esc(tl(it.help))}</small></div>`;
      if (it.type === 'action') return `<div class="mrow">${nm}<button class="btn" type="button" data-mact="${it.act}">${lang() === 'en' ? 'Run' : '실행'}</button></div>`;
      const v = getPath(S, it.path);
      if (it.type === 'enum') return `<div class="mrow">${nm}<select data-path="${it.path}">${it.opts.map((o) => `<option value="${esc(o.v)}"${o.v === v ? ' selected' : ''}>${esc(tl(o))}</option>`).join('')}</select></div>`;
      if (it.type === 'bool') return `<div class="mrow">${nm}<input class="tog" type="checkbox" data-path="${it.path}"${v ? ' checked' : ''} aria-label="${esc(tl(it))}"></div>`;
      return `<div class="mrow">${nm}<input type="number" data-path="${it.path}" value="${v}" min="${it.min}" max="${it.max}" step="${it.step}"></div>`;
    }).join('');
  }
  const menuEl = $('#menuPanel');
  menuEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]'); if (tab) { menuTab = tab.dataset.tab; renderMenu(); return; }
    const ma = e.target.closest('[data-mact]'); if (ma) actions.menuAction && actions.menuAction(ma.dataset.mact);
  });
  menuEl.addEventListener('change', (e) => {
    const el = e.target.closest('[data-path]'); if (!el) return;
    const path = el.dataset.path, it = MENU.flatMap((m) => m.items).find((i) => i.path === path); let v;
    if (it.type === 'bool') v = el.checked; else if (it.type === 'num') v = Number(el.value); else { const o = it.opts.find((x) => String(x.v) === el.value); v = o ? o.v : el.value; }
    setPath(S, path, v); saveSettings(); emit('settings', path);
    if (path === 'ui.lang') applyLang(); if (path === 'disp.palette') applyTheme();
    if (it.type === 'num') el.value = getPath(S, path);
  });

  /* ---- 클릭 위임 ---- */
  const internal = {
    menu: () => { menuEl.hidden = !menuEl.hidden; if (!menuEl.hidden) renderMenu(); },
    menuClose: () => { menuEl.hidden = true; },
    lang: (el) => { S.ui.lang = el.dataset.v; saveSettings(); applyLang(); emit('settings', 'ui.lang'); },
    fs: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); },
    rp: () => $('#rp').classList.toggle('open'),
    eggClose: () => $('#eggDlg').close(), genClose: () => $('#genDlg').close(),
    patch: () => { $('#eggBody').innerHTML = `<div class="pn">${PATCH_NOTES.map((p) => `<h4>v${p.v} · ${p.d}</h4><ul>${(p[lang()] || p.ko).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}</div>`; },
    pal: () => { const o = ['day', 'dusk', 'night']; S.disp.palette = o[(o.indexOf(S.disp.palette) + 1) % 3]; applyTheme(); saveSettings(); emit('settings', 'disp.palette'); },
    seaAuto: () => { S.ctrl.sea.auto = !S.ctrl.sea.auto; emit('settings', 'ctrl.sea'); },
    rainAuto: () => { S.ctrl.rain.auto = !S.ctrl.rain.auto; emit('settings', 'ctrl.rain'); },
    tuneAuto: () => { S.ctrl.tune.auto = !S.ctrl.tune.auto; emit('settings', 'ctrl.tune'); },
  };
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el || el.closest('#menuPanel [data-tab]')) return;
    const a = el.dataset.act;
    if (internal[a]) internal[a](el, e); else if (actions[a]) actions[a](el, e);
  });
  /* ---- 휠: 상자 위에서 값 조정 ---- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  root.addEventListener('wheel', (e) => {
    const el = e.target.closest('[data-wheel]'); if (!el) return;
    e.preventDefault(); const d = e.deltaY < 0 ? 1 : -1, k = el.dataset.wheel, step = e.shiftKey ? 10 : 2;
    if (k === 'gain') S.ctrl.gain = clamp(S.ctrl.gain + d * step, 0, 100);
    else if (k === 'sea') S.ctrl.sea.val = clamp(S.ctrl.sea.val + d * step, 0, 100);
    else if (k === 'rain') S.ctrl.rain.val = clamp(S.ctrl.rain.val + d * step, 0, 100);
    else if (k === 'tune') { S.ctrl.tune.auto = false; S.ctrl.tune.val = clamp(S.ctrl.tune.val + d * step, 0, 100); }
    else if (actions.wheel) actions.wheel(k, d, e);
    emit('settings', 'ctrl.' + k);
  }, { passive: false });
  /* 터치: 상자 위 세로 끌기 = 휠 */
  let drag = null;
  root.addEventListener('pointerdown', (e) => { const el = e.target.closest('[data-wheel]'); if (el && e.pointerType === 'touch') drag = { el, y: e.clientY }; });
  root.addEventListener('pointermove', (e) => { if (!drag) return; const dy = drag.y - e.clientY; if (Math.abs(dy) > 12) { drag.el.dispatchEvent(new WheelEvent('wheel', { deltaY: -dy, bubbles: true, cancelable: true })); drag.y = e.clientY; } });
  addEventListener('pointerup', () => { drag = null; });

  /* ---- 커서 메뉴(오른쪽 클릭 / 길게 누르기) ---- */
  const cm = $('#cmenu'), over = $('#cvOver');
  const CM = [['acq', 'cm_acq'], ['cancel', 'cm_cancel'], ['data', 'cm_data'], ['act', 'cm_act'], ['ref', 'cm_ref'], ['-'], ['ebl', 'cm_ebl'], ['vrm', 'cm_vrm'], ['offEbl', 'cm_offEbl'], ['ruler', 'cm_ruler'], ['-'], ['off', 'cm_off'], ['center', 'cm_center'], ['drop', 'cm_drop'], ['anchor', 'cm_anchor']];
  let cmPos = null;
  function openCM(x, y) {
    const r = over.getBoundingClientRect(); cmPos = { sx: x - r.left, sy: y - r.top };
    cm.innerHTML = CM.map(([k, l]) => (k === '-' ? '<hr>' : `<button type="button" role="menuitem" data-cm="${k}">${esc(t(l))}</button>`)).join('');
    cm.hidden = false; const w = cm.offsetWidth, h = cm.offsetHeight;
    cm.style.left = Math.min(x, innerWidth - w - 8) + 'px'; cm.style.top = Math.min(y, innerHeight - h - 8) + 'px';
  }
  over.addEventListener('contextmenu', (e) => { e.preventDefault(); openCM(e.clientX, e.clientY); });
  let lp = null;
  over.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') lp = setTimeout(() => openCM(e.clientX, e.clientY), 550); });
  over.addEventListener('pointerup', () => clearTimeout(lp)); over.addEventListener('pointermove', () => clearTimeout(lp));
  cm.addEventListener('click', (e) => { const b = e.target.closest('[data-cm]'); if (!b) return; cm.hidden = true; actions.cursor && actions.cursor(b.dataset.cm, cmPos); });
  document.addEventListener('pointerdown', (e) => { if (!cm.hidden && !e.target.closest('#cmenu')) cm.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cm.hidden = true; menuEl.hidden = true; } });

  /* ---- 이스터에그: 버전 5번 ---- */
  let taps = 0, tapT = 0;
  const eggTap = () => { const n = performance.now(); taps = n - tapT < 1500 ? taps + 1 : 1; tapT = n; if (taps >= 5) { taps = 0; openEgg(); } };
  function openEgg() { $('#eggBody').innerHTML = `${window.EGG_IMG ? `<img class="egg-img" src="${window.EGG_IMG}" alt="선교에서 바라본 석양">` : ''}<p>${esc(t('eggMsg'))}</p>`; $('#eggDlg').showModal(); }
  $('#verTop').addEventListener('click', eggTap); $('#verFoot').addEventListener('click', eggTap);

  applyLang(); applyTheme();

  /* ---- 값 갱신 ---- */
  const f1 = (v, d = 1) => (v == null || !isFinite(v) ? '-' : v.toFixed(d));
  const deg = (v) => { if (v == null || !isFinite(v)) return '-'; let x = Math.round((((v % 360) + 360) % 360) * 10) / 10; if (x >= 360) x = 0; return x.toFixed(1).padStart(5, '0') + '°'; };
  const ll = (v, ns) => { if (v == null) return '-'; const a = Math.abs(v), dd = Math.floor(a), mm = (a - dd) * 60; return `${String(dd).padStart(ns ? 2 : 3, '0')}°${mm.toFixed(3).padStart(6, '0')}′${v >= 0 ? (ns ? 'N' : 'E') : ns ? 'S' : 'W'}`; };
  const setCtl = (id, val, auto, label) => { const el = $(id); el.querySelector('i').style.width = val + '%'; el.querySelector('.md').textContent = label ?? (auto ? 'AUTO' : Math.round(val)); el.classList.toggle('auto', !!auto); };
  function refresh(d) {
    $('#vRange').textContent = d.rangeNM < 1 ? d.rangeNM.toString().replace(/^0/, '') : d.rangeNM;
    $('#vRing').textContent = '/' + d.ringInt + ' NM';
    $('#vOrient').textContent = d.orient;
    $('#vMotion').textContent = d.motion; $('#vBand').textContent = S.ctrl.band + '-BAND'; $('#vPulse').textContent = S.ctrl.pulse;
    const tx = $('#bxTx'); tx.classList.toggle('on', d.tx === 'tx'); tx.classList.toggle('warm', d.tx === 'warm');
    $('#vTx').textContent = d.tx === 'tx' ? 'TX' : d.tx === 'warm' ? `${t('warm')} ${Math.ceil(d.warmLeft)}s` : 'STBY';
    setCtl('#bxGain', S.ctrl.gain, false); setCtl('#bxSea', S.ctrl.sea.val, S.ctrl.sea.auto, S.ctrl.sea.auto ? 'AUTO' : null);
    setCtl('#bxRain', S.ctrl.rain.val, S.ctrl.rain.auto, S.ctrl.rain.auto ? 'AUTO' : null); setCtl('#bxTune', S.ctrl.tune.auto ? 50 : S.ctrl.tune.val, S.ctrl.tune.auto, S.ctrl.tune.auto ? 'AUTO' : null);
    $('#vPreset').textContent = `${S.ctrl.preset} · IR ${S.ctrl.ir} · ES ${S.ctrl.es} · EAV ${S.ctrl.eav}${S.ctrl.ace ? ' · ACE' : ''}`;
    const c = d.cursor; $('#bxCursor').innerHTML = c ? `${deg(c.brg)} ${c.rel ? 'R' : 'T'}  ${f1(c.rng, 3)} NM<br>${ll(c.lat, true)}<br>${ll(c.lon, false)}${c.ttg != null ? `<br>TTG ${f1(c.ttg, 1)} min` : ''}` : `<span class="lb">${esc(t('cursor'))}</span>`;
    const eb = (i) => (d.ebl[i].on ? deg(d.ebl[i].brg) : 'OFF'), vr = (i) => (d.vrm[i].on ? f1(d.vrm[i].rng, 3) + ' ' + S.disp.vrmUnit : 'OFF');
    $('#vEbl1').textContent = eb(0); $('#vEbl2').textContent = eb(1); $('#vEblRef').textContent = S.disp.eblRef === 'REL' ? 'R' : 'T';
    $('#vVrm1').textContent = vr(0); $('#vVrm2').textContent = vr(1); $('#vTtg1').textContent = d.vrm[0].ttg != null ? f1(d.vrm[0].ttg, 1) + "'" : ''; $('#vTtg2').textContent = d.vrm[1].ttg != null ? f1(d.vrm[1].ttg, 1) + "'" : '';
    root.querySelectorAll('[data-act="ebl1"],[data-act="ebl2"],[data-act="vrm1"],[data-act="vrm2"]').forEach((b) => { const k = b.dataset.act, i = +k.slice(-1) - 1; b.classList.toggle('on', (k.startsWith('ebl') ? d.ebl : d.vrm)[i].on); });
    // 빠른 막대 상태
    $('#qv_mode').textContent = d.orient; $('#qv_motion').textContent = d.motion; $('#qv_speed').textContent = '×' + d.speed; $('#qv_pal').textContent = t('pal_' + S.disp.palette);
    $('#qv_tx').textContent = d.tx === 'tx' ? 'TX' : d.tx === 'warm' ? '…' : 'STBY'; $('#qv_preset').textContent = S.ctrl.preset.replace('CUSTOM', 'C');
    $('#qv_trail').textContent = S.disp.trails.time ? (S.disp.trails.mode === 'TRUE' ? 'T ' : 'R ') + Math.round(S.disp.trails.time / 60) + "'" : 'OFF';
    $('#qb_tx').classList.toggle('on', d.tx !== 'stby'); $('#qb_off').classList.toggle('on', !!d.offCenter); $('#qb_pi').classList.toggle('on', !!d.piOn); $('#qb_az').classList.toggle('on', !!d.azOn);
    $('#qb_pause').classList.toggle('on', !!d.paused); $('#qb_conn').classList.toggle('on', !!d.connOn); $('#qb_trail').classList.toggle('on', S.disp.trails.time > 0);
    // 자선
    const o = d.own; if (o) {
      $('#vHdg').textContent = deg(o.hdg); $('#vStw').textContent = f1(o.stw) + ' kn'; $('#vSog').textContent = f1(o.sog) + ' kn'; $('#vCog').textContent = deg(o.cog);
      $('#vRot').textContent = f1(o.rot) + ' °/min'; $('#vPos').innerHTML = `${ll(o.lat, true)}<br>${ll(o.lon, false)}`;
    }
    $('#vClock').textContent = d.clock || ''; $('#vEl').textContent = d.elapsed || '-';
    // 물표 2칸
    $('#tSlots').innerHTML = [0, 1].map((i) => { const g = d.tgt && d.tgt[i]; if (!g) return `<div class="tslot"><span class="empty">${i === 0 ? esc(t('noTgt')) : ''}</span></div>`;
      return `<div class="tslot${g.danger ? ' danger' : ''}"><div class="nm">${esc(g.label)}</div><dl class="kv"><dt>BRG</dt><dd>${deg(g.brg)}</dd><dt>RNG</dt><dd>${f1(g.rng, 2)}</dd><dt>COG</dt><dd>${deg(g.cog)}</dd><dt>SOG</dt><dd>${f1(g.sog)}</dd><dt>CPA</dt><dd>${f1(g.cpa, 2)}</dd><dt>TCPA</dt><dd>${g.tcpa == null ? '-' : g.tcpa < 0 ? '--' : f1(g.tcpa, 1)}</dd><dt>BCR</dt><dd>${g.bcr == null ? '-' : f1(g.bcr, 2)}</dd><dt>BCT</dt><dd>${g.bct == null ? '-' : f1(g.bct, 1)}</dd></dl></div>`; }).join('');
    $('#vCounts').textContent = `TT ${d.ttN ?? 0} · AIS ${d.aisN ?? 0}`;
    $('#vTT').innerHTML = `<dt>${esc(t('vector'))}</dt><dd>${S.tt.vector} ${S.tt.vecMin} min</dd><dt>${esc(t('cpaLim'))}</dt><dd>${S.tt.cpaOn ? `${S.tt.cpa.toFixed(1)} NM / ${S.tt.tcpa} min` : 'OFF'}</dd><dt>${esc(t('past'))}</dt><dd>${S.tt.pastPts} × ${S.tt.pastInt}s</dd><dt>${esc(t('aisFilt'))}</dt><dd>${S.ais.maxRngOn ? S.ais.maxRng + ' NM' : '-'} ${S.ais.minSpdOn ? '≥' + S.ais.minSpd + ' kn' : ''}</dd>`;
    const a = d.alertTop; $('#vAlN').textContent = d.alertN ? d.alertN : '';
    $('#aBox').innerHTML = a ? `<div class="abox ${a.pri}${a.acked ? '' : ' unack'}"><span class="ic">${a.pri === 'A' ? '!' : a.pri}</span><span class="tx"><b>${esc(a.text)}</b><span>${a.active ? '' : (lang() === 'en' ? 'rectified · ' : '해소됨 · ')}${esc(a.time || '')}</span></span><span style="display:flex;gap:4px">${a.pri !== 'C' && !a.acked ? `<button class="btn" type="button" data-act="ack">${esc(t('ack'))}</button>` : ''}<button class="btn ib" type="button" data-act="silence" title="${esc(t('silence'))}" aria-label="${esc(t('silence'))}">${ICON.mute}</button><button class="btn" type="button" data-act="alertList">${esc(t('list'))}</button></span></div>` : `<span class="empty">${esc(t('noAlert'))}</span>`;
    const chip = $('#scnChip'); chip.hidden = !d.scnName; chip.textContent = d.scnName || '';
  }
  function dialog(title, html, foot = '') { $('#genT').textContent = title; $('#genB').innerHTML = html; $('#genF').innerHTML = foot; const g = $('#genDlg'); if (!g.open) g.showModal(); return g; }
  return { refresh, applyLang, applyTheme, renderMenu, dialog, closeAll() { menuEl.hidden = true; cm.hidden = true; }, echoCanvas: $('#cvEcho'), overCanvas: $('#cvOver') };
}
