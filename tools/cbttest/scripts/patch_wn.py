import sys
p='site/index.html'; s=open(p,encoding='utf-8').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:60],s.count(a)); s=s.replace(a,b)

# CSS
css = r'''
/* wrong-answer note */
.navtab{background:transparent;border:1px solid rgba(255,255,255,.28);color:inherit;border-radius:8px;height:34px;padding:0 12px;display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;white-space:nowrap}
.navtab:hover,.navtab.on{background:rgba(255,255,255,.14)}
.navtab svg{width:16px;height:16px}
.navtab .cnt{font-family:var(--f-mono);font-size:11px;background:var(--bad);color:#fff;border-radius:999px;padding:0 6px;line-height:17px}
.wn-tabs{display:flex;gap:6px;border-bottom:1px solid var(--rule);margin:4px 0 18px}
.wn-tabs button{background:none;border:0;border-bottom:2.5px solid transparent;padding:9px 6px 10px;margin-right:12px;font-size:15px;font-weight:600;color:var(--muted)}
.wn-tabs button.on{color:var(--ink);border-bottom-color:var(--kr)}
.wn-tabs b{font-family:var(--f-mono);font-size:12px;margin-left:4px;color:var(--muted);font-weight:500}
.wn-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}
.wn-bar .sp{flex:1}
.wn-bar label{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;color:var(--muted)}
.wn-list{display:grid;gap:14px}
.wn-card .opt{cursor:default}
.wn-card .opt:hover{border-color:var(--rule)}
.wn-card .opt.right:hover{border-color:var(--ok)}
.wn-card .opt.wrong:hover{border-color:var(--bad)}
.wn-meta{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin-top:12px;font-size:12.5px;color:var(--muted)}
.wn-meta .sp{flex:1}
.wn-del{background:none;border:1px solid var(--rule);border-radius:7px;padding:4px 10px;font-size:12.5px;color:var(--muted)}
.wn-del:hover{color:var(--bad);border-color:var(--bad)}
.wn-fixed{font-size:12px;font-weight:600;padding:2px 9px;border-radius:999px;background:var(--ok-bg);color:var(--ok)}
.wn-empty{background:var(--surface);border:1px dashed var(--rule);border-radius:14px;padding:34px 20px;text-align:center;color:var(--muted)}
.wn-empty b{display:block;color:var(--ink);font-size:16px;margin-bottom:6px}
.wn-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}
.wn-stats div{background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:14px 16px}
.wn-stats b{display:block;font-family:var(--f-mono);font-size:24px;font-weight:600}
.wn-stats span{font-size:12.5px;color:var(--muted)}
.wn-sub{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:18px}
.wn-sub div{background:var(--surface);border:1px solid var(--rule);border-left:4px solid var(--c);border-radius:10px;padding:10px 14px}
.wn-sub b{color:var(--c)}
.wn-sub p{font-family:var(--f-mono);font-size:13px;margin-top:2px}
.wn-note{font-size:12.5px;color:var(--muted);margin-top:14px}
.htbl td,.htbl th{white-space:nowrap}
@media (max-width:640px){.wn-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.navtab .lbl{display:none}}
'''
rep('@media (prefers-reduced-motion:reduce)', css.strip()+'\n@media (prefers-reduced-motion:reduce)')

# header button
rep('<div class="sp"></div>\n    <button class="iconbtn" id="themeBtn"',
    '<div class="sp"></div>\n    <button class="navtab" id="wnBtn" type="button" aria-label="오답노트"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M9 9l6 6M15 9l-6 6"/></svg><span class="lbl">오답노트</span><span class="cnt" id="wnCnt" hidden></span></button>\n    <button class="iconbtn" id="themeBtn"')

# judge: record
rep("function judge(it, k){\n  const ok = isRight(it, k);", "function judge(it, k){\n  const ok = isRight(it, k);\n  noteResult(it, k);")

# renderQuiz route for flat sessions
rep("if (S.mode !== 4){ r.push(", "if (S.mode !== 4 && !S.flat){ r.push(")

# renderResult: save once
rep("  setRoute([{ t:'처음', go: home }, { t: S.title + ' 결과' }]);",
"""  if (!S.saved){
    S.saved = true;
    if (S.mode === 2 || S.mode === 3) S.items.forEach((it, k) => noteResult(it, S.ans[k]));
    const vm = verdict.match(/class="verdict [a-z]+">([^<]+)</);
    saveHist({ t: Date.now(), m: S.mode, title: S.title, meta: S.meta, n: totalN, ok: totalOk,
      sc: S.mode === 4 ? Math.round(totalOk / Math.max(1, totalN) * 100) : avg, v: vm ? vm[1] : '',
      subs: rowsData.map(r => [r.sub, r.n, r.ok]), used: S.limit ? Math.round(S.used ?? S.limit) : null });
  }
  setRoute([{ t:'처음', go: home }, { t: S.title + ' 결과' }]);""")
rep("S.done = false; S.cur = 0; S.used = null; S.timeUp = false;", "S.done = false; S.cur = 0; S.used = null; S.timeUp = false; S.saved = false;")
rep("title: '오답·△ 다시 풀기', meta:", "flat: true, title: '오답·△ 다시 풀기', meta:")

js = r'''
/* ---------- 오답노트 · 응시 기록 (이 브라우저의 localStorage에만 저장) ---------- */
const WN_KEY = 'hgs-wrongnote-v1', HIST_KEY = 'hgs-history-v1';
const MODE_NAME = { 1:'바로 채점', 2:'과목 모의고사', 3:'회차 모의고사', 4:'전 회차 무작위' };
let storeOK = true;
function lsGet(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e) { storeOK = false; return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e) { storeOK = false; return false; } }
function itKey(it){ return [it.y, it.r, it.g, it.p, it.sub, it.q.n].join('|'); }
function noteResult(it, a){
  if (a == null || !it.q.a) return;
  const W = lsGet(WN_KEY, {}), k = itKey(it);
  if (isRight(it, a)){
    if (W[k] && !W[k].fx){ W[k].fx = Date.now(); lsSet(WN_KEY, W); updWnCnt(); }
    return;
  }
  const e = W[k] || { y: it.y, r: it.r, g: it.g, p: it.p, s: it.sub, n: it.q.n, c: 0, t0: Date.now() };
  e.a = a; e.c++; e.t = Date.now(); delete e.fx;
  W[k] = e; lsSet(WN_KEY, W); updWnCnt();
}
function saveHist(h){ const H = lsGet(HIST_KEY, []); H.unshift(h); if (H.length > 300) H.length = 300; lsSet(HIST_KEY, H); }
function updWnCnt(){
  const c = document.getElementById('wnCnt'); if (!c) return;
  const n = Object.values(lsGet(WN_KEY, {})).filter(e => !e.fx).length;
  c.hidden = !n; c.textContent = n > 999 ? '999+' : n;
}
function fmtDate(t){ const d = new Date(t), z = x => (x < 10 ? '0' : '') + x; return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; }
function resolveNote(e){
  const m = idx[e.y] && idx[e.y][e.r + '-' + e.g], qs = m && m[e.p] && m[e.p][e.s];
  const q = qs && qs.find(x => x.n === e.n);
  return q ? mkItem(e.y, e.r, e.g, e.p, e.s, q) : null;
}
let wnTab = 'note', wnSub = '전체', wnHideFixed = false, wnShow = 30;
async function wrongNote(){
  stopTimer(); session = null; closeLayer(); scrollTop();
  setRoute([{ t:'처음', go: home }, { t:'오답노트' }]);
  document.getElementById('wnBtn').classList.add('on');
  app.innerHTML = viewHead('오답노트', '이 브라우저에 저장된 내 풀이 기록입니다.') + '<p class="loading">기록을 불러오는 중…</p>';
  try { await loadAll(); } catch(e) { app.querySelector('.loading').textContent = '문제 파일을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'; return; }
  drawWn();
}
function drawWn(){
  const W = lsGet(WN_KEY, {}), H = lsGet(HIST_KEY, []);
  const all = Object.entries(W).map(([k, e]) => ({ k, e, it: resolveNote(e) })).filter(x => x.it).sort((a, b) => b.e.t - a.e.t);
  const open = all.filter(x => !x.e.fx);
  const head = viewHead('오답노트', '틀린 문제와 응시 기록은 <b>이 브라우저에만</b> 저장됩니다. 다른 기기·브라우저와 공유되지 않고, 브라우저 사이트 데이터를 지우면 함께 지워집니다.');
  const tabs = `<div class="wn-tabs" role="tablist"><button type="button" data-t="note" class="${wnTab === 'note' ? 'on' : ''}">오답노트<b>${open.length}</b></button><button type="button" data-t="hist" class="${wnTab === 'hist' ? 'on' : ''}">응시 기록<b>${H.length}</b></button></div>`;
  const warn = storeOK ? '' : '<div class="caution" role="note">' + ICON_WARN + '<div><p><b>저장 불가</b> 이 브라우저에서는 기록을 저장할 수 없습니다(사생활 보호 모드 등).</p></div></div>';
  app.innerHTML = head + warn + tabs + '<div id="wnBody"></div>';
  app.querySelectorAll('.wn-tabs button').forEach(b => b.onclick = () => { wnTab = b.dataset.t; drawWn(); });
  if (wnTab === 'note') drawNoteBody(all); else drawHistBody(H);
}
function drawNoteBody(all){
  const body = document.getElementById('wnBody');
  if (!all.length){ body.innerHTML = '<div class="wn-empty"><b>아직 틀린 문제가 없습니다</b>어떤 풀이 방식으로 풀든 틀린 문제는 여기에 과목별로 모입니다.</div>'; return; }
  const cnt = {}; for (const x of all) if (!x.e.fx) cnt[x.e.s] = (cnt[x.e.s] || 0) + 1;
  const subs = SUBS.filter(s => all.some(x => x.e.s === s));
  if (wnSub !== '전체' && !subs.includes(wnSub)) wnSub = '전체';
  let list = all.filter(x => (wnSub === '전체' || x.e.s === wnSub) && !(wnHideFixed && x.e.fx));
  const subCards = `<div class="wn-sub">${subs.map(s => `<div style="--c:var(--${SUBC[s]})"><b>${s}</b><p>남은 오답 ${cnt[s] || 0} · 전체 ${all.filter(x => x.e.s === s).length}</p></div>`).join('')}</div>`;
  const seg = `<div class="seg" style="margin:0">${['전체', ...subs].map(s => `<button type="button" data-s="${s}" class="${wnSub === s ? 'on' : ''}">${s}</button>`).join('')}</div>`;
  const retryN = list.filter(x => !x.e.fx).length;
  const bar = `<div class="wn-bar">${seg}<span class="sp"></span><label><input type="checkbox" id="hideFx" ${wnHideFixed ? 'checked' : ''}> 다시 맞힌 문제 숨기기</label></div>
    <div class="wn-bar"><button class="btn btn-pri" type="button" id="wnRetry" ${retryN ? '' : 'disabled'}>${wnSub === '전체' ? '' : esc(wnSub) + ' '}오답 ${retryN}문항 다시 풀기</button><span class="sp"></span><button class="btn btn-ghost" type="button" id="wnClear">${wnSub === '전체' ? '오답노트 전체 비우기' : esc(wnSub) + ' 오답 비우기'}</button></div>`;
  const cards = list.slice(0, wnShow).map(x => noteCard(x)).join('');
  const more = list.length > wnShow ? `<button class="btn btn-ghost" type="button" id="wnMore" style="justify-self:center">더 보기 (${list.length - wnShow}문항 남음)</button>` : '';
  body.innerHTML = subCards + bar + `<div class="wn-list">${cards || '<div class="wn-empty">표시할 문제가 없습니다.</div>'}${more}</div>`;
  body.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { wnSub = b.dataset.s; wnShow = 30; drawWn(); });
  document.getElementById('hideFx').onchange = e => { wnHideFixed = e.target.checked; drawWn(); };
  const mo = document.getElementById('wnMore'); if (mo) mo.onclick = () => { wnShow += 30; drawWn(); };
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const W = lsGet(WN_KEY, {}); delete W[b.dataset.del]; lsSet(WN_KEY, W); updWnCnt(); drawWn(); });
  document.getElementById('wnRetry').onclick = () => {
    const its = list.filter(x => !x.e.fx).map(x => x.it);
    for (let i = its.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [its[i], its[j]] = [its[j], its[i]]; }
    document.getElementById('wnBtn').classList.remove('on');
    session = { mode: 1, flat: true, items: its, sections: [], cur: 0, ans: its.map(() => null), tri: its.map(() => false), done: false,
      title: '오답노트 다시 풀기', meta: (wnSub === '전체' ? '전 과목' : wnSub) + ' · ' + its.length + '문항' };
    renderQuiz();
  };
  document.getElementById('wnClear').onclick = () => {
    modal(`<h3>${wnSub === '전체' ? '오답노트를 모두 비울까요?' : esc(wnSub) + ' 오답을 비울까요?'}</h3><p class="sub">이 브라우저에 저장된 ${wnSub === '전체' ? '모든' : esc(wnSub)} 오답 기록이 지워지며 되돌릴 수 없습니다. 응시 기록은 그대로 남습니다.</p><div class="acts"><button class="btn btn-ghost" data-close>취소</button><button class="btn btn-pri" id="wnDo">비우기</button></div>`);
    document.getElementById('wnDo').onclick = () => {
      const W = lsGet(WN_KEY, {});
      for (const k of Object.keys(W)) if (wnSub === '전체' || W[k].s === wnSub) delete W[k];
      lsSet(WN_KEY, W); closeLayer(); updWnCnt(); drawWn();
    };
  };
}
function noteCard(x){
  const { it, e, k } = x, q = it.q, c = SUBC[it.sub];
  let body;
  if (q.img) body = '<div class="scan">' + q.img.map(rf => spriteHTML(rf, 'img')).join('') + '</div>';
  else body = '<div class="qtext">' + stemHTML(q.q) + '</div>' + (q.fig ? '<div class="figs">' + q.fig.map(rf => spriteHTML(rf, 'fig')).join('') + '</div>' : '');
  const opts = LET.map((L, j) => {
    let cls = 'opt';
    if (q.a.includes(j)) cls += ' right'; else if (e.a === j) cls += ' wrong';
    return `<div class="${cls}"><span class="lt">${L}</span>${q.img ? '' : '<span>' + esc(q.o[j]) + '</span>'}</div>`;
  }).join('');
  return `<article class="sheet wn-card">
    <div class="qhead"><span class="qno">${q.n}</span><span class="stag" style="--c:var(--${c});--cb:var(--${c}-bg)">${esc(it.sub)}</span><span class="qsrc">${esc(srcLabel(it))}</span>${e.fx ? '<span class="wn-fixed">다시 풀어 맞힘</span>' : ''}</div>
    ${body}
    <div class="opts ${q.img ? 'compact' : ''}">${opts}</div>
    <div class="ansline bad">고른 답: <b>${LET[e.a]}</b> · 정답: <b>${ansLetters(it)}</b></div>
    ${explHTML(q)}
    <div class="wn-meta"><span>틀린 횟수 <b class="mono">${e.c}</b></span><span>마지막으로 틀린 날 <span class="mono">${fmtDate(e.t)}</span></span><span class="sp"></span><button class="wn-del" type="button" data-del="${esc(k)}">노트에서 지우기</button></div>
  </article>`;
}
function drawHistBody(H){
  const body = document.getElementById('wnBody');
  if (!H.length){ body.innerHTML = '<div class="wn-empty"><b>아직 응시 기록이 없습니다</b>문제를 풀고 결과(채점) 화면을 보면 여기에 기록됩니다.</div>'; return; }
  const n = H.reduce((a, h) => a + h.n, 0), ok = H.reduce((a, h) => a + h.ok, 0);
  const exams = H.filter(h => h.m === 3);
  const passN = exams.filter(h => h.v === '합격').length;
  const sub = {}; for (const h of H) for (const [s, nn, oo] of (h.subs || [])){ const o = (sub[s] ||= [0, 0]); o[0] += nn; o[1] += oo; }
  body.innerHTML = `<div class="wn-stats"><div><b>${H.length}</b><span>응시 횟수</span></div><div><b>${n.toLocaleString()}</b><span>푼 문항</span></div><div><b>${n ? Math.round(ok / n * 100) : 0}<small>%</small></b><span>전체 정답률</span></div><div><b>${passN}/${exams.length}</b><span>회차 모의고사 합격</span></div></div>
  <div class="wn-sub">${SUBS.filter(s => sub[s]).map(s => `<div style="--c:var(--${SUBC[s]})"><b>${s}</b><p>${sub[s][1]}/${sub[s][0]} · ${Math.round(sub[s][1] / sub[s][0] * 100)}%</p></div>`).join('')}</div>
  <div class="stbl htbl"><table><thead><tr><th>일시</th><th>방식</th><th>시험</th><th style="text-align:right">정답</th><th style="text-align:right">점수</th><th>판정</th><th>소요</th></tr></thead><tbody>
  ${H.map(h => `<tr><td class="mono">${fmtDate(h.t)}</td><td>${MODE_NAME[h.m] || ''}</td><td title="${esc(h.meta || '')}">${esc(h.title)}<br><small style="color:var(--muted)">${esc(h.meta || '')}</small></td><td class="num">${h.ok}/${h.n}</td><td class="num">${h.sc}${h.m === 4 ? '%' : '점'}</td><td>${h.v ? `<span class="pill ${/^(합격|과락 면함|과락 없음)$/.test(h.v) ? 'ok' : /무작위/.test(h.v) ? '' : 'bad'}">${esc(h.v)}</span>` : ''}</td><td class="mono">${h.used != null ? fmtTime(h.used) : '–'}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="wn-note">최근 300회까지 저장됩니다. 결과(채점) 화면을 본 풀이만 기록됩니다.</p>
  <div class="res-acts"><button class="btn btn-ghost" type="button" id="hClear">응시 기록 비우기</button></div>`;
  document.getElementById('hClear').onclick = () => {
    modal(`<h3>응시 기록을 모두 비울까요?</h3><p class="sub">이 브라우저에 저장된 응시 기록이 지워지며 되돌릴 수 없습니다. 오답노트는 그대로 남습니다.</p><div class="acts"><button class="btn btn-ghost" data-close>취소</button><button class="btn btn-pri" id="hDo">비우기</button></div>`);
    document.getElementById('hDo').onclick = () => { lsSet(HIST_KEY, []); closeLayer(); drawWn(); };
  };
}
document.getElementById('wnBtn').onclick = () => (session && !session.done ? confirmLeave(wrongNote)() : wrongNote());
'''
rep("/* ---------- keyboard ---------- */", js.strip()+"\n\n/* ---------- keyboard ---------- */")
# home/others clear active tab
rep("function home(){\n  stopTimer();", "function home(){\n  stopTimer(); document.getElementById('wnBtn').classList.remove('on');")
rep("function renderQuiz(){\n  const S = session; closeLayer(); scrollTop();", "function renderQuiz(){\n  const S = session; closeLayer(); scrollTop(); document.getElementById('wnBtn').classList.remove('on');")
rep("home();\n})();", "updWnCnt();\nhome();\n})();")
open(p,'w',encoding='utf-8').write(s)
print('ok')
