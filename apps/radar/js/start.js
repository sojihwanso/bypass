/* 시작 화면(시나리오 5개·자유 항해·이어 하기) · 시나리오 안내 · 결과 화면 */
import { SCENARIOS, freeSetup, createLog, evaluate } from './scenarios.js';
import { loadLand } from './coast.js';
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
export function initStart(uiRef) { ui = uiRef; window.RadarStart = openStart; return { openStart, startScenario, lastResult: () => lastResult, finishNow: () => curLog && !lastResult && finish(evaluate(curLog.result())) }; }

export async function openStart(o = {}) {
  const R = window.Radar, en = lang() === 'en';
  const card = (s) => `<button type="button" class="scard" data-scn="${s.id}"><span class="sid">${s.id}</span><b>${esc(tl(s))}</b><span class="rule">COLREG ${s.rule}</span><span class="sb">${esc(tl(s.brief))}</span><span class="why" hidden></span></button>`;
  const html = `<div class="start">
    <p class="lead">${en ? 'Pick a collision-avoidance scenario. The radar starts in STANDBY: switch it on and wait for the warm-up.' : '충돌 회피 시나리오를 고르세요. 레이더는 대기(STBY)로 시작해요. 송신을 켜고 예열을 기다리세요.'}</p>
    <div class="scards">${SCENARIOS.map(card).join('')}</div>
    <div class="free"><b>${en ? 'Free navigation' : '자유 항해'}</b>
      <label>${en ? 'Sea state' : '해상 상태'} <select id="fSea">${[0, 1, 2, 3, 4, 5, 6].map((v) => `<option${v === 2 ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>${en ? 'Ships' : '선박 수'} <select id="fN">${[0, 2, 4, 6, 8].map((v) => `<option${v === 4 ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label><input type="checkbox" id="fRain"> ${en ? 'Rain' : '비'}</label>
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
    starting = true;
    const c = e.target.closest('[data-scn]'); if (c && !c.disabled) { dlg.close(); startScenario(c.dataset.scn); return; }
    const b = e.target.closest('[data-start]'); if (!b) { starting = false; return; }
    if (b.dataset.start === 'resume') { dlg.close(); current = null; R.setLog(null); R.setScenarioTick(null); R.resume(); return; }
    const scn = freeSetup({ lat: 33.5, lon: 124.6, nTargets: +dlg.querySelector('#fN').value, sea: +dlg.querySelector('#fSea').value, rain: dlg.querySelector('#fRain').checked, seed: +dlg.querySelector('#fSeed').value || 1 });
    dlg.close(); runScenario(scn, { free: true, skipBrief: true });
  };
  // S5: 해안선을 못 불러오면 비활성
  const s5 = SCENARIOS.find((s) => s.needsCoast), L = await loadLand({ lat0: s5.own.lat - 0.6, lat1: s5.own.lat + 0.6, lon0: s5.own.lon - 0.75, lon1: s5.own.lon + 0.75 }, o.fetchText);
  if (!L.ok) { const b = dlg.querySelector(`[data-scn="${s5.id}"]`); if (b) { b.disabled = true; const w = b.querySelector('.why'); w.hidden = false; w.textContent = en ? 'Coastline data could not be loaded.' : '해안선 데이터를 불러오지 못해 시작할 수 없어요.'; } }
  return dlg;
}

export function startScenario(id, o = {}) { const s = SCENARIOS.find((x) => x.id === id); return runScenario(s, o); }

function runScenario(scn, o = {}) {
  const R = window.Radar, en = lang() === 'en';
  lastResult = null; current = scn; R.setPaused(false);
  R.startWorld({ name: o.free ? (en ? 'Free navigation' : '자유 항해') : `${scn.id} · ${tl(scn)}`, own: scn.own, targets: scn.targets, weather: scn.weather, aids: scn.aids, marks: scn.marks || [], needsCoast: !!scn.needsCoast });
  R.setRadar(o.free || o.keepTx ? 'tx' : 'stby');
  if (scn.message) R.ais().addMessage({ ...scn.message, t: 0 });
  if (o.free) { R.setLog(null); R.setScenarioTick(null); return; }
  const log = createLog(scn); curLog = log; let lastS = -1;
  R.setLog((w) => { if (w.t - lastS >= 1) { lastS = w.t; log.sample(w); } });
  R.setScenarioTick((w) => {
    if (lastResult) return; const r = log.result();
    const P = makeProj(w.own.lat, w.own.lon), ov = velXY(w.own.cog, w.own.sog);
    const clear = w.t > 300 && w.targets.every((g) => { const x = P.x(g.lon), y = P.y(g.lat); return Math.hypot(x, y) > 2 && cpaTcpa({ x: 0, y: 0 }, ov, { x, y }, velXY(g.cog, g.sog)).tcpa < 0; });
    if (r.collision || r.grounding || clear || w.t >= scn.durationMin * 60) finish(evaluate(r));
  });
  if (!o.skipBrief) {
    R.setPaused(true);
    const d = ownDlg('briefDlg', `${scn.id} · ${tl(scn)}`, `<p class="rule-chip">COLREG ${scn.rule}</p><p>${esc(tl(scn.brief))}</p><p class="small">${en ? 'Pass: every ship passes at 0.3 NM or more, no collision, no grounding.' : '합격: 모든 상대선과 0.3 NM 이상 떨어져 지나가고, 충돌·좌초가 없으면 돼요.'}</p>`, `<button class="btn pri" type="button" data-go="1">${en ? 'Start' : '시작'}</button>`);
    d.onclick = (e) => { if (e.target.closest('[data-go]') || e.target.closest('[data-x]')) d.close(); };
    d.onclose = () => R.setPaused(false);
  }
}

function finish(r) {
  const R = window.Radar, en = lang() === 'en'; lastResult = r; R.setScenarioTick(null); R.setLog(null); R.setPaused(true);
  const g = r.minRange && R.world.targets.find((x) => x.id === r.minRange.id), nm = g ? (g.name || (en ? 'fishing boat' : '어선')) : '-';
  const fa = r.firstAction;
  const html = `<div class="result ${r.pass ? 'ok' : 'ng'}"><b class="verdict">${r.pass ? (en ? 'PASS' : '합격') : en ? 'NOT PASSED' : '불합격'}</b>
    <dl class="kv"><dt>${en ? 'Closest approach' : '가장 가까이 지난 거리'}</dt><dd>${r.minRange ? r.minRange.nm.toFixed(2) + ' NM' : '-'} · ${esc(nm)} · ${r.minRange ? mmss(r.minRange.t) : ''}</dd>
    <dt>${en ? 'First action' : '첫 조치'}</dt><dd>${fa ? `${mmss(fa.t)} · TCPA ${fa.tcpa != null ? fa.tcpa.toFixed(1) + ' min' : '-'} · ${fa.rng != null ? fa.rng.toFixed(2) + ' NM' : ''} · ${fa.dHdg >= 0 ? (en ? 'stbd ' : '우현 ') : en ? 'port ' : '좌현 '}${Math.abs(fa.dHdg).toFixed(0)}°${fa.dSpd < -0.5 ? ` · ${fa.dSpd.toFixed(1)} kn` : ''}` : en ? 'none' : '없음'}</dd>
    <dt>${en ? 'Collision / grounding' : '충돌 / 좌초'}</dt><dd>${r.collision ? (en ? 'collision' : '충돌') : '-'} / ${r.grounding ? (en ? 'grounded' : '좌초') : '-'}</dd></dl>
    <ul class="notes">${r.notes.map((n) => `<li>${esc(tl(n))}</li>`).join('')}</ul></div>`;
  const d = ownDlg('resDlg', en ? 'Result' : '결과', html, `<button class="btn" type="button" data-r="again">${en ? 'Try again' : '다시 하기'}</button><button class="btn" type="button" data-r="menu">${en ? 'Scenarios' : '시나리오 목록'}</button><button class="btn pri" type="button" data-r="cont">${en ? 'Keep sailing' : '계속 항해'}</button>`);
  let next = null;
  d.onclose = () => { if (next === 'again') runScenario(current); else if (next === 'menu') openStart(); else R.setPaused(false); next = null; };
  d.onclick = (e) => { if (e.target.closest('[data-x]')) { d.close(); return; } const b = e.target.closest('[data-r]'); if (!b) return; next = b.dataset.r === 'cont' ? null : b.dataset.r; d.close(); };
}
