/* Conning 팝업: 끌어서 이동, ▁ 숨기기(작은 탭으로 접힘). 교재 6-1 ODD·조타·텔레그래프 구성 */
import { S, saveSettings } from './state.js';
import { TELEGRAPH, setRudderOrder, setTelegraph, setAuto } from './sim.js';
import { t } from './i18n.js';

const TELE_AB = { FA: 'F.Ahead', HA: 'H.Ahead', SA: 'S.Ahead', DSA: 'D.S.Ahead', STOP: 'STOP', DSAH: 'D.S.Astern', SAH: 'S.Astern', HAH: 'H.Astern', FAH: 'F.Astern' };
const TELE_KO = { FAH: 'Full astern', HAH: 'Half astern', SAH: 'Slow astern', DSAH: 'Dead slow astern', STOP: 'Stop', DSA: 'Dead slow ahead', SA: 'Slow ahead', HA: 'Half ahead', FA: 'Full ahead' };
const CMD = [['P25', -25], ['P20', -20], ['P15', -15], ['P10', -10], ['P5', -5], ['MID', 0], ['S5', 5], ['S10', 10], ['S15', 15], ['S20', 20], ['S25', 25]]; // 6열: 좌현 줄(+MID) / 우현 줄
const f = (v, d = 1) => (v == null || !isFinite(v) ? '-' : v.toFixed(d));
const hd = (v) => { let x = Math.round((((v % 360) + 360) % 360) * 10) / 10; if (x >= 360) x = 0; return x.toFixed(1).padStart(5, '0') + '°'; };

export function initConning(root, getShip, extra = {}) {
  const el = document.createElement('section'); el.id = 'conn'; el.className = 'conn'; el.setAttribute('aria-label', 'Conning');
  el.innerHTML = `<div class="con-h"><b>CONNING</b><span class="lb" id="cnMode"></span><span style="margin-left:auto;display:flex;gap:4px"><button type="button" class="cbtn" data-act="connHide" aria-label="접기" title="접기" data-al-en="Collapse"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17h14"/></svg></button></span></div>
<div class="con-b">
  <div class="cn-top"><div><span class="lb">HDG</span><b class="num big" id="cnHdg"></b></div><div><span class="lb">ROT °/min</span><b class="num" id="cnRot"></b><span class="rotbar"><i id="cnRotI"></i></span></div></div>
  <div class="cn-row"><span class="lb">RUDDER</span><span class="rud"><span class="rz"></span><i id="cnRudA"></i><i class="ord" id="cnRudO"></i></span><span class="num" id="cnRud"></span></div>
  <div class="cmds">${CMD.map(([k, v]) => `<button type="button" data-rud="${v}" class="${v < 0 ? 'p' : v > 0 ? 's' : 'm'}">${k}</button>`).join('')}</div><div class="cmds2"><button type="button" data-rud="-35" class="p">HARD P</button><button type="button" data-steady="1">STEADY</button><button type="button" data-rud="35" class="s">HARD S</button></div>
  <div class="cn-split">
    <div class="tele">${TELEGRAPH.map((x, i) => `<button type="button" data-tele="${i}" title="${TELE_KO[x.k]}"><span>${TELE_AB[x.k] || x.k}</span><span class="num">${x.kn > 0 ? '+' : ''}${x.kn}</span></button>`).reverse().join('')}</div>
    <div class="cn-data"><dl class="kv"><dt>RPM</dt><dd id="cnRpm"></dd><dt>STW</dt><dd id="cnStw"></dd><dt>SOG</dt><dd id="cnSog"></dd><dt>COG</dt><dd id="cnCog"></dd><dt>WIND</dt><dd id="cnWind"></dd></dl>
      <div class="ap"><div class="seg"><button type="button" data-ap="0">HAND</button><button type="button" data-ap="1">AUTO</button></div>
      <div class="sethd"><span class="lb">SET HDG</span><button type="button" data-sh="-10">−10</button><button type="button" data-sh="-1">−1</button><b class="num" id="cnSet"></b><button type="button" data-sh="1">+1</button><button type="button" data-sh="10">+10</button></div></div>
    </div>
  </div>
</div>`;
  const tab = document.createElement('button'); tab.id = 'connTab'; tab.type = 'button'; tab.className = 'conn-tab'; tab.textContent = 'CONNING'; tab.title = '펼치기'; tab.setAttribute('aria-label', 'CONNING 펼치기'); tab.dataset.alEn = 'Expand CONNING'; tab.hidden = true;
  root.append(el, tab);
  const st = { get hidden() { return S.ui.conning.hidden; }, set hidden(v) { S.ui.conning.hidden = v; } }; // 설정 불러오기·초기화로 S.ui가 새 객체가 돼도 따라감
  /* 오른쪽 패널에 고정. 접으면 'CONNING' 줄만 남음(키보드 조종은 계속) */
  const show = (on) => { st.hidden = !on; el.hidden = !on; tab.hidden = on; if (on) refresh(); saveSettings(); };
  el.hidden = st.hidden; tab.hidden = !st.hidden;
  tab.addEventListener('click', () => show(true));
  el.addEventListener('click', (e) => {
    const s = getShip(); if (!s) return; const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'connHide') return show(false);
    if (b.dataset.rud !== undefined) { setAuto(s, false); setRudderOrder(s, +b.dataset.rud); }
    else if (b.dataset.steady) { setAuto(s, true, s.hdg); }
    else if (b.dataset.tele !== undefined) setTelegraph(s, +b.dataset.tele);
    else if (b.dataset.ap !== undefined) setAuto(s, b.dataset.ap === '1', s.hdg);
    else if (b.dataset.sh !== undefined) setAuto(s, true, s.auto.setHdg + +b.dataset.sh);
    refresh();
  });
  function refresh() {
    const s = getShip(); if (!s || el.hidden) return;
    el.querySelector('#cnHdg').textContent = hd(s.hdg); el.querySelector('#cnRot').textContent = f(s.rot);
    const ri = el.querySelector('#cnRotI'), rr = Math.max(-1, Math.min(1, s.rot / 60)); ri.style.left = rr < 0 ? 50 + rr * 50 + '%' : '50%'; ri.style.width = Math.abs(rr) * 50 + '%';
    const pos = (d) => 50 + (d / 35) * 50 + '%'; el.querySelector('#cnRudA').style.left = pos(s.rudder); el.querySelector('#cnRudO').style.left = pos(s.rudderOrder);
    el.querySelector('#cnRud').textContent = (s.rudder < -0.05 ? 'P ' : s.rudder > 0.05 ? 'S ' : '') + f(Math.abs(s.rudder)) + '°';
    for (const b of el.querySelectorAll('[data-tele]')) b.classList.toggle('on', +b.dataset.tele === s.tele);
    el.querySelector('#cnRpm').textContent = f(s.rpm, 0); el.querySelector('#cnStw').textContent = f(s.stw) + ' kn'; el.querySelector('#cnSog').textContent = f(s.sog) + ' kn'; el.querySelector('#cnCog').textContent = hd(s.cog);
    const w = extra.wind ? extra.wind() : null; el.querySelector('#cnWind').textContent = w ? `${Math.round(w.dir).toString().padStart(3, '0')}° ${f(w.ms, 0)}m/s` : '-';
    for (const b of el.querySelectorAll('[data-ap]')) b.classList.toggle('on', (b.dataset.ap === '1') === s.auto.on);
    el.querySelector('#cnSet').textContent = s.auto.on ? hd(s.auto.setHdg) : '---.-°'; el.querySelector('#cnMode').textContent = s.auto.on ? 'AUTO' : 'HAND';
  }
  return { el, refresh, sync() { el.hidden = st.hidden; tab.hidden = !st.hidden; if (!st.hidden) refresh(); }, toggle() { show(el.hidden); }, get shown() { return !el.hidden; } };
}
