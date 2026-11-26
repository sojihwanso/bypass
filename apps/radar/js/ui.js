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
  mark: P('<path d="M12 3v18M12 3l7 4-7 4"/>'),
  wx: P('<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/>'),
  pal: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  conn: P('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v8M12 14v8M2 12h8M14 12h8"/>'),
  shot: P('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l2-3h4l2 3"/><circle cx="12" cy="13.5" r="3.5"/>'),
  scn: P('<path d="M5 21V4h12l-2.5 4L17 12H5"/>'),
  help: P('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6v.4"/><circle cx="12" cy="17" r=".6"/>'),
  fs: P('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  tune: P('<path d="M3 15c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/><path d="M12 3v4"/>'),
  pulse: P('<path d="M3 17h4V7h4v10h10"/>'),
  ir: P('<path d="M4 12h2M8 12h2M12 12h2M16 12h2M20 12h1"/><path d="M5 6l14 12"/>'),
  es: P('<path d="M4 12h16"/><path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>'),
  eav: P('<path d="M4 16c3-8 5-8 8 0s5 8 8 0" opacity=".45"/><path d="M4 12h16"/>'),
  ace: P('<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>'),
  hl: P('<path d="M12 3v18" stroke-dasharray="3 3"/><path d="M4 4l16 16"/>'),
  map: P('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  cureset: P('<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>'),
  ownais: P('<path d="M12 3l6 16-6-4-6 4z"/>'),
  aismsg: P('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  mute: P('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/>'),
  panel: P('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'),
};
/* 왼쪽 막대: 매뉴얼 1.4.1의 순서(위: 송신·튜닝·펄스·IR·ES·EAV·ACE / 아래: HL·MAP·CU/TM 리셋·자선 AIS·AIS 메시지·밝기).
   실제와 똑같지 않게 두 쌍만 한 칸씩 바꿈: 펄스↔튜닝, MAP↔HL. 그 아래는 시뮬레이터 전용 묶음 */
const QB_TOP = [['tx', 'q_tx'], ['tune', 'q_tune'], ['pulse', 'q_pulse'], ['ir', 'q_ir'], ['es', 'q_es'], ['eav', 'q_eav'], ['ace', 'q_ace']];
/* 아래 묶음: 실제(MAP·HL·CU/TM 리셋·자선 AIS·AIS·밝기·MARK)에서 MAP↔HL, CU/TM 리셋↔자선 AIS를 바꿈 */
const QB_BOT = [['hl', 'q_hl'], ['map', 'q_map'], ['ownais', 'q_ownais'], ['cureset', 'q_cureset'], ['aismsg', 'q_aismsg'], ['pal', 'q_pal'], ['mark', 'q_mark']];
const qbBtn = ([k, l]) => `<button type="button" class="qb" data-act="${k}" id="qb_${k}">${ICON[k]}<span data-t="${l}"></span><span class="qv" id="qv_${k}"></span></button>`;
/* 실제 레이더에 없는 시뮬레이터 전용 단추는 헤더에 */
/* 약자는 풀어 쓰고, 전체 이름은 title로 */
const ABBR = { HU: ['H.Up', 'Head Up'], NU: ['N.Up', 'North Up'], CU: ['C.Up', 'Course Up'], RM: ['R.Motion', 'Relative Motion'], TM: ['T.Motion', 'True Motion'] };
const HB = [['scn', 'q_scn'], ['pause', 'q_pause'], ['speed', 'q_speed'], ['wx', 'q_wx'], ['conn', 'q_conn'], ['shot', 'q_shot']];

export function initUI(root, actions) {
  root.innerHTML = `
<header class="top">
  <div class="brand"><b data-t="brand"></b><span data-t="sub"></span></div>
  <span class="scn-chip" id="scnChip" hidden></span>
  <div class="simbar" role="group" aria-label="시뮬레이터">${HB.map(([k, l]) => `<button type="button" class="hb" data-act="${k}" id="hb_${k}">${ICON[k]}<span data-t="${l}"></span><span class="qv" id="hv_${k}"></span></button>`).join('')}</div>
  <div class="htools">
    <button class="hbtn rp-toggle" type="button" data-act="rp" aria-label="정보창">${ICON.panel}</button>
    <button class="hbtn" type="button" id="hdrHelp" data-act="help" aria-label="도움말" title="도움말">${ICON.help}</button>
    <div class="seg2" role="group" aria-label="Language"><button type="button" data-act="lang" data-v="ko">한</button><button type="button" data-act="lang" data-v="en">EN</button></div>
    <button class="hbtn" type="button" data-act="fs" aria-label="전체 화면">${ICON.fs}</button>
    <button class="ver" type="button" id="verTop" aria-label="버전 ${VERSION}">v${VERSION}</button>
    <a class="bp-logo" id="bpLogo" href="https://teambypass.vercel.app/" title="Team Bypass" aria-label="Team Bypass 메인으로">${BP_LOGO}</a>
  </div>
</header>
<div class="main">
  <nav class="qbar" id="qbar" aria-label="빠른 조작"><div class="qgrp" id="qbTop">${QB_TOP.map(qbBtn).join('')}</div><div class="qsep"></div><div class="qgrp" id="qbBot">${QB_BOT.map(qbBtn).join('')}</div></nav>
  <section class="ppi-wrap" id="ppiWrap">
    <canvas id="cvEcho"></canvas><canvas id="cvOver" aria-label="레이더 화면"></canvas>
    <button type="button" class="stby-hint" id="stbyHint" data-act="tx"></button>
    <div class="tl">
      <div class="row2"><div class="bx" id="bxRange" data-wheel="range" style="position:static"><span class="lb">RANGE</span><span class="big" id="vRange">-</span><span class="lb" id="vRing"></span><span class="pm"><button type="button" data-act="rangeUp" aria-label="범위 늘리기">+</button><button type="button" data-act="rangeDn" aria-label="범위 줄이기">−</button></span></div>
      <div class="bx" id="bxRef" style="position:static"><span class="lb">REF POINT</span><button type="button" data-act="refpt" id="vRef">CCRP</button></div></div>
      <div class="bx" id="bxMode" style="position:static"><button type="button" data-act="mode" id="vOrient">HU</button><button type="button" data-act="motion" id="vMotion">RM</button><button type="button" data-act="band" id="vBand">X-BAND</button><button type="button" data-act="pulse" id="vPulse">M1</button></div>
      <div class="bx" id="bxPict" style="position:static;display:flex;gap:6px;align-items:center"><span class="lb">PICTURE</span><button type="button" data-act="preset" id="vPict">-</button><button type="button" data-act="off" id="vOff">OFF CENTER</button></div>
      <div class="bx" id="bxTx" style="position:static"><span class="dot"></span><span id="vTx">STBY</span></div>
    </div>
    <div class="bx" id="bxInd" style="top:12px;left:50%;transform:translateX(-50%)" hidden></div>
    <div class="tr"><div class="bx" id="bxWatch" style="position:static" hidden><span class="lb">WATCH</span> <span class="vv" id="vWatch"></span></div><div class="bx" id="bxEcho" style="position:static">
      <div class="ctl" id="bxGain" data-wheel="gain"><span class="lb">GAIN</span><span class="bar"><i></i></span><span class="md"></span></div>
      <div class="ctl" id="bxSea" data-wheel="sea" data-act="seaAuto"><span class="lb">SEA</span><span class="bar"><i></i></span><span class="md"></span></div>
      <div class="ctl" id="bxRain" data-wheel="rain" data-act="rainAuto"><span class="lb">RAIN</span><span class="bar"><i></i></span><span class="md"></span></div>
      <div class="ctl" id="bxTune" data-wheel="tune" data-act="tuneAuto"><span class="lb">TUNE</span><span class="bar"><i></i></span><span class="md"></span></div>
      <div class="lb" id="vPreset" style="margin-top:4px"></div>
    </div><div class="bx" id="bxCursor" style="position:static"></div><div class="bx" id="bxMenu" style="position:static;display:flex;gap:6px;justify-content:flex-end"><button type="button" data-act="menu" data-t="q_menu"></button></div></div>
    <div class="bx" id="bxPi" style="left:12px;bottom:92px;display:flex;gap:6px;align-items:center"><button type="button" data-act="pi" id="vPi">PI</button><span class="lb" id="vPiV"></span></div>
    <div class="bx" id="bxTgtTools" style="right:12px;bottom:92px;display:flex;gap:6px;align-items:center"><button type="button" data-act="trial" id="vTrial">TRIAL</button><button type="button" data-act="az" id="vAz">ACQ ZONE</button></div>
    <div class="bx bl" id="bxEbl"><div class="eb">
      <button type="button" class="tg" data-act="ebl1">EBL1</button><span class="vv" id="vEbl1" data-wheel="ebl1">-</span><button type="button" data-act="eblRef" id="vEblRef">T</button>
      <button type="button" class="tg" data-act="ebl2">EBL2</button><span class="vv" id="vEbl2" data-wheel="ebl2">-</span><span></span></div></div>
    <div class="bx br" id="bxVrm"><div class="eb">
      <button type="button" class="tg" data-act="vrm1">VRM1</button><span class="vv" id="vVrm1" data-wheel="vrm1">-</span><span class="lb" id="vTtg1"></span>
      <button type="button" class="tg" data-act="vrm2">VRM2</button><span class="vv" id="vVrm2" data-wheel="vrm2">-</span><span class="lb" id="vTtg2"></span></div></div>
    <div class="side side-l" id="sideL"></div><div class="side side-r" id="sideR"></div>
    <button class="ver-foot" type="button" id="verFoot" aria-label="버전 ${VERSION}">v${VERSION}</button>
  </section>
  <aside class="rp" id="rp">
    <div class="sec" id="pnOwn"><h3><span data-t="own"></span><span class="num" id="vClock"></span></h3>
      <dl class="kv"><dt>HDG</dt><dd class="big" id="vHdg">-</dd><dt>STW</dt><dd id="vStw">-</dd><dt>SOG</dt><dd id="vSog">-</dd><dt>COG</dt><dd id="vCog">-</dd><dt>ROT</dt><dd id="vRot">-</dd><dt data-t="posn"></dt><dd id="vPos">-</dd><dt data-t="elapsed"></dt><dd id="vEl">-</dd></dl></div>
    <div class="sec" id="pnTgt"><h3><span data-t="tgt"></span></h3><div class="tslots" id="tSlots"></div></div>
    <div class="sec" id="pnTT"><h3><span data-t="ttais"></span><span class="num" id="vCounts"></span></h3><dl class="kv" id="vTT"></dl><div class="ttbtns"><button class="btn" type="button" data-act="tgtList" id="vTgtList" data-t="tgtList"></button><button class="btn" type="button" data-act="vecMode" id="vVec">VECTOR</button><button class="btn" type="button" data-act="trail" id="vTrail">TRAIL</button></div></div>
    <div class="sec" id="pnAlert"><h3><span data-t="alert"></span><span class="num" id="vAlN"></span></h3><div id="aBox"></div></div>
    <div id="connSlot"></div>
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
    $('#hdrHelp').setAttribute('aria-label', t('help')); $('#hdrHelp').title = t('help');
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
    tune: () => { S.ctrl.tune.auto = !S.ctrl.tune.auto; emit('settings', 'ctrl.tune'); },
    ir: () => { S.ctrl.ir = (S.ctrl.ir + 1) % 4; emit('settings', 'ctrl.ir'); }, es: () => { S.ctrl.es = (S.ctrl.es + 1) % 4; emit('settings', 'ctrl.es'); },
    eav: () => { S.ctrl.eav = (S.ctrl.eav + 1) % 4; emit('settings', 'ctrl.eav'); }, ace: () => { S.ctrl.ace = !S.ctrl.ace; emit('settings', 'ctrl.ace'); },
    map: () => { S.disp.map.on = !S.disp.map.on; emit('settings', 'disp.map'); }, hl: () => {},
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

  /* HL OFF: 누르고 있는 동안 선수선 숨김 */
  const hlb = $('#qb_hl');
  hlb.addEventListener('pointerdown', () => actions.hlHold && actions.hlHold(true));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) hlb.addEventListener(ev, () => actions.hlHold && actions.hlHold(false));
  /* ---- 커서 메뉴(오른쪽 클릭 / 길게 누르기) ---- */
  const cm = $('#cmenu'), over = $('#cvOver');
  const CM = [['acq', 'cm_acq'], ['cancel', 'cm_cancel'], ['data', 'cm_data'], ['act', 'cm_act'], ['ref', 'cm_ref'], ['-'], ['ebl', 'cm_ebl'], ['vrm', 'cm_vrm'], ['offEbl', 'cm_offEbl'], ['ruler', 'cm_ruler'], ['-'], ['off', 'cm_off'], ['center', 'cm_center'], ['drop', 'cm_drop'], ['markDel', 'cm_markDel'], ['anchor', 'cm_anchor']];
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

  /* 배치: 물표 정보·TT·AIS 설정은 PPI 원 오른쪽 빈 공간(넉넉하면), 아니면 오른쪽 패널. 패널 순서: 자선 → 도움말 → Conning → 경보 */
  const SIDE_MIN = 140, main = root.querySelector('.main'), rp = $('#rp'), wrap = $('#ppiWrap');
  rp.insertBefore($('#connSlot'), $('#pnAlert'));
  let mode = null;
  let shift = 0;
  const qbar = $('#qbar'), QB_W = 72, QIN_R = 84, LBL = 36;
  let qIn = false, rmax = Infinity;
  function relayout() {
    /* 단추줄: PPI 영역 높이 560px 이상이면 PPI 영역 왼쪽 가장자리 세로줄(위 묶음 위, 아래 묶음 아래 — 실제 화면 배치)로 넣고, 760px 미만이면 작게.
       원은 단추줄·오른쪽 칸 사이(최대 15%까지 줄임). 아니면 왼쪽 막대. 오른쪽 칸 폭 = 150~300px */
    const r = wrap.getBoundingClientRect(), h = r.height, wIn = r.width + (qIn ? 0 : QB_W), full = h / 2 - LBL;
    const RIn = Math.min(full, (wIn - QIN_R - 170) / 2 - LBL), wantIn = r.width > 0 && h >= 560 && RIn >= 0.85 * full;
    if (wantIn !== qIn) { qIn = wantIn; document.documentElement.dataset.qb = qIn ? 'in' : 'out'; if (qIn) wrap.append(qbar); else main.prepend(qbar); }
    wrap.classList.toggle('compact', qIn && h < 760);
    let colW, next;
    if (qIn) {
      const cx = Math.min(Math.max(wIn / 2, QIN_R + LBL + RIn), wIn - 170 - LBL - RIn);
      colW = Math.min(300, wIn - 12 - (cx + RIn + LBL) - 8); shift = wIn / 2 - cx; rmax = RIn; next = 'rside';
    } else {
      const w = r.width, dia = Math.min(w, h) - 72, g = (w - dia) / 2; rmax = Infinity;
      colW = Math.min(300, Math.max(150, g - 46)); shift = Math.max(0, colW + 46 - g);
      next = r.width > 0 && g - shift >= 40 ? 'rside' : 'bar'; if (next === 'bar') shift = 0;
    }
    if (next !== mode) {
      mode = next; document.documentElement.dataset.layout = mode;
      if (mode === 'rside') $('#sideR').append($('#pnTgt'), $('#pnTT'));
      else rp.append($('#pnTgt'), $('#pnTT'));
    }
    if (mode === 'rside') wrap.style.setProperty('--sidew', colW + 'px');
    return mode;
  }
  relayout();

  /* ---- 값 갱신 ---- */
  const f1 = (v, d = 1) => (v == null || !isFinite(v) ? '-' : v.toFixed(d));
  const deg = (v) => { if (v == null || !isFinite(v)) return '-'; let x = Math.round((((v % 360) + 360) % 360) * 10) / 10; if (x >= 360) x = 0; return x.toFixed(1).padStart(5, '0') + '°'; };
  const ll = (v, ns) => { if (v == null) return '-'; const a = Math.abs(v), dd = Math.floor(a), mm = (a - dd) * 60; return `${String(dd).padStart(ns ? 2 : 3, '0')}°${mm.toFixed(3).padStart(6, '0')}′${v >= 0 ? (ns ? 'N' : 'E') : ns ? 'S' : 'W'}`; };
  const setCtl = (id, val, auto, label) => { const el = $(id); el.querySelector('i').style.width = val + '%'; el.querySelector('.md').textContent = label ?? (auto ? 'AUTO' : Math.round(val)); el.classList.toggle('auto', !!auto); };
  function refresh(d) {
    $('#vRange').textContent = d.rangeNM < 1 ? d.rangeNM.toString().replace(/^0/, '') : d.rangeNM;
    $('#vRing').textContent = '/' + d.ringInt + ' NM';
    $('#vOrient').textContent = ABBR[d.orient][0]; $('#vOrient').title = ABBR[d.orient][1];
    $('#vMotion').textContent = ABBR[d.motion][0]; $('#vMotion').title = ABBR[d.motion][1]; $('#vBand').textContent = S.ctrl.band + '-BAND'; $('#vBand').title = lang() === 'en' ? (S.ctrl.band === 'X' ? 'X-band (3 cm): fine resolution, SART responds · click for S-band' : 'S-band (10 cm): less rain/sea clutter, wider beam, no SART · click for X-band') : (S.ctrl.band === 'X' ? 'X 밴드(3 cm): 분해능 좋음, SART 응답 · 누르면 S 밴드' : 'S 밴드(10 cm): 비·해면 반사에 강함, 빔이 넓음, SART 없음 · 누르면 X 밴드'); $('#vPulse').textContent = S.ctrl.pulse;
    const tx = $('#bxTx'); tx.classList.toggle('on', d.tx === 'tx'); tx.classList.toggle('warm', d.tx === 'warm');
    $('#vTx').textContent = d.tx === 'tx' ? 'TX' : d.tx === 'warm' ? `${t('warm')} ${Math.ceil(d.warmLeft)}s` : 'STBY';
    const hint = $('#stbyHint'); hint.hidden = d.tx === 'tx';
    hint.textContent = d.tx === 'warm' ? (lang() === 'en' ? `Warming up… ${Math.ceil(d.warmLeft)} s` : `예열 중… ${Math.ceil(d.warmLeft)}초 뒤 영상이 나와요`) : (lang() === 'en' ? 'STBY — click here or the TX button to transmit' : 'STBY(대기) — 여기나 왼쪽 [송신] 단추를 누르면 5초 예열 뒤 영상이 나와요');
    setCtl('#bxGain', S.ctrl.gain, false); setCtl('#bxSea', S.ctrl.sea.val, S.ctrl.sea.auto, S.ctrl.sea.auto ? 'AUTO' : null);
    setCtl('#bxRain', S.ctrl.rain.val, S.ctrl.rain.auto, S.ctrl.rain.auto ? 'AUTO' : null); setCtl('#bxTune', S.ctrl.tune.auto ? 50 : S.ctrl.tune.val, S.ctrl.tune.auto, S.ctrl.tune.auto ? 'AUTO' : null);
    $('#vPreset').textContent = `${S.ctrl.preset} · IR ${S.ctrl.ir} · ES ${S.ctrl.es} · EAV ${S.ctrl.eav}${S.ctrl.ace ? ' · ACE' : ''}`;
    const c = d.cursor; $('#bxCursor').innerHTML = c ? `${deg(c.brg)} ${c.rel ? 'R' : 'T'}  ${f1(c.rng, 3)} NM<br>${ll(c.lat, true)}<br>${ll(c.lon, false)}${c.ttg != null ? `<br>TTG ${f1(c.ttg, 1)} min` : ''}` : `<span class="lb">${esc(t('cursor'))}</span>`;
    const eb = (i) => (d.ebl[i].on ? deg(d.ebl[i].brg) : 'OFF'), vr = (i) => (d.vrm[i].on ? f1(d.vrm[i].rng, 3) + ' ' + S.disp.vrmUnit : 'OFF');
    $('#vEbl1').textContent = eb(0); $('#vEbl2').textContent = eb(1); $('#vEblRef').textContent = S.disp.eblRef === 'REL' ? 'R' : 'T';
    $('#vVrm1').textContent = vr(0); $('#vVrm2').textContent = vr(1); $('#vTtg1').textContent = d.vrm[0].ttg != null ? f1(d.vrm[0].ttg, 1) + "'" : ''; $('#vTtg2').textContent = d.vrm[1].ttg != null ? f1(d.vrm[1].ttg, 1) + "'" : '';
    root.querySelectorAll('[data-act="ebl1"],[data-act="ebl2"],[data-act="vrm1"],[data-act="vrm2"]').forEach((b) => { const k = b.dataset.act, i = +k.slice(-1) - 1; b.classList.toggle('on', (k.startsWith('ebl') ? d.ebl : d.vrm)[i].on); });
    // 빠른 막대 상태
    const qv = (k, v, on) => { $('#qv_' + k).textContent = v; if (on !== undefined) $('#qb_' + k).classList.toggle('on', !!on); };
    qv('tx', d.tx === 'tx' ? 'TX' : d.tx === 'warm' ? 'WARM' : 'STBY', d.tx !== 'stby'); qv('tune', S.ctrl.tune.auto ? 'AUTO' : 'MAN', S.ctrl.tune.auto); qv('pulse', S.ctrl.pulse);
    qv('ir', S.ctrl.ir ? String(S.ctrl.ir) : 'OFF', S.ctrl.ir > 0); qv('es', S.ctrl.es ? String(S.ctrl.es) : 'OFF', S.ctrl.es > 0); qv('eav', S.ctrl.eav ? String(S.ctrl.eav) : 'OFF', S.ctrl.eav > 0); qv('ace', S.ctrl.ace ? 'ON' : 'OFF', S.ctrl.ace);
    qv('hl', 'OFF'); qv('map', S.disp.map.on ? 'ON' : 'OFF', S.disp.map.on); qv('cureset', d.orient === 'CU' || d.motion === 'TM' ? 'RESET' : '-'); qv('ownais', ''); qv('aismsg', d.msgN ? String(d.msgN) : '');
    qv('pal', t('pal_' + S.disp.palette)); if (d.mark) qv('mark', d.mark.sym, d.mark.on); $('#qb_pal').title = lang() === 'en' ? 'Brilliance · long-press: colour set' : '밝기 · 길게 누르면 색 조합';
    if (d.wx) { $('#hv_wx').textContent = d.wx.on ? d.wx.label : (lang() === 'en' ? 'OFF' : '꺼짐'); $('#hb_wx').classList.toggle('on', d.wx.on); $('#hb_wx').title = lang() === 'en' ? 'Weather changes on/off' : '날씨 변화 켜기/끄기'; }
    $('#hv_speed').textContent = '×' + d.speed; $('#hb_pause').classList.toggle('on', !!d.paused); $('#hb_conn').classList.toggle('on', !!d.connOn); $('#hb_speed').classList.toggle('on', d.speed > 1);
    $('#vPict').textContent = S.ctrl.preset; $('#vOff').classList.toggle('on', !!d.offCenter); $('#vRef').textContent = d.ref || 'CCRP';
    $('#vPi').classList.toggle('on', !!d.piOn); $('#vPiV').textContent = d.piOn ? d.piText || '' : ''; $('#vAz').classList.toggle('on', !!d.azOn); $('#vTrial').classList.toggle('on', S.tt.trialMode !== 'OFF');
    $('#vVec').textContent = 'VECTOR ' + S.tt.vector; $('#vTrail').textContent = 'TRAIL ' + (S.disp.trails.time ? (S.disp.trails.mode === 'TRUE' ? 'T ' : 'R ') + Math.round(S.disp.trails.time / 60) + "'" : 'OFF');
    const ind = [S.ctrl.sart ? 'SART' : '', d.paused ? (lang() === 'en' ? 'PAUSED' : '일시정지') : '', d.speed > 1 ? 'SIM ×' + d.speed : ''].filter(Boolean); $('#bxInd').hidden = !ind.length; $('#bxInd').textContent = ind.join('  ·  ');
    $('#bxWatch').hidden = !S.alert.watch; if (S.alert.watch) $('#vWatch').textContent = d.watchLeft || '';
    // 자선
    const o = d.own; if (o) {
      $('#vHdg').textContent = deg(o.hdg); $('#vStw').textContent = f1(o.stw) + ' kn'; $('#vSog').textContent = f1(o.sog) + ' kn'; $('#vCog').textContent = deg(o.cog);
      $('#vRot').textContent = f1(o.rot) + ' °/min'; $('#vPos').innerHTML = `${ll(o.lat, true)}<br>${ll(o.lon, false)}`;
    }
    $('#vClock').textContent = d.clock || ''; $('#vEl').textContent = d.elapsed || '-';
    // 물표 2칸
    $('#tSlots').innerHTML = [0, 1].map((i) => { const g = d.tgt && d.tgt[i]; if (!g) return `<div class="tslot${i ? ' blank' : ''}"><span class="empty">${i === 0 ? esc(t('noTgt')) : ''}</span></div>`;
      return `<div class="tslot${g.danger ? ' danger' : ''}"><div class="nm">${esc(g.label)}</div><dl class="kv"><dt>BRG</dt><dd>${deg(g.brg)}</dd><dt>RNG</dt><dd>${f1(g.rng, 2)}</dd><dt>COG</dt><dd>${deg(g.cog)}</dd><dt>SOG</dt><dd>${f1(g.sog)}</dd><dt>CPA</dt><dd>${f1(g.cpa, 2)}</dd><dt>TCPA</dt><dd>${g.tcpa == null ? '-' : g.tcpa < 0 ? '--' : f1(g.tcpa, 1)}</dd><dt>BCR</dt><dd>${g.bcr == null ? '-' : f1(g.bcr, 2)}</dd><dt>BCT</dt><dd>${g.bct == null ? '-' : f1(g.bct, 1)}</dd></dl></div>`; }).join('');
    $('#vCounts').textContent = `TT ${d.ttN ?? 0} · AIS ${d.aisN ?? 0}`;
    $('#vTT').innerHTML = `<dt>${esc(t('vector'))}</dt><dd>${S.tt.vector} ${S.tt.vecMin} min</dd><dt>${esc(t('cpaLim'))}</dt><dd>${S.tt.cpaOn ? `${S.tt.cpa.toFixed(1)} NM / ${S.tt.tcpa} min` : 'OFF'}</dd><dt>${esc(t('past'))}</dt><dd>${S.tt.pastPts} × ${S.tt.pastInt}s</dd><dt>${esc(t('aisFilt'))}</dt><dd>${S.ais.maxRngOn ? S.ais.maxRng + ' NM' : '-'} ${S.ais.minSpdOn ? '≥' + S.ais.minSpd + ' kn' : ''}</dd>`;
    const a = d.alertTop; $('#vAlN').textContent = d.alertN ? d.alertN : '';
    $('#aBox').innerHTML = a ? `<div class="abox ${a.pri}${a.acked ? '' : ' unack'}"><span class="ic">${a.pri === 'A' ? '!' : a.pri}</span><span class="tx"><b>${esc(a.text)}</b><span>${a.active ? '' : (lang() === 'en' ? 'rectified · ' : '해소됨 · ')}${esc(a.time || '')}</span></span><span style="display:flex;gap:4px">${a.pri !== 'C' && !a.acked ? `<button class="btn" type="button" data-act="ack">${esc(t('ack'))}</button>` : ''}<button class="btn ib" type="button" data-act="silence" title="${esc(t('silence'))}" aria-label="${esc(t('silence'))}">${ICON.mute}</button><button class="btn" type="button" data-act="alertList">${esc(t('list'))}</button></span></div>` : `<span class="empty">${esc(t('noAlert'))}</span>`;
    const chip = $('#scnChip'); chip.hidden = !d.scnName; chip.textContent = d.scnName || '';
  }
  function dialog(title, html, foot = '') { $('#genT').textContent = title; $('#genB').innerHTML = html; $('#genF').innerHTML = foot; const g = $('#genDlg'); if (!g.open) g.showModal(); return g; }
  /* 배속 고르기: 헤더 배속 단추 아래 작은 목록 */
  function speedPop(list, cur) {
    let pop = $('#spdPop'); if (pop) pop.remove(); if (!list) return;
    pop = document.createElement('div'); pop.id = 'spdPop'; pop.className = 'spd-pop'; pop.setAttribute('role', 'menu');
    pop.innerHTML = list.map((n) => `<button type="button" role="menuitemradio" aria-checked="${n === cur}" class="${n === cur ? 'on' : ''}" data-act="spd" data-spd="${n}">×${n}</button>`).join('');
    const r = $('#hb_speed').getBoundingClientRect(); pop.style.left = r.left + 'px'; pop.style.top = r.bottom + 4 + 'px'; root.append(pop);
    setTimeout(() => addEventListener('pointerdown', function off(e) { if (!e.target.closest('#spdPop,#hb_speed')) { pop.remove(); removeEventListener('pointerdown', off); } }), 0);
  }
  return { refresh, speedPop, applyLang, applyTheme, renderMenu, dialog, relayout, layoutMode: () => mode, qbInside: () => qIn, ABBR, shift: () => shift, rmax: () => rmax, closeAll() { menuEl.hidden = true; cm.hidden = true; }, echoCanvas: $('#cvEcho'), overCanvas: $('#cvOver') };
}
