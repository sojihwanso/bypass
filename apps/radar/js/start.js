/* 시작 화면(시나리오 5개·자유 항해·이어 하기) · 시나리오 안내 · 결과 화면 */
import { SCENARIOS, freeSetup, createLog, evaluate } from './scenarios.js';
import { loadLand, pointInLand } from './coast.js';
import { REGIONS, pickStart, routeClear, makeRoute } from './place.js';
import { makeTraffic, LEVELS } from './traffic.js';
import { rollWeather, rollCurrent, createWeatherRun, WX_CAP } from './weather.js';
import { S, saveSettings } from './state.js';
import { makeProj } from './geo.js';
import { t, tl, lang } from './i18n.js';
import { PORTS, portDef, createPortLog, evaluatePort, PORT_PASS_NM } from './port.js';
import { applyPreset } from './menu.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const mmss = (s) => `${String((s / 60) | 0).padStart(2, '0')}:${String((s % 60) | 0).padStart(2, '0')}`;
let ui = null, lastResult = null, current = null;

/* 안내·결과는 각자 대화상자(같은 창을 다시 쓰면 늦게 오는 close 이벤트가 정지를 풀어 버림) */
let curLog = null;
function ownDlg(id, title, body, foot) {
  let d = document.getElementById(id);
  if (!d) { d = document.createElement('dialog'); d.id = id; document.getElementById('app').append(d); }
  d.innerHTML = `<div class="dlg-h"><span></span><button class="btn" type="button" data-x="1"></button></div><div class="dlg-b"></div><div class="dlg-f"></div>`;
  d.querySelector('.dlg-h span').textContent = title; d.querySelector('[data-x]').textContent = lang() === 'en' ? 'Close' : '닫기';
  d.querySelector('.dlg-b').innerHTML = body; d.querySelector('.dlg-f').innerHTML = foot;
  if (!d.open) d.showModal(); return d;
}
export function initStart(uiRef) { ui = uiRef; window.RadarStart = openStart; window.RadarPortMenu = openPortMenu; window.RadarBrief = () => current && current.id !== 'FREE' && !lastResult && showBrief(current); return { openStart, startScenario, startPort, openPortMenu, resumeVoyage, lastResult: () => lastResult, finishNow: () => curLog && !lastResult && (current && current.portId ? finishPort(evaluatePort(curLog.result())) : finish(evaluate(curLog.result()))) }; }

export async function openStart(o = {}) {
  const R = window.Radar, en = lang() === 'en';
  const recs = records(), LV = (l) => (LVL[l] || LVL.none)[en ? 1 : 0];
  const rec = (s) => { const r = recs[s.id]; if (!r) return ''; return `<span class="rec ${r.pass ? 'ok' : 'ng'}">${r.pass ? (en ? '✓ PASS' : '✓ 합격') : en ? '✗ not passed' : '✗ 불합격'}${r.warnN ? (en ? ' · rule check' : ' · 규칙 주의') : ''} · ${r.nm != null ? r.nm.toFixed(2) + ' NM' : '-'} · ${esc(LV(r.lv))}${r.best ? (en ? ` · best ${r.best.toFixed(2)} NM` : ` · 최고 ${r.best.toFixed(2)} NM`) : ''}</span>`; };
  const card = (s) => `<button type="button" class="scard" data-scn="${s.id}"><span class="sid">${s.id}</span><b>${esc(tl(s))}</b><span class="rule">COLREG ${s.rule}</span><span class="sb">${esc(tl(s.brief))}</span>${rec(s)}<span class="why" hidden></span></button>`;
  const html = `<div class="start">
    <p class="lead">${en ? 'Pick a collision-avoidance scenario. The radar starts in STANDBY: switch it on and wait for the warm-up.' : '충돌 회피 시나리오를 고르세요. 레이더는 대기(STBY)로 시작해요. 송신을 켜고 예열을 기다리세요.'}</p>
    <button type="button" class="edu-card" data-start="edu"><img src="../ecdis/edu/dodo_explain.webp" alt="" width="56" height="56"><span><b>${en ? 'Training course with Dodo (Korean)' : '도도와 함께하는 교육 과정'}</b><small>${en ? 'Five short courses, step by step.' : '처음이라면 여기부터! 레이더 켜기부터 충돌 회피까지 5과정 53단계를 하나씩 따라 해요.'}</small></span></button>
    <div class="lvl" role="group" aria-label="${en ? 'Difficulty' : '난이도'}"><b>${en ? 'Difficulty (surrounding traffic)' : '난이도(주변 교통량)'}</b>${LEVELS.map((l) => `<button type="button" class="btn${S.sim.level === l ? ' on' : ''}" data-level="${l}">${LVL[l][en ? 1 : 0]}</button>`).join('')}<span class="small">${en ? 'Harder = more ships, and more of them without AIS.' : '어려울수록 배가 많고, AIS 없는 배도 많아져요.'}</span></div>
    <div class="scards">${SCENARIOS.map(card).join('')}</div>
    <div class="free"><b>${en ? 'Free navigation' : '자유 항해'}</b>
      <label>${en ? 'Ships' : '선박 수'} <select id="fN">${[0, 2, 4, 6, 8].map((v) => `<option${v === 4 ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>${en ? 'Seed' : '시드'} <input type="number" id="fSeed" value="${(Math.random() * 9999) | 0}" style="width:80px"></label>
      <button class="btn" type="button" data-start="free">${en ? 'Start' : '시작'}</button>
      ${R.hasResume() ? `<button class="btn" type="button" data-start="resume">${en ? 'Resume previous' : '이전 항해 이어 하기'}</button>` : ''}
    </div></div>`;
  let dlg = document.getElementById('startDlg');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'startDlg'; document.getElementById('app').append(dlg); }
  dlg.innerHTML = `<div class="dlg-h"><span>${en ? 'Scenarios' : '시나리오'}</span><button class="btn" type="button" data-close="1">${en ? 'Close' : '닫기'}</button></div><div class="dlg-b">${html}</div>`;
  if (!dlg.open) dlg.showModal();
  const was = dlg.dataset.open === '1' ? dlg._was : (R.isPaused ? R.isPaused() : false); dlg._was = was; dlg.dataset.open = '1'; R.setPaused(true);
  let starting = false;
  dlg.onclose = () => { dlg.dataset.open = ''; if (!starting) R.setPaused(was); }; // 닫기만 하면 열기 전 일시정지 상태로
  dlg.onclick = (e) => {
    if (e.target.closest('[data-close]')) { dlg.close(); return; }
    const lv = e.target.closest('[data-level]'); if (lv) { S.sim.level = lv.dataset.level; saveSettings(); dlg.querySelectorAll('[data-level]').forEach((b) => b.classList.toggle('on', b === lv)); return; }
    starting = true;
    const tu = window.Tutor, tuSt = tu && tu.state && tu.state(); if ((e.target.closest('[data-scn]') || e.target.closest('[data-start="free"]') || e.target.closest('[data-start="resume"]')) && tu && tu.stop && !(tuSt && tuSt.course === 'R5')) tu.stop(); // 교육 중(과정 목록·완료 창 포함, 시나리오 과정 R5 밖)에 다른 항해를 고르면 교육을 끝냄 // 교육 중(시나리오 과정 R5 밖)에 시나리오를 고르면 교육을 끝냄
    const c = e.target.closest('[data-scn]'); if (c && !c.disabled) { dlg.close(); startScenario(c.dataset.scn); return; }
    const b = e.target.closest('[data-start]'); if (!b) { starting = false; return; }
    if (b.dataset.start === 'edu') { dlg.close(); R.setPaused(false); window.Tutor && window.Tutor.menu(); return; }
    if (b.dataset.start === 'resume') { dlg.close(); resumeVoyage(); R.setPaused(false); return; } // 시작 화면이 걸어 둔 일시정지를 풂(자동 저장도 다시 돎)
    const scn = freeSetup({ lat: 33.5, lon: 124.6, nTargets: +dlg.querySelector('#fN').value, sea: 2, rain: false, seed: +dlg.querySelector('#fSeed').value || 1 });
    dlg.close(); runScenario(scn, { free: true, skipBrief: true });
  };
  // S5: 해안선을 못 불러오면 비활성
  const s5 = SCENARIOS.find((s) => s.needsCoast), L = await loadLand({ lat0: s5.own.lat - 0.6, lat1: s5.own.lat + 0.6, lon0: s5.own.lon - 0.75, lon1: s5.own.lon + 0.75 }, o.fetchText);
  if (!L.ok) { const b = dlg.querySelector(`[data-scn="${s5.id}"]`); if (b) { b.disabled = true; const w = b.querySelector('.why'); w.hidden = false; w.textContent = en ? 'Coastline data could not be loaded.' : '해안선 데이터를 불러오지 못해 시작할 수 없어요.'; } }
  return dlg;
}

export function startScenario(id, o = {}) { const s = SCENARIOS.find((x) => x.id === id); return runScenario(s, o); }

const LVL = { none: ['없음', 'None'], easy: ['쉬움', 'Easy'], medium: ['중간', 'Medium'], hard: ['어려움', 'Hard'] };
const seeded = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const around = (lat, lon) => ({ lat0: lat - 0.6, lat1: lat + 0.6, lon0: lon - 0.75, lon1: lon + 0.75 });
/* 무작위 해역·침로 배치 + 난이도 교통량 + 날씨. o.place=false면 원래 위치, o.level로 난이도 덮어쓰기, o.seed로 재현 */
async function prepare(scn, o) {
  const rnd = seeded((o.seed ?? Math.random() * 4294967295) >>> 0 || 1);
  if (scn.portId) { /* 히든 시나리오: 위치·교통·조류는 항구 정의에서, 날씨는 맑음(날씨 변화를 켜 두면 진행 중 바뀜) */
    const weather = { kind: 'clear', fog: false, visNM: 10, sea: 1 + (rnd() < 0.5 ? 0 : 1), windFrom: Math.round(rnd() * 360), windMs: 4, rain: [], ducting: false, interference: false, current: { ...scn.weather.current } };
    return { def: scn, weather, region: null, rnd, level: scn.level, route: [] };
  }
  let def = scn, region = null;
  const wxOn0 = S.sim.weatherOn || scn.fixedWeather, cur = scn.weather && scn.weather.current ? { ...scn.weather.current } : wxOn0 ? rollCurrent(rnd) : { set: 0, drift: 0 }; // 조류를 먼저 정해 항로 확인에 넣음
  if (o.place !== false && !scn.needsCoast) {
    const first = o.region ? REGIONS.find((r) => r.id === o.region) : REGIONS[Math.floor(rnd() * REGIONS.length)];
    // 고른 해역에서 육지로 가지 않는 침로를 못 찾으면 다른 해역도 차례로 시도
    for (const cand of o.region ? [first] : [first, ...REGIONS.filter((r) => r !== first)]) {
      const L = await loadLand(around((cand.box.lat0 + cand.box.lat1) / 2, (cand.box.lon0 + cand.box.lon1) / 2), o.fetchText);
      if (L.ok) { const p = pickStart({ def: scn, region: cand, rings: L.rings, rnd, cur }); if (p.ok) { def = p.def; region = cand; break; } }
    }
  }
  const L2 = await loadLand(around(def.own.lat, def.own.lon), o.fetchText), P = makeProj(def.own.lat, def.own.lon);
  const onLand = (lat, lon) => L2.ok && pointInLand(L2.rings, lat, lon);
  const bg = makeTraffic({ level: o.level ?? S.sim.level, own: { ...def.own, kn: def.own.kn ?? 14 }, rnd }).filter((g) => !L2.ok || routeClear(L2.rings, g.lat, g.lon, g.hdg, g.kn, 60, 0.3, cur)); // 주변 배도 1시간 동안 육지로 가지 않는 배만
  const wxOn = S.sim.weatherOn || scn.fixedWeather;
  const lvl = o.level ?? S.sim.level, weather = wxOn ? rollWeather(rnd, scn.fixedWeather ? def.weather : null, def.own, WX_CAP[lvl] || WX_CAP.hard) : { kind: 'clear', fog: false, visNM: 10, sea: 1, windFrom: Math.round(rnd() * 360), windMs: 3, rain: [], ducting: false, interference: false };
  weather.current = def.weather && def.weather.current ? { ...def.weather.current } : cur;
  // 변침점 3~5개: 첫 구간은 시나리오 시간 동안 가는 거리 + 2 NM 이상(조우가 첫 구간에서 일어나게)
  const kn0 = def.own.kn ?? 14, route = makeRoute({ lat: def.own.lat, lon: def.own.lon, hdg: def.own.hdg, rnd, rings: L2.ok ? L2.rings : null, firstNM: (kn0 * (scn.durationMin || 30)) / 60 + 2 });
  return { def: { ...def, targets: [...def.targets, ...bg] }, weather, region, rnd, level: o.level ?? S.sim.level, route };
}

/* 교육 과정 중에 연 시나리오는 이어 하기 저장·시나리오 기록을 건드리지 않음 */
const eduOn = () => !!(window.RadarEdu && window.RadarEdu.active && window.RadarEdu.active());
/* 해역(해안선)을 받는 동안: '해역 준비 중' 표시. 그 사이 들어온 시작은 버리지 않고 앞 시작이 끝난 뒤 차례로(시나리오 두 개가 함께 돌지 않게) */
let preparing = false, queue = Promise.resolve(), startGen = 0, lastStarted = null; // startGen: 마지막 시작 요청 번호(앞 요청은 준비가 끝나도 버림)
function loadNote(on) { let n = document.getElementById('loadNote'); if (!on) { if (n) n.remove(); return; } if (!n) { n = document.createElement('div'); n.id = 'loadNote'; n.className = 'load-note'; n.setAttribute('role', 'status'); document.getElementById('app').append(n); } n.textContent = lang() === 'en' ? 'Preparing the sea area…' : '해역 준비 중…'; }
function runScenario(scn, o = {}) { loadNote(true); const my = ++startGen, w0 = window.Radar.world; const p = queue.then(() => runScenario1(scn, o, my, w0)); /* 누르자마자 '해역 준비 중' */ queue = p.catch(() => {}); return p; }
async function runScenario1(scn, o = {}, my = startGen, w0 = window.Radar.world) {
  const R = window.Radar, en = lang() === 'en';
  if (my !== startGen) return; preparing = true; loadNote(true);
  let pr; try { pr = await prepare(scn, o); } finally { preparing = false; if (my === startGen) loadNote(false); }
  /* 준비하는 동안 더 새 시작을 골랐거나, 다른 세계(교육·이어 하기)가 시작됐거나, 시작 화면을 다시 열었으면 이 시작은 버림 */
  const sd = document.getElementById('startDlg'); if (my !== startGen || (R.world !== w0 && R.world !== lastStarted) || (sd && sd.open)) { if (my === startGen) loadNote(false); return; }
  lastResult = null; current = scn;
  const def = pr.def; R.setPaused(false);
  const where = pr.region ? ` · ${tl(pr.region)}` : '';
  R.startWorld({ name: (o.free ? (en ? 'Free navigation' : '자유 항해') : scn.portId ? tl(scn) : `${scn.id} · ${tl(scn)}`) + where, own: def.own, targets: def.targets, weather: pr.weather, aids: def.aids, marks: def.marks || [], needsCoast: !!scn.needsCoast || !!scn.portId, traffic: { level: pr.level }, route: pr.route, save: !eduOn() && scn.save !== false, scnId: o.free ? null : scn.id, portId: def.portId, mode: def.mode, seed: def.seed, coastOverride: def.coastOverride, landFine: def.landFine, iala: def.iala });
  lastStarted = R.world; // 앞서 시작된 우리 시나리오는 '다른 세계'로 치지 않음
  R.setWeatherRun(createWeatherRun({ rnd: pr.rnd, enabled: S.sim.weatherOn, cap: WX_CAP[pr.level] || WX_CAP.hard }));
  if (scn.portId) { applyPreset(S, 'HARBOR'); R.setRange(1.5); } /* 히든 시나리오: 맞춤 영상 HARBOR(GAIN 55) → 아래에서 GAIN 0으로 */
  R.setRadar('stby'); /* 어떻게 시작하든 STBY(송신 → 예열 5초) */
  S.ctrl.gain = 0; if (S.ctrl.ace) S.ctrl.ace = false; /* GAIN 0에서 시작: 송신 뒤 GAIN을 올리며 영상이 살아나는 것을 직접 보게 */
  if (scn.message) R.ais().addMessage({ ...scn.message, t: 0 });
  if (o.free) { curLog = null; R.setLog(null); R.setScenarioTick(null); return; } // 자유 항해: 지난 시나리오 기록을 끝내지 않게
  if (scn.portId) { attachPortEval(def); if (!o.skipBrief) showPortBrief(scn); return; }
  attachEval(def);
  if (!o.skipBrief) showBrief(scn);
}
/* 브리핑(시작할 때, 헤더의 시나리오 이름을 눌러 다시 볼 때). 열려 있는 동안 정지 */
function showBrief(scn) {
  if (scn.portId) return showPortBrief(scn);
  const R = window.Radar, en = lang() === 'en', again = !!(R.world && R.world.t > 1), was = again && R.isPaused();
  {
    R.setPaused(true);
    const d = ownDlg('briefDlg', `${scn.id} · ${tl(scn)}`, `<p class="rule-chip">COLREG ${scn.rule}</p><p>${esc(tl(scn.brief))}</p><p class="small">${en ? 'Pass: no collision (within 0.03 NM) and no grounding during the 30-minute scenario. The closest distance and how often and how long scenario ships came within 0.3 NM are shown in the result but not graded. Surrounding traffic keeps clear of you on its own.' : '합격: 30분 동안 충돌(0.03 NM 이내)·좌초가 없으면 돼요. 가장 가까운 거리와 상대선이 0.3 NM 안에 들어온 횟수·시간은 결과에 보여 주지만 합격 판정에는 넣지 않아요. 주변 배(난이도)는 자선을 알아서 피해요.'}</p>`, `<button class="btn pri" type="button" data-go="1">${again ? (en ? 'Continue' : '계속') : en ? 'Start' : '시작'}</button>`);
    d.onclick = (e) => { if (e.target.closest('[data-go]') || e.target.closest('[data-x]')) d.close(); };
    d.onclose = () => R.setPaused(was); // 다시 볼 때 미리 일시정지해 두었으면 그대로
  }
}

/* 기록·평가를 붙임(새로 시작할 때, 이어 하기로 돌아올 때 init = 저장된 기록) */
function attachEval(def, init = null) {
  const R = window.Radar, log = createLog(def, init); curLog = log; let lastS = -1;
  R.setLog((w) => { if (w.t - lastS >= 1) { lastS = w.t; log.sample(w); } }, () => log.dump());
  R.setScenarioTick((w) => {
    if (lastResult) return; const r = log.result();
    if (r.collision || r.grounding || w.t >= def.durationMin * 60) finish(evaluate(r)); /* 30분까지 진행(상대선이 지나가도 일찍 끝내지 않음, 사용자 결정) */
  });
}
/* 이전 항해 이어 하기: 시나리오 도중이었으면 평가를 이어서 붙임 */
export function resumeVoyage() {
  const R = window.Radar; lastResult = null; curLog = null; current = null;
  const s = R.resume(); if (!s) return false;
  const scn = s.scn && SCENARIOS.find((x) => x.id === s.scn);
  if (scn) { current = scn; attachEval({ ...scn, ...R.world.def, rule: scn.rule, durationMin: scn.durationMin, own: scn.own }, s.log); }
  return true;
}
/* 시나리오별 지난 결과(시작 화면 카드에 표시). best = 합격한 것 중 가장 가까운 거리가 가장 큰 값 */
const REC_KEY = 'radar-results';
export function records() { try { return JSON.parse(localStorage.getItem(REC_KEY) || '{}') || {}; } catch (e) { return {}; } }
export function saveRecord(id, r, lv) { try { const all = records(), old = all[id] || {}, nm = r.minRange ? r.minRange.nm : null; all[id] = { pass: r.pass, nm, warnN: r.warnN || 0, lv, d: Date.now(), n: (old.n || 0) + 1, best: r.pass && nm != null ? Math.max(old.best || 0, nm) : old.best || null }; localStorage.setItem(REC_KEY, JSON.stringify(all)); } catch (e) {} }
function finish(r) {
  const R = window.Radar, en = lang() === 'en'; lastResult = r; if (current && current.id && current.id !== 'FREE' && !eduOn()) saveRecord(current.id, r, (R.world && R.world.def.traffic && R.world.def.traffic.level) || 'none'); R.setScenarioTick(null); R.setLog(null); R.setPaused(true); if (R.world) R.world.def.scnId = null; // 끝난 시나리오는 이어 하기에서 다시 평가하지 않음
  const g = r.minRange && R.world.targets.find((x) => x.id === r.minRange.id), nm = g ? (g.name || (en ? 'fishing boat' : '어선')) : '-';
  const fa = r.firstAction;
  const html = `<div class="result ${r.pass ? 'ok' : 'ng'}"><b class="verdict">${r.pass ? (en ? 'PASS' : '합격') : en ? 'NOT PASSED' : '불합격'}${r.pass && r.warnN ? `<small class="vwarn">${en ? ' · rule check' : ' · 규칙 주의'}</small>` : ''}</b>
    <dl class="kv"><dt>${en ? 'Closest approach' : '가장 가까이 지난 거리'}</dt><dd>${r.minRange ? r.minRange.nm.toFixed(2) + ' NM' : '-'} · ${esc(nm)} · ${r.minRange ? mmss(r.minRange.t) : ''}</dd>
    ${r.bgMin ? `<dt>${en ? 'Closest surrounding ship (not graded)' : '주변 배와 가장 가까이(참고)'}</dt><dd>${r.bgMin.nm.toFixed(2)} NM · ${esc(r.bgMin.name || (en ? 'no AIS' : 'AIS 없는 배'))} · ${mmss(r.bgMin.t)}</dd>` : ''}
    <dt>${en ? 'First action' : '첫 조치'}</dt><dd>${fa ? `${mmss(fa.t)} · TCPA ${fa.tcpa != null ? fa.tcpa.toFixed(1) + ' min' : '-'} · ${fa.rng != null ? fa.rng.toFixed(2) + ' NM' : ''} · ${fa.dHdg >= 0 ? (en ? 'stbd ' : '우현 ') : en ? 'port ' : '좌현 '}${Math.abs(fa.dHdg).toFixed(0)}°${fa.dSpd < -0.5 ? ` · ${fa.dSpd.toFixed(1)} kn` : ''}` : en ? 'none' : '없음'}</dd>
    <dt>${en ? 'Within 0.3 NM (not graded)' : '0.3 NM 안 접근(참고)'}</dt><dd>${r.near03 && r.near03.n ? `${r.near03.n}${en ? ' time(s)' : '회'} · ${en ? 'total ' : '총 '}${mmss(r.near03.sec)}` : en ? 'none' : '없음'}</dd>
    <dt>${en ? 'Collision / grounding' : '충돌 / 좌초'}</dt><dd>${r.collision ? (en ? 'collision' : '충돌') : '-'} / ${r.grounding ? (en ? 'grounded' : '좌초') : '-'}</dd></dl>
    <ul class="notes">${r.notes.map((n) => `<li${n.warn ? ' class="warn"' : ''}>${esc(tl(n))}</li>`).join('')}</ul></div>`;
  const d = ownDlg('resDlg', en ? 'Result' : '결과', html, `<button class="btn" type="button" data-r="again">${en ? 'Try again' : '다시 하기'}</button><button class="btn" type="button" data-r="menu">${en ? 'Scenarios' : '시나리오 목록'}</button><button class="btn pri" type="button" data-r="cont">${en ? 'Keep sailing' : '계속 항해'}</button>`);
  let next = null;
  d.onclose = () => { if (next === 'again') runScenario(current); else if (next === 'menu') openStart(); else R.setPaused(false); next = null; };
  d.onclick = (e) => { if (e.target.closest('[data-x]')) { d.close(); return; } const b = e.target.closest('[data-r]'); if (!b) return; next = b.dataset.r === 'cont' ? null : b.dataset.r; d.close(); };
}

/* ---- 히든 시나리오(이스터에그 → 부산 북항 입출항) ---- */
const PORT_LV = ['easy', 'medium', 'hard'];
let portLevel = 'medium';
const ATTR = () => (lang() === 'en' ? 'Busan coastline & breakwaters: © OpenStreetMap contributors (ODbL). Some aids to navigation are a training layout, not for navigation.' : '부산항 해안선·방파제: © OpenStreetMap contributors (ODbL). 항로 표지 일부는 훈련용 가상 배치이며 항해용이 아님.');
export function startPort(mode, level = portLevel, o = {}) {
  const tu = window.Tutor; if (tu && tu.stop && window.RadarEdu && window.RadarEdu.active()) tu.stop(); /* 교육 중이면 교육을 끝내고 시작 */
  const def = portDef('BUSAN', mode, level, o.seed ?? ((Math.random() * 1e9) >>> 0));
  return runScenario(def, { ...o, level });
}
export function openPortMenu() {
  const R = window.Radar, en = lang() === 'en', recs = records(), P = PORTS.BUSAN;
  const LVn = (l) => (LVL[l] || LVL.medium)[en ? 1 : 0];
  const rec = (id) => { const r = recs[id]; if (!r) return ''; return `<span class="rec ${r.pass ? 'ok' : 'ng'}">${r.pass ? (en ? '✓ PASS' : '✓ 합격') : en ? '✗ not passed' : '✗ 불합격'} · ${r.nm != null ? r.nm.toFixed(2) + ' NM' : '-'} · ${esc(LVn(r.lv))}</span>`; };
  const card = (m) => `<button type="button" class="scard" data-port="${m}"><span class="sid">${m === 'IN' ? (en ? 'ARR' : '입항') : en ? 'DEP' : '출항'}</span><b>${esc(tl(P))} ${m === 'IN' ? (en ? 'arrival' : '입항') : en ? 'departure' : '출항'}</b><span class="sb">${m === 'IN' ? (en ? 'From WP.17 off Oryukdo through the breakwater entrance to the turning basin (stop at 3 kn or less).' : '오륙도 바깥 WP.17에서 방파제 입구를 지나 선회장까지(3 kn 이하로 정지).') : en ? 'From the turning basin out through the entrance, past the pilot station.' : '선회장에서 출발해 방파제 입구를 지나 도선점 바깥까지.'}</span>${rec('PORT-BUSAN-' + m)}</button>`;
  const html = `<div class="start"><p class="lead">${en ? `Narrow-water radar practice at 0.75–1.5 NM. Pass: no grounding or collision, other vessels at ${PORT_PASS_NM} NM or more, never off the channel for over 30 s, and arrive within the time limit.` : `좁은 항내에서 0.75~1.5 NM 거리로 레이더를 쓰는 연습이에요. 합격: 좌초·충돌 없이, 상대선과 ${PORT_PASS_NM} NM 이상, 항로를 30초 넘게 벗어나지 않고, 제한 시간 안에 도착.`}</p>
    <div class="lvl" role="group" aria-label="${en ? 'Difficulty' : '난이도'}"><b>${en ? 'Difficulty (traffic)' : '난이도(교통량)'}</b>${PORT_LV.map((l) => `<button type="button" class="btn${portLevel === l ? ' on' : ''}" data-plv="${l}">${LVn(l)}</button>`).join('')}</div>
    <div class="scards">${card('IN')}${card('OUT')}</div><p class="small attr">${esc(ATTR())}</p></div>`;
  const was = R.isPaused ? R.isPaused() : false; R.setPaused(true);
  const d = ownDlg('portDlg', en ? 'Hidden scenario' : '히든 시나리오', html, ''); let starting = false;
  d.onclose = () => { if (!starting) R.setPaused(was); };
  d.onclick = (e) => {
    if (e.target.closest('[data-x]')) { d.close(); return; }
    const lv = e.target.closest('[data-plv]'); if (lv) { portLevel = lv.dataset.plv; d.querySelectorAll('[data-plv]').forEach((b) => b.classList.toggle('on', b === lv)); return; }
    const c = e.target.closest('[data-port]'); if (c) { starting = true; d.close(); startPort(c.dataset.port, portLevel); }
  };
  return d;
}
function showPortBrief(def) {
  const R = window.Radar, en = lang() === 'en', again = !!(R.world && R.world.t > 1), was = again && R.isPaused(); R.setPaused(true);
  const body = `<p class="rule-chip">COLREG 9 · IALA B</p><p>${def.mode === 'IN' ? (en ? 'Arrival: WP.17 → 348° → pilot station → 287° → B/W → 305° → turning basin. Stop in the basin at 3 kn or less.' : '입항: WP.17 → 348° → 도선점 → 287° → B/W → 305° → 선회장. 선회장 원 안에서 3 kn 이하로 멈추면 끝이에요.') : en ? 'Departure: turning basin → 125° → B/W → 107° → pilot station → 168°. Ends 1 NM past the pilot station.' : '출항: 선회장 → 125° → B/W → 107° → 도선점 → 168°. 도선점을 지나 1 NM 가면 끝이에요.'}</p>
    <p>${en ? 'Tips: true motion (TM) with North-up is easier here. Keep to the starboard side, use PI lines for the channel and VRM for the breakwaters. Entrance: red light (Middle B/W) and green light (Jodo B/W). Map: dashed channel limits and waypoints (MAP · CHANNEL).' : '도움말: 진운동(TM)·N.Up이 편해요. 항로 오른쪽으로 붙어 가고, PI 선으로 항로를, VRM으로 방파제 거리를 지켜보세요. 입구: 빨강 등(중앙 방파제)·초록 등(조도 방파제). 레이더 맵에 항로 경계(점선)와 변침점이 나와요(MAP · 항로).'}</p>
    <p class="small">${en ? `Pass: no grounding/collision, other vessels ≥ ${PORT_PASS_NM} NM, never off the channel > 30 s, arrive within ${def.durationMin} min. PI line colours follow IALA B for this scenario.` : `합격: 좌초·충돌 없음, 상대선 ${PORT_PASS_NM} NM 이상, 항로 이탈 30초 이내, ${def.durationMin}분 안에 도착. 이 시나리오 동안 PI 선 색은 IALA B(한국)로 바꿔요.`}</p><p class="small attr">${esc(ATTR())}</p>`;
  const d = ownDlg('briefDlg', tl(def), body, `<button class="btn pri" type="button" data-go="1">${en ? 'Start' : '시작'}</button>`);
  d.onclick = (e) => { if (e.target.closest('[data-go]') || e.target.closest('[data-x]')) d.close(); };
  d.onclose = () => R.setPaused(was);
}
function attachPortEval(def) {
  const R = window.Radar, log = createPortLog(PORTS[def.portId], def.mode); curLog = log; let lastS = -1;
  R.setLog((w) => { if (w.t - lastS >= 1) { lastS = w.t; log.sample(w); } }, null);
  R.setScenarioTick(() => { if (lastResult) return; const r = log.result(); if (r.arrived || r.collision || r.grounding || r.timeout) finishPort(evaluatePort(r)); });
}
function finishPort(r) {
  const R = window.Radar, en = lang() === 'en', def = current; lastResult = r;
  if (def && !eduOn()) saveRecord(def.id, { pass: r.pass, minRange: r.minRange, warnN: r.warnN }, def.level);
  R.setScenarioTick(null); R.setLog(null); R.setPaused(true); if (R.world) R.world.def.scnId = null;
  const g = r.minRange && R.world.targets.find((x) => x.id === r.minRange.id), nm = g ? g.name || g.id : '-';
  const html = `<div class="result ${r.pass ? 'ok' : 'ng'}"><b class="verdict">${r.pass ? (en ? 'PASS' : '합격') : en ? 'NOT PASSED' : '불합격'}${r.pass && r.warnN ? `<small class="vwarn">${en ? ' · rule check' : ' · 규칙 주의'}</small>` : ''}</b>
    ${r.reasons.length ? `<ul class="notes">${r.reasons.map((x) => `<li class="warn">${esc(tl(x))}</li>`).join('')}</ul>` : ''}
    <dl class="kv"><dt>${en ? 'Off the channel' : '항로 이탈'}</dt><dd>${r.off.n ? `${r.off.n}${en ? ' time(s)' : '회'} · ${en ? 'longest' : '가장 길게'} ${mmss(r.off.longestS)} · ${en ? 'max XTD' : '최대 XTD'} ${r.off.maxXtd.toFixed(2)} NM` : en ? 'none' : '없음'}</dd>
    <dt>${en ? 'Closest other vessel' : '상대선과 가장 가까이'}</dt><dd>${r.minRange ? `${r.minRange.nm.toFixed(2)} NM · ${esc(nm)} · ${mmss(r.minRange.t)}` : '-'}</dd>
    <dt>${en ? 'Within 0.3 NM (not graded)' : '0.3 NM 안 접근(참고)'}</dt><dd>${r.near03 && r.near03.n ? `${r.near03.n}${en ? ' time(s)' : '회'} · ${en ? 'total ' : '총 '}${mmss(r.near03.sec)}` : en ? 'none' : '없음'}</dd>
    <dt>${en ? 'Max speed (recorded)' : '최대 속력(기록)'}</dt><dd>${r.maxSog.toFixed(1)} kn</dd>
    <dt>${en ? 'Waypoints' : '변침점 통과'}</dt><dd>${r.wpTimes.map((w) => `${esc(w.name)} ${mmss(w.t)}`).join(' · ') || '-'}${r.arrived ? ` · ${en ? 'arrived' : '도착'} ${mmss(r.arriveT)}` : ''}</dd>
    <dt>${en ? 'Collision / grounding' : '충돌 / 좌초'}</dt><dd>${r.collision ? (en ? 'collision' : '충돌') : '-'} / ${r.grounding ? (en ? 'grounded' : '좌초') : '-'}</dd></dl>
    <ul class="notes">${r.notes.map((n) => `<li${n.warn ? ' class="warn"' : ''}>${esc(tl(n))}</li>`).join('')}</ul><p class="small attr">${esc(ATTR())}</p></div>`;
  const d = ownDlg('resDlg', en ? 'Result' : '결과', html, `<button class="btn" type="button" data-r="again">${en ? 'Try again' : '다시 하기'}</button><button class="btn" type="button" data-r="menu">${en ? 'Hidden scenarios' : '히든 시나리오'}</button><button class="btn pri" type="button" data-r="cont">${en ? 'Keep sailing' : '계속 항해'}</button>`);
  let next = null;
  d.onclose = () => { if (next === 'again') startPort(def.mode, def.level); else if (next === 'menu') openPortMenu(); else R.setPaused(false); next = null; };
  d.onclick = (e) => { if (e.target.closest('[data-x]')) { d.close(); return; } const b = e.target.closest('[data-r]'); if (!b) return; next = b.dataset.r === 'cont' ? null : b.dataset.r; d.close(); };
}
