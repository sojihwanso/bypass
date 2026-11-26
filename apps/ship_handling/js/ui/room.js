/* 학습실: 3D 무대 + 재생바 + 읽기 칸 + 본문 + 시험 칸 + 출처 */
import { CATEGORIES, UNITS, unitById, STAGE1 } from '../data/catalog.js';
import { isOpen } from '../router.js';
import { SCIENCE } from '../data/science.js';
import { roomHref } from '../router.js';
import { createStage } from '../engine/stage.js';
import { createShip, makeTug } from '../engine/ship.js';
import { createFlow } from '../engine/flow.js';
import { createPlayer, bindPlayerUI } from '../engine/player.js';
import { V3 } from '../engine/draw.js';
import { SH } from '../physics/ship.js';
import { lineChart, chartBegin } from './chart.js';
import { renderBlocks, renderExam, renderSources, mountModels } from './blocks.js';
import { openDialog, esc } from './chrome.js';
import { videoHTML, bindVideo } from './video.js';

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/></svg>'
};

export function openScience(part, sceneId) {
  const d = SCIENCE[part]; if (!d) return;
  const here = d.here && d.here[sceneId];
  openDialog(`<p class="kicker">${d.en}</p><h2 id="dlgTitle">${d.title}</h2>
    <div class="chips">${d.tags.map(([t, c]) => `<span class="c-${c}">${t}</span>`).join('')}</div>
    <div class="fx">${d.fx.map(f => `<div>${f}</div>`).join('')}</div>
    ${d.body.map(p => `<p>${p}</p>`).join('')}
    ${here ? `<p class="here"><b>이 장면에서</b> ${here}</p>` : ''}<p class="src">${d.src}</p>`);
}

export async function openRoom(app, id, { progress, onSeen }) {
  const u = unitById(id), cat = CATEGORIES.find(c => c.id === u.cat);
  const content = (await import(`../data/units/${id}.js`)).default;
  const scene = content.scene ? (await import(`../scenes/${content.scene}.js`)).default : null;
  const OPEN = UNITS.filter(isOpen), idx = OPEN.findIndex(x => x.id === id), prev = idx >= 0 ? OPEN[idx - 1] : null, next = idx >= 0 ? OPEN[idx + 1] : null;
  const PARTNAME = { propeller: '프로펠러', rudder: '타', thruster: '선수 쓰러스터', radar: '레이더', engine: '주기관', anchor: '앵커', hull: '선체', tug: '예선' };

  app.innerHTML = `<article class="room" aria-labelledby="roomTitle">
    <header class="room-head wrap">
      <nav class="crumbs" aria-label="위치"><a class="home-link" href="#/"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>홈</a><span class="sep" aria-hidden="true">/</span><a class="crumb" href="#index">${cat.no} ${esc(cat.title)}</a></nav>
      <div class="room-title"><span class="uno">${u.no}</span><h1 id="roomTitle">${esc(u.title)}</h1></div>
      <p class="room-lede">${content.lede}</p>
      <p class="room-tags">${u.exam ? `<span class="tag exam">${u.exam}</span>` : ''}</p>
    </header>
    ${scene ? `<div class="room-grid wrap">
      <div class="stage-col">
        <div class="stage" id="stage">
          <div class="st-top">
          <div class="st-tools st-tr" role="group" aria-label="시점 이동">
            <button type="button" class="st-cap" id="camMenu" aria-expanded="false">시점 이동<svg class="cm-ch" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><button type="button" class="chip" data-cam="home">처음 각도</button><button type="button" class="chip" data-cam="top">위</button><button type="button" class="chip" data-cam="side">옆</button><button type="button" class="chip" data-cam="aft">뒤</button><button type="button" class="chip" data-cam="under">아래</button><button type="button" class="chip" id="followBtn" aria-pressed="false">따라가기</button><button type="button" class="chip" id="headBtn" aria-pressed="false" title="배 뒤에서 진행 방향을 바라보며, 지금 배율 그대로 배를 따라갑니다">진행 방향 보기</button><button type="button" class="chip" id="flowZoomBtn" hidden title="물·공기 흐름선이 있는 범위가 화면에 꽉 차도록 확대하고, 배를 따라가며 보여 줍니다">흐름 확대</button>
          </div>
            <div class="st-tools st-tl" id="stModes"></div>
          </div>
          <div class="st-tools st-bl" role="group" aria-label="보이기">
            <button type="button" class="chip on" id="tgWater" aria-pressed="true">수면</button><button type="button" class="chip on" id="tgFlow" aria-pressed="true">흐름선</button><button type="button" class="chip on" id="tgLabel" aria-pressed="true">이름표</button><button type="button" class="chip" id="tgHull" aria-pressed="false" title="선체를 윤곽선만 남겨 타와 프로펠러가 가려지지 않게 한다">선체 윤곽</button><button type="button" class="chip" id="tgPad" aria-pressed="false" title="화면에 시점 조작 패드를 보이거나 숨긴다">조작 패드</button>
          </div>
          <p class="st-hint">끌어서 돌리기 · 휠·두 손가락으로 확대<br>오른쪽 단추로 끌면 시점 이동</p>
          <div class="st-tools st-pad" id="camPad" role="group" aria-label="시점 조작 패드" hidden>
            <div class="pad-head"><b>시점 조작</b><button type="button" class="pad-x" id="padHide" aria-label="조작 패드 접기" title="접기">×</button></div>
            <div class="pad-body">
              <div class="pad-cell"><div class="joy" id="padJoy" role="slider" aria-label="끌어서 시점 돌리기(좌우)와 기울이기(위아래)" aria-valuetext="가운데" tabindex="-1"><span class="knob"></span></div><small>돌리기·기울기</small></div>
              <div class="pad-cell"><div class="dpad"><button type="button" data-nav="fwd:1" class="u" aria-label="앞으로 이동">▲</button><button type="button" data-nav="side:-1" class="l" aria-label="왼쪽으로 이동">◀</button><button type="button" data-nav="side:1" class="r" aria-label="오른쪽으로 이동">▶</button><button type="button" data-nav="fwd:-1" class="d" aria-label="뒤로 이동">▼</button></div><small>앞뒤·좌우</small></div>
              <div class="pad-cell"><div class="lift"><button type="button" data-nav="lift:1" aria-label="위로 올라가기">위</button><button type="button" data-nav="lift:-1" aria-label="아래로 내려가기">아래</button></div><small>높이</small></div>
              <div class="pad-cell"><input type="range" class="zoom" id="padZoom" min="0" max="1000" value="500" aria-label="확대·축소"><small>확대</small></div>
            </div>
            <div class="pad-foot"><button type="button" class="pad-reset" data-cam="home">⟲ 시점 초기화</button><span class="pad-keys">키보드 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 이동 · <kbd>Q</kbd><kbd>E</kbd> 돌기 · <kbd>R</kbd><kbd>F</kbd> 높이 · <kbd>Z</kbd><kbd>X</kbd> 기울기 · <kbd>+</kbd><kbd>−</kbd> 확대</span></div>
          </div>
          <div class="pad-coach" id="padCoach" hidden><b>새 기능 · 시점 조작 패드</b><span>패드로 돌리고, 기울이고, 앞뒤·좌우·위아래로 움직이고, 확대할 수 있어요. 키보드는 W A S D · Q E · R F · Z X · + −</span><button type="button" class="chip" id="padCoachOk">알겠어요</button></div>

        </div>
        <div class="legend" id="legend"></div>
        <div class="player" id="player">
          <button class="pbtn" data-p="play" type="button" aria-label="재생">${ICON.play}</button>
          <button class="pbtn sub" data-p="restart" type="button" aria-label="처음으로">${ICON.restart}</button>
          <div class="track"><div class="rail"><b data-p="fill"></b></div><div class="ticks" data-p="ticks"></div><input type="range" min="0" max="1000" value="0" step="1" data-p="scrub" aria-label="재생 위치"></div>
          <div class="time" data-p="time"></div>
          <div class="rate" role="group" aria-label="재생 속도"><button type="button" data-rate="0.5">0.5배</button><button type="button" data-rate="1" class="on">1배</button><button type="button" data-rate="2">2배</button></div>
        </div>
        <div class="cap" aria-live="polite"><span class="k" id="capK"></span><h2 id="capH"></h2><p id="capP"></p></div>
      </div>
      <aside class="read" aria-label="장면 조작과 값">
        <section class="blk" id="ctlBlk"><h3>조건 바꾸기</h3><div class="ctl" id="ctl"></div></section>
        <section class="blk"><h3>지금 값</h3><dl class="rd" id="rd"></dl></section>
        <section class="blk" id="chartBlk"><h3 id="chartTitle">그래프</h3><canvas class="chart" id="chart" role="img" aria-label="그래프"></canvas></section>
        <section class="blk"><h3>흐름</h3><ol class="steps" id="steps"></ol></section>
        <p class="hint">${(scene.parts || []).length ? `움직이는 부분(${scene.parts.map(p => PARTNAME[p]).join(', ')})이나 초록 이름표를` : '초록 이름표를'} 누르면 그 안의 과학 원리를 볼 수 있습니다.</p>
      </aside>
    </div>` : ''}
    <div class="room-body wrap">
      <div class="prose">${renderBlocks(content.blocks)}</div>
      ${content.video ? videoHTML(content.video) : ''}
      ${content.exams ? renderExam(content.exams) : ''}
      ${renderSources(content.sources)}
      <nav class="pager" aria-label="다른 단원">
        ${prev ? `<a href="${roomHref(prev.id)}" class="prev"><small>이전 단원</small><span>${prev.no} ${esc(prev.title)}</span></a>` : '<span></span>'}
        ${next ? `<a href="${roomHref(next.id)}" class="next"><small>다음 단원</small><span>${next.no} ${esc(next.title)}</span></a>` : `<a href="#index" class="next"><small>처음 화면</small><span>전체 목차</span></a>`}
      </nav>
    </div>
  </article>`;

  progress.mark(id); onSeen && onSeen();
  window.__shsRooms = (window.__shsRooms || 0) + 1; let counted = true; const uncount = () => { if (counted) { counted = false; window.__shsRooms--; } };
  const stopVideo = bindVideo(app);
  mountModels(app);
  if (!scene) return { dispose() { stopVideo(); uncount(); }, applyTheme() {} };

  /* ---------- 무대 ---------- */
  const stEl = app.querySelector('#stage');
  const stage = createStage(stEl, { onPart: p => openScience(p, scene.id) });
  const $ = s => app.querySelector(s);
  const params = {}; for (const c of scene.controls || []) params[c.k] = c.val;
  const player = createPlayer({ dur: 10, steps: [] });
  let ui = null, raf = 0, disposed = false, lastChart = 0, lastStep = -1, flowOn = true;
  if (!stage.ok) {
    /* 3D를 열 수 없으면(WebGL 없음, three.js를 받지 못함) 장면 조작은 숨기고 본문·표·시험 칸만 보여 준다 */
    for (const s of ['#player', '.cap', '.read', '#legend', '.st-tools', '.st-hint']) app.querySelectorAll(s).forEach(e => { e.hidden = true; });
    stEl.style.height = 'auto'; stEl.style.minHeight = '140px';
    return { dispose() { stopVideo(); uncount(); }, applyTheme() {} };
  }

  let ctx = null, ship = null, flow = null, tug = null, tug2 = null;
  if (stage.ok) {
    const THREE = stage.THREE;
    ship = createShip(stage); flow = createFlow(760, 16); flow.setPalette(stage.palette); ship.yaw.add(flow.obj);
    const fxW = new THREE.Group(), fxY = new THREE.Group(), fxR = new THREE.Group(); stage.scene.add(fxW); ship.yaw.add(fxY); ship.root.add(fxR);
    ctx = { THREE, stage, ship, flow, fxW, fxY, fxR, get P() { return stage.palette; }, get tug() { return tug || (tug = makeTug(stage)); }, get tug2() { return tug2 || (tug2 = makeTug(stage)); }, V3, label: stage.addLabel };
    stage.follow.obj = ship.yaw;
    /* 멀리서 볼 때 배 위치 표식 */
    const mB = V3(), mS = V3();
    stage.setMarkers(() => { if (!ship.yaw.visible || !ship.model.visible) return []; ship.yaw.updateMatrixWorld(); return [{ bow: mB.set(SH.L / 2, 0, 0).applyMatrix4(ship.yaw.matrixWorld), stern: mS.set(-SH.L / 2, 0, 0).applyMatrix4(ship.yaw.matrixWorld) }]; });
    /* 이름표가 버튼 줄 밑에 숨지 않게 그 자리를 비운다 */
    stage.setObstacles(() => { const o = stEl.getBoundingClientRect(), out = []; for (const e of stEl.querySelectorAll('.st-tools, .st-hint')) { if (!e.offsetParent || !e.childElementCount && e.tagName !== 'P') continue; const r = e.getBoundingClientRect(); if (r.width && r.height) out.push({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }); } return out; });
    for (const p of scene.parts || []) {
      const get = {
        propeller: o => { const pr = scene.propObj ? scene.propObj() : ship.prop; pr.updateMatrixWorld(); return o.set(0, -5.6, 0).applyMatrix4(pr.matrixWorld); },
        rudder: o => { ship.rudder.updateMatrixWorld(); return o.set(-2, 0.2, 0).applyMatrix4(ship.rudder.matrixWorld); },
        thruster: o => { ship.model.updateMatrixWorld(); return o.set(128, 8, 18).applyMatrix4(ship.model.matrixWorld); },
        radar: o => { ship.radars[0].updateMatrixWorld(); return o.set(0, 2, 0).applyMatrix4(ship.radars[0].matrixWorld); },
        engine: o => { ship.model.updateMatrixWorld(); return o.set(-127, 44, 0).applyMatrix4(ship.model.matrixWorld); },
        anchor: o => { const a = scene.anchorObj ? scene.anchorObj() : ship.anchors[0]; a.updateMatrixWorld(); return o.set(0, 6, 2).applyMatrix4(a.matrixWorld); },
        hull: o => { ship.model.updateMatrixWorld(); return o.set(40, 46, 0).applyMatrix4(ship.model.matrixWorld); },
        tug: o => { if (!tug) return null; tug.updateMatrixWorld(); return o.set(0, 12, 0).applyMatrix4(tug.matrixWorld); }
      }[p];
      if (get) stage.addLabel(PARTNAME[p], 'part', get, p);
    }
    stage.setAllowedParts(scene.parts || []);
  }

  function clearFx() {
    for (const g of [ctx.fxW, ctx.fxY, ctx.fxR]) for (let i = g.children.length - 1; i >= 0; i--) { const c = g.children[i]; g.remove(c); if (c !== tug && c !== tug2) { stage.unregister(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } }
    for (const t of [tug, tug2]) if (t) { t.visible = false; stage.scene.add(t); }
    stage.clearLabels(true); ship.reset(); stage.setSeabed(null);
  }
  function build(keep) {
    if (stage.ok) clearFx();
    scene.build(ctx, params);
    player.steps = scene.steps; player.rebuild(scene.dur, keep);
    if (stage.ok) {
      stage.setWater(scene.water || {}); stage.scene.fog.near = scene.fog ? scene.fog[0] : 4500; stage.scene.fog.far = scene.fog ? scene.fog[1] : 13000; if (!waterOn) stage.ocean.visible = false;
      $('#flowZoomBtn').hidden = !(scene.field && scene.box);
      flow.setPalette(stage.palette); flow.reset(scene); flow.obj.visible = flowOn && !!scene.field;
      if (hullOutline) ship.setOutline(true);
      scene.apply(player.t);
    }
    renderPanel(); if (ui) ui.refresh(); else ui = bindPlayerUI(player, $('#player'), { scale: () => scene.scale || 1, onSeek: () => update(true) });
    update(true);
  }
  function camHome(instant) {
    const c = scene.cam || {}; const tg = c.target ? c.target(ctx) : (() => { ship.root.updateMatrixWorld(); return V3().setFromMatrixPosition(ship.root.matrixWorld); })();
    stage.camTo({ r: c.r, th: c.th, ph: c.ph, target: tg }, instant ? 0 : 0.8);
    stage.follow.heading = false; setFollow(!!c.follow);
  }
  function setFollow(on) {
    stage.follow.on = on; if (!on) stage.follow.heading = false; stage.invalidate();
    for (const [id, v] of [['#followBtn', stage.follow.on], ['#headBtn', stage.follow.heading]]) { $(id).classList.toggle('on', v); $(id).setAttribute('aria-pressed', v); }
  }

  /* ---------- 읽기 칸 ---------- */
  function renderPanel() {
    const ctl = $('#ctl'); ctl.innerHTML = '';
    const cs = (scene.controls || []).filter(c => !c.when || c.when(params));
    $('#ctlBlk').hidden = !cs.length;
    for (const c of cs) {
      const row = document.createElement('div'); row.className = 'ctl-row';
      if (c.type === 'range') {
        const idn = 'c-' + c.k;
        row.innerHTML = `<label for="${idn}">${c.label}</label><div class="rng"><input id="${idn}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${params[c.k]}"><output for="${idn}">${c.fmt(+params[c.k])}</output></div>`;
        const inp = row.querySelector('input'), out = row.querySelector('output');
        inp.addEventListener('input', () => { out.textContent = c.fmt(+inp.value); });
        inp.addEventListener('change', () => { params[c.k] = +inp.value; build(true); });
      } else {
        row.innerHTML = `<span class="lab" id="l-${c.k}">${c.label}</span><div class="seg${c.many ? ' many' : ''}" role="radiogroup" aria-labelledby="l-${c.k}">${c.opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${params[c.k] == v}" class="${params[c.k] == v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>`;
        row.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const v = c.opts.find(o => String(o[0]) === b.dataset.v)[0]; params[c.k] = v; build(!c.restart); if (c.restart) camHome(); }));
      }
      ctl.appendChild(row);
    }
    $('#chartTitle').textContent = scene.chartTitle || '그래프';
    $('#chartBlk').hidden = !scene.chart;
    const ol = $('#steps'); ol.innerHTML = '';
    scene.steps.forEach(s => { const li = document.createElement('li'); li.innerHTML = `<button type="button">${s.h}</button>`; li.querySelector('button').addEventListener('click', () => { player.seek(s.t + 0.01); update(true); }); ol.appendChild(li); });
    const P = stage.ok ? stage.palette : {};
    $('#legend').innerHTML = (scene.legend || []).map(([c, t]) => `<span><i style="background:${P[c] || c}"></i>${t}</span>`).join('');
    lastStep = -1;
  }
  function update(force) {
    if (force && stage.ok) { scene.apply(player.t); stage.invalidate(); }
    const k = ui ? ui.update() : 0;
    if (k !== lastStep || force) {
      lastStep = k; const s = scene.steps[k] || { h: '', p: '' };
      $('#capK').textContent = `${k + 1} / ${scene.steps.length}`; $('#capH').textContent = s.h; $('#capP').innerHTML = s.p;
      app.querySelectorAll('#steps li').forEach((li, i) => { li.classList.toggle('on', i === k); li.classList.toggle('past', i < k); });
    }
    const now = performance.now();
    if (force || now - lastChart > 120) {
      lastChart = now;
      if (stage.ok || scene.readOffline) $('#rd').innerHTML = scene.read(player.t).map(([a, b, c]) => `<dt>${a}</dt><dd class="${c || ''}">${b}</dd>`).join('');
      if (scene.chart && stage.ok) scene.chart($('#chart'), stage.palette, { lineChart, chartBegin, t: player.t });
    }
  }

  /* ---------- 조작 ---------- */
  let waterOn = true, hullOutline = false, padZoomSync = () => {}, navKeysOff = () => {};
  if (stage.ok) {
    app.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.cam; if (m === 'home') return camHome();
      ship.root.updateMatrixWorld(); const tg = V3().setFromMatrixPosition(ship.root.matrixWorld), psi = -ship.yaw.rotation.y, r = Math.min(Math.max(stage.orb.r, 60), 2400);
      if (m === 'top') stage.camTo({ ph: 0.06, r: r * 1.1, target: tg });
      if (m === 'side') stage.camTo({ th: psi + Math.PI / 2, ph: 1.38, r, target: tg });
      if (m === 'aft') stage.camTo({ th: psi + Math.PI, ph: 1.32, r, target: tg });
      if (m === 'under') stage.camTo({ ph: 2.55, r: Math.min(r, 520), target: tg });
    }));
    $('#followBtn').addEventListener('click', () => setFollow(!stage.follow.on));
    /* 흐름 확대: 장면의 흐름선 범위(배 기준 상자)가 화면에 꽉 차게 맞추고 배를 따라간다 */
    $('#flowZoomBtn').addEventListener('click', () => {
      const b = scene.box; if (!b) return;
      if (!flowOn) $('#tgFlow').click();
      ship.yaw.updateMatrixWorld(); const c = V3((b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2).applyMatrix4(ship.yaw.matrixWorld), psi = -ship.yaw.rotation.y;
      const lx = b[1] - b[0], ly = b[3] - b[2], lz = b[5] - b[4], tn = Math.tan(18 * Math.PI / 180), asp = stEl.clientWidth / Math.max(1, stEl.clientHeight);
      if (Math.max(lx, lz) >= 120) stage.camTo({ th: psi + Math.PI, ph: 0.42, r: 1.08 * Math.max(lx / 2 / tn, lz / 2 / (tn * asp)), target: c });
      else { const c0 = scene.cam || {}; stage.camTo({ th: psi + (c0.th ?? Math.PI / 2), ph: c0.ph ?? 1.3, r: 1.1 * Math.max(lx, ly, lz) / 2 / (tn * Math.min(1, asp)), target: c }); }
      stage.follow.heading = true; setFollow(true);
    });
    /* 좁은 화면: 시점 버튼을 접었다 편다 */
    const trEl = app.querySelector('.st-tr'), narrow = () => matchMedia('(max-width: 720px)').matches;
    $('#camMenu').addEventListener('click', () => { if (!narrow()) return; const o = !trEl.classList.contains('open'); trEl.classList.toggle('open', o); $('#camMenu').setAttribute('aria-expanded', o); stage.invalidate(); });
    trEl.addEventListener('click', e => { if (narrow() && e.target.closest('.chip')) { trEl.classList.remove('open'); $('#camMenu').setAttribute('aria-expanded', false); stage.invalidate(); } });
    $('#headBtn').addEventListener('click', () => {
      if (stage.follow.heading) { stage.follow.heading = false; setFollow(stage.follow.on); return; }
      /* 배 뒤쪽으로 돌아가 선수 방향을 보게 한 뒤, 거리(배율)와 높이는 그대로 두고 배를 따라 돈다 */
      ship.root.updateMatrixWorld(); const tg = V3().setFromMatrixPosition(ship.root.matrixWorld), psi = -ship.yaw.rotation.y;
      stage.camTo({ th: psi + Math.PI, target: tg }); stage.follow.heading = true; setFollow(true);
    });
    const tog = (sel, fn) => $(sel).addEventListener('click', e => { const on = !e.currentTarget.classList.contains('on'); e.currentTarget.classList.toggle('on', on); e.currentTarget.setAttribute('aria-pressed', on); fn(on); stage.invalidate(); });
    tog('#tgWater', on => { waterOn = on; stage.ocean.visible = on; });
    tog('#tgFlow', on => { flowOn = on; flow.obj.visible = on && !!scene.field; });
    tog('#tgLabel', on => stage.setLabelsOn(on));
    tog('#tgHull', on => { hullOutline = on; ship.setOutline(on); });
    padSetup();
  }
  /* ---------- 시점 조작 패드 · 키보드 ---------- */
  function padSetup() {
    const pad = $('#camPad'), nav = stage.nav, btn = $('#tgPad'), hint = app.querySelector('.st-hint');
    const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
    const showPad = on => { pad.hidden = !on; btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); if (hint) hint.hidden = on; store('shs-pad', on ? '1' : '0'); stage.invalidate(); };
    const saved = store('shs-pad');
    showPad(saved == null ? !matchMedia('(max-width: 720px)').matches : saved === '1');
    btn.addEventListener('click', () => showPad(pad.hidden));
    $('#padHide').addEventListener('click', () => showPad(false));
    /* 처음 한 번만 안내 */
    const coach = $('#padCoach');
    if (!store('shs-padcoach')) { coach.hidden = false; const ok = () => { coach.hidden = true; store('shs-padcoach', '1'); }; $('#padCoachOk').addEventListener('click', ok); setTimeout(ok, 12000); }
    /* 누르고 있는 동안 움직이는 단추 */
    pad.querySelectorAll('[data-nav]').forEach(b => {
      const [k, v] = b.dataset.nav.split(':'), on = e => { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); nav[k] = +v; b.classList.add('on'); }, off = () => { if (nav[k] === +v) nav[k] = 0; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, off);
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
    /* 조이스틱: 가운데에서 끈 만큼 좌우로 돌고 위아래로 기운다 */
    const joy = $('#padJoy'), knob = joy.querySelector('.knob'); let jid = null;
    const joyMove = e => {
      const r = joy.getBoundingClientRect(), R = r.width / 2 - 8; let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px,${dy}px)`; const dz = k => Math.abs(k) < 0.12 ? 0 : k;
      nav.yaw = dz(dx / R); nav.pitch = dz(dy / R);
    };
    const joyEnd = () => { jid = null; nav.yaw = 0; nav.pitch = 0; knob.style.transform = ''; joy.classList.remove('on'); };
    joy.addEventListener('pointerdown', e => { e.preventDefault(); jid = e.pointerId; joy.setPointerCapture(e.pointerId); joy.classList.add('on'); joyMove(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === jid) joyMove(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) joy.addEventListener(ev, e => { if (e.pointerId === jid) joyEnd(); });
    /* 확대 막대: 위로 올릴수록 가깝게(로그 눈금) */
    const zr = $('#padZoom'), RMIN = 12, RMAX = 9000, L = Math.log(RMIN / RMAX); let zDrag = false;
    zr.addEventListener('pointerdown', () => { zDrag = true; }); for (const ev of ['pointerup', 'pointercancel', 'change']) zr.addEventListener(ev, () => { zDrag = false; });
    zr.addEventListener('input', () => stage.setZoom(RMAX * Math.exp(L * zr.value / 1000)));
    padZoomSync = () => { if (!zDrag && !pad.hidden) { const v = Math.round(1000 * Math.log(stage.orb.r / RMAX) / L); if (+zr.value !== v) zr.value = v; } };
    /* 키보드: 누르고 있는 동안 */
    const KEYS = { KeyW: ['fwd', 1], KeyS: ['fwd', -1], KeyA: ['side', -1], KeyD: ['side', 1], KeyQ: ['yaw', -1], KeyE: ['yaw', 1], KeyR: ['lift', 1], KeyF: ['lift', -1], KeyZ: ['pitch', 1], KeyX: ['pitch', -1], Equal: ['zoom', -1], NumpadAdd: ['zoom', -1], Minus: ['zoom', 1], NumpadSubtract: ['zoom', 1] };
    const kd = e => {
      const m = KEYS[e.code]; if (!m || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.dlg.open, .toc.open')) return;
      const tag = (e.target.tagName || '').toLowerCase(); if ((tag === 'input' && e.target.type !== 'range') || tag === 'textarea' || e.target.isContentEditable) return;
      e.preventDefault(); nav[m[0]] = m[1];
    };
    const ku = e => { const m = KEYS[e.code]; if (m && nav[m[0]] === m[1]) nav[m[0]] = 0; };
    const clear = () => { for (const k in nav) nav[k] = 0; };
    document.addEventListener('keydown', kd); document.addEventListener('keyup', ku); addEventListener('blur', clear);
    navKeysOff = () => { document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); removeEventListener('blur', clear); clear(); };
  }
  const onKey = e => {
    if (document.querySelector('.dlg.open, .toc.open')) return;
    const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' && e.target.type !== 'range') return;
    if (e.code === 'Space' && tag !== 'button' && tag !== 'a') { e.preventDefault(); player.setPlaying(!player.playing); update(true); }
    else if (e.key === 'ArrowRight' && tag !== 'input') { player.seek(player.t + 1); update(true); }
    else if (e.key === 'ArrowLeft' && tag !== 'input') { player.seek(player.t - 1); update(true); }
    else if (e.key === ']' && next) location.hash = roomHref(next.id);
    else if (e.key === '[' && prev) location.hash = roomHref(prev.id);
  };
  document.addEventListener('keydown', onKey);

  build(false);
  if (stage.ok) camHome(true);

  let last = performance.now();
  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    player.tick(dt);
    if (stage.ok) {
      if (player.playing) scene.apply(player.t);
      if (player.playing) {
        if (flowOn && scene.field) flow.step(dt * player.rate * (scene.flowVis || 6));
        const rpm = scene.st && scene.st.n != null ? scene.st.n : 0;
        ship.prop.rotation.x += rpm / 60 * 2 * Math.PI * dt * player.rate * 0.6;
        for (const r of ship.radars) r.rotation.y += dt * player.rate * 2.1;
        if (scene.tick) scene.tick(dt * player.rate, ctx);
      }
      stage.frame(dt, player.playing);
      padZoomSync();
    }
    update(false);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    applyTheme() { if (!stage.ok) return; stage.applyTheme(); build(true); },
    dispose() { stopVideo(); uncount(); disposed = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); navKeysOff(); if (scene.dispose) scene.dispose(); if (stage.ok) stage.dispose(); }
  };
}
export { UNITS };
