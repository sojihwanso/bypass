/* 시작 화면(시나리오 5개·자유 항해·이어 하기) · 시나리오 안내 · 결과 화면 */
import { SCENARIOS, freeSetup, createLog, evaluate } from './scenarios.js';
import { loadLand, pointInLand } from './coast.js';
import { REGIONS, pickStart } from './place.js';
import { makeTraffic, LEVELS } from './traffic.js';
import { rollWeather, createWeatherRun, WX_CAP } from './weather.js';
import { S, saveSettings } from './state.js';
import { makeProj, velXY, cpaTcpa } from './geo.js';
import { t, tl, lang } from './i18n.js';

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
export function initStart(uiRef) { ui = uiRef; window.RadarStart = openStart; window.RadarBrief = () => current && !lastResult && showBrief(current); return { openStart, startScenario, resumeVoyage, lastResult: () => lastResult, finishNow: () => curLog && !lastResult && finish(evaluate(curLog.result())) }; }

export async function openStart(o = {}) {
  const R = window.Radar, en = lang() === 'en';
  const recs = records(), LV = (l) => (LVL[l] || LVL.none)[en ? 1 : 0];
  const rec = (s) => { const r = recs[s.id]; if (!r) return ''; return `<span class="rec ${r.pass ? 'ok' : 'ng'}">${r.pass ? (en ? '✓ PASS' : '✓ 합격') : en ? '✗ not passed' : '✗ 불합격'}${r.warnN ? (en ? ' · rule check' : ' · 규칙 주의') : ''} · ${r.nm != null ? r.nm.toFixed(2) + ' NM' : '-'} · ${esc(LV(r.lv))}${r.best ? (en ? ` · best ${r.best.toFixed(2)} NM` : ` · 최고 ${r.best.toFixed(2)} NM`) : ''}</span>`; };
  const card = (s) => `<button type="button" class="scard" data-scn="${s.id}"><span class="sid">${s.id}</span><b>${esc(tl(s))}</b><span class="rule">COLREG ${s.rule}</span><span class="sb">${esc(tl(s.brief))}</span>${rec(s)}<span class="why" hidden></span></button>`;
  const html = `<div class="start">
    <p class="lead">${en ? 'Pick a collision-avoidance scenario. The radar starts in STANDBY: switch it on and wait for the warm-up.' : '충돌 회피 시나리오를 고르세요. 레이더는 대기(STBY)로 시작해요. 송신을 켜고 예열을 기다리세요.'}</p>
    <button type="button" class="edu-card" data-start="edu"><img src="../ecdis/edu/dodo_explain.webp" alt="" width="56" height="56"><span><b>${en ? 'Training course with Dodo (Korean)' : '도도와 함께하는 교육 과정'}</b><small>${en ? 'Five short courses, step by step.' : '처음이라면 여기부터! 레이더 켜기부터 충돌 회피까지 5과정 50단계를 하나씩 따라 해요.'}</small></span></button>
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
  R.setPaused(true);
  let starting = false;
  dlg.onclose = () => { if (!starting) R.setPaused(false); };
  dlg.onclick = (e) => {
    if (e.target.closest('[data-close]')) { dlg.close(); return; }
    const lv = e.target.closest('[data-level]'); if (lv) { S.sim.level = lv.dataset.level; saveSettings(); dlg.querySelectorAll('[data-level]').forEach((b) => b.classList.toggle('on', b === lv)); return; }
    starting = true;
    const c = e.target.closest('[data-scn]'); if (c && !c.disabled) { dlg.close(); startScenario(c.dataset.scn); return; }
    const b = e.target.closest('[data-start]'); if (!b) { starting = false; return; }
    if (b.dataset.start === 'edu') { dlg.close(); R.setPaused(false); window.Tutor && window.Tutor.menu(); return; }
    if (b.dataset.start === 'resume') { dlg.close(); resumeVoyage(); return; }
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
  let def = scn, region = null;
  if (o.place !== false && !scn.needsCoast) {
    const cand = o.region ? REGIONS.find((r) => r.id === o.region) : REGIONS[Math.floor(rnd() * REGIONS.length)];
    const L = await loadLand(around((cand.box.lat0 + cand.box.lat1) / 2, (cand.box.lon0 + cand.box.lon1) / 2), o.fetchText);
    if (L.ok) { const p = pickStart({ def: scn, region: cand, rings: L.rings, rnd }); if (p.ok) { def = p.def; region = cand; } }
  }
  const L2 = await loadLand(around(def.own.lat, def.own.lon), o.fetchText), P = makeProj(def.own.lat, def.own.lon);
  const onLand = (lat, lon) => L2.ok && pointInLand(L2.rings, lat, lon);
  const bg = makeTraffic({ level: o.level ?? S.sim.level, own: { ...def.own, kn: def.own.kn ?? 14 }, rnd }).filter((g) => [0, 0.25, 0.5].every((h) => { const v = velXY(g.hdg, g.kn), x = P.x(g.lon) + v.vx * h, y = P.y(g.lat) + v.vy * h; return !onLand(P.lat(y), P.lon(x)); }));
  const wxOn = S.sim.weatherOn || scn.fixedWeather;
  const lvl = o.level ?? S.sim.level, weather = wxOn ? rollWeather(rnd, scn.fixedWeather ? def.weather : null, def.own, WX_CAP[lvl] || WX_CAP.hard) : { kind: 'clear', fog: false, visNM: 10, sea: 1, windFrom: Math.round(rnd() * 360), windMs: 3, rain: [], ducting: false, interference: false };
  if (def.weather && def.weather.current) weather.current = { ...def.weather.current };
  return { def: { ...def, targets: [...def.targets, ...bg] }, weather, region, rnd, level: o.level ?? S.sim.level };
}

async function runScenario(scn, o = {}) {
  const R = window.Radar, en = lang() === 'en';
  lastResult = null; current = scn;
  const pr = await prepare(scn, o), def = pr.def; R.setPaused(false);
  const where = pr.region ? ` · ${tl(pr.region)}` : '';
  R.startWorld({ name: (o.free ? (en ? 'Free navigation' : '자유 항해') : `${scn.id} · ${tl(scn)}`) + where, own: def.own, targets: def.targets, weather: pr.weather, aids: def.aids, marks: def.marks || [], needsCoast: !!scn.needsCoast, traffic: { level: pr.level }, save: true, scnId: o.free ? null : scn.id });
  R.setWeatherRun(createWeatherRun({ rnd: pr.rnd, enabled: S.sim.weatherOn, cap: WX_CAP[pr.level] || WX_CAP.hard }));
  R.setRadar('stby'); /* 어떻게 시작하든 STBY(송신 → 예열 5초) */
  if (scn.message) R.ais().addMessage({ ...scn.message, t: 0 });
  if (o.free) { R.setLog(null); R.setScenarioTick(null); return; }
  attachEval(def);
  if (!o.skipBrief) showBrief(scn);
}
/* 브리핑(시작할 때, 헤더의 시나리오 이름을 눌러 다시 볼 때). 열려 있는 동안 정지 */
function showBrief(scn) {
  const R = window.Radar, en = lang() === 'en', again = !!(R.world && R.world.t > 1), was = again && R.isPaused();
  {
    R.setPaused(true);
    const d = ownDlg('briefDlg', `${scn.id} · ${tl(scn)}`, `<p class="rule-chip">COLREG ${scn.rule}</p><p>${esc(tl(scn.brief))}</p><p class="small">${en ? 'Pass: every scenario ship passes at 0.3 NM or more, no collision, no grounding. Surrounding traffic keeps clear of you on its own and is not graded for distance.' : '합격: 시나리오 상대선과 모두 0.3 NM 이상 떨어져 지나가고, 충돌·좌초가 없으면 돼요. 주변 배(난이도)는 자선을 알아서 피하고, 거리는 합격 판정에 넣지 않아요.'}</p>`, `<button class="btn pri" type="button" data-go="1">${again ? (en ? 'Continue' : '계속') : en ? 'Start' : '시작'}</button>`);
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
    const P = makeProj(w.own.lat, w.own.lon), ov = velXY(w.own.cog, w.own.sog);
    const clear = w.t > 300 && w.targets.filter((g) => !String(g.id).startsWith('bg')).every((g) => { const x = P.x(g.lon), y = P.y(g.lat); return Math.hypot(x, y) > 2 && cpaTcpa({ x: 0, y: 0 }, ov, { x, y }, velXY(g.cog, g.sog)).tcpa < 0; });
    if (r.collision || r.grounding || clear || w.t >= def.durationMin * 60) finish(evaluate(r));
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
function records() { try { return JSON.parse(localStorage.getItem(REC_KEY) || '{}') || {}; } catch (e) { return {}; } }
function saveRecord(id, r, lv) { try { const all = records(), old = all[id] || {}, nm = r.minRange ? r.minRange.nm : null; all[id] = { pass: r.pass, nm, warnN: r.warnN || 0, lv, d: Date.now(), n: (old.n || 0) + 1, best: r.pass && nm != null ? Math.max(old.best || 0, nm) : old.best || null }; localStorage.setItem(REC_KEY, JSON.stringify(all)); } catch (e) {} }
function finish(r) {
  const R = window.Radar, en = lang() === 'en'; lastResult = r; if (current && current.id && current.id !== 'FREE') saveRecord(current.id, r, (R.world && R.world.def.traffic && R.world.def.traffic.level) || 'none'); R.setScenarioTick(null); R.setLog(null); R.setPaused(true); if (R.world) R.world.def.scnId = null; // 끝난 시나리오는 이어 하기에서 다시 평가하지 않음
  const g = r.minRange && R.world.targets.find((x) => x.id === r.minRange.id), nm = g ? (g.name || (en ? 'fishing boat' : '어선')) : '-';
  const fa = r.firstAction;
  const html = `<div class="result ${r.pass ? 'ok' : 'ng'}"><b class="verdict">${r.pass ? (en ? 'PASS' : '합격') : en ? 'NOT PASSED' : '불합격'}${r.pass && r.warnN ? `<small class="vwarn">${en ? ' · rule check' : ' · 규칙 주의'}</small>` : ''}</b>
    <dl class="kv"><dt>${en ? 'Closest approach' : '가장 가까이 지난 거리'}</dt><dd>${r.minRange ? r.minRange.nm.toFixed(2) + ' NM' : '-'} · ${esc(nm)} · ${r.minRange ? mmss(r.minRange.t) : ''}</dd>
    ${r.bgMin ? `<dt>${en ? 'Closest surrounding ship (not graded)' : '주변 배와 가장 가까이(참고)'}</dt><dd>${r.bgMin.nm.toFixed(2)} NM · ${esc(r.bgMin.name || (en ? 'no AIS' : 'AIS 없는 배'))} · ${mmss(r.bgMin.t)}</dd>` : ''}
    <dt>${en ? 'First action' : '첫 조치'}</dt><dd>${fa ? `${mmss(fa.t)} · TCPA ${fa.tcpa != null ? fa.tcpa.toFixed(1) + ' min' : '-'} · ${fa.rng != null ? fa.rng.toFixed(2) + ' NM' : ''} · ${fa.dHdg >= 0 ? (en ? 'stbd ' : '우현 ') : en ? 'port ' : '좌현 '}${Math.abs(fa.dHdg).toFixed(0)}°${fa.dSpd < -0.5 ? ` · ${fa.dSpd.toFixed(1)} kn` : ''}` : en ? 'none' : '없음'}</dd>
    <dt>${en ? 'Collision / grounding' : '충돌 / 좌초'}</dt><dd>${r.collision ? (en ? 'collision' : '충돌') : '-'} / ${r.grounding ? (en ? 'grounded' : '좌초') : '-'}</dd></dl>
    <ul class="notes">${r.notes.map((n) => `<li${n.warn ? ' class="warn"' : ''}>${esc(tl(n))}</li>`).join('')}</ul></div>`;
  const d = ownDlg('resDlg', en ? 'Result' : '결과', html, `<button class="btn" type="button" data-r="again">${en ? 'Try again' : '다시 하기'}</button><button class="btn" type="button" data-r="menu">${en ? 'Scenarios' : '시나리오 목록'}</button><button class="btn pri" type="button" data-r="cont">${en ? 'Keep sailing' : '계속 항해'}</button>`);
  let next = null;
  d.onclose = () => { if (next === 'again') runScenario(current); else if (next === 'menu') openStart(); else R.setPaused(false); next = null; };
  d.onclick = (e) => { if (e.target.closest('[data-x]')) { d.close(); return; } const b = e.target.closest('[data-r]'); if (!b) return; next = b.dataset.r === 'cont' ? null : b.dataset.r; d.close(); };
}
