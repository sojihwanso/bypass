/* ECDIS 시뮬레이터 교육 과정 (v2.0.0) — 배경 어둡게 + 강조 + 도도 마스코트 팝업
   본체 전역(S, LANG, dlgStack, setMode …)을 읽기만 한다. 공개: window.Tutor */
(() => {
  const KEY = "ecdis-edu";
  const MOOD = { explain: "설명", happy: "기쁨", oops: "당황", caution: "주의", think: "생각" };
  const COURSES = {
    D: { name: "화면 둘러보기", sub: "처음이라면 여기부터 · 10단계" },
    A: { name: "과정 1 · 항로 계획", sub: "Passage Plan 전 과정 + User chart · ECA" },
    C: { name: "과정 2 · 선박 조종", sub: "타각 · RPM · 자동 조타 · 항로 추종" },
  };
  // 단계 데이터: Tutor.STEPS[course] = [{id,title,body,say,mood,target?,before?,check?,good?,bad?,note?,quiz?,cursor?}]
  const STEPS = { D: [], A: [], C: [] };

  const $ = (q, r = document) => r.querySelector(q);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let cur = null; // {course, step}
  let root, spot, pop, chip, cursor, timer = null, reacted = false;

  const CSS = `
#tuRoot{position:fixed;inset:0;z-index:90;pointer-events:none;font-family:inherit}
#tuRoot .tu-dim{position:absolute;inset:0;background:rgba(8,14,24,.72);opacity:0;transition:opacity .45s}
#tuRoot.on .tu-dim.show{opacity:1}
.tu-spot{position:absolute;border-radius:10px;box-shadow:0 0 0 4000px rgba(8,14,24,.72);transition:left .5s cubic-bezier(.4,.1,.2,1),top .5s cubic-bezier(.4,.1,.2,1),width .5s,height .5s;opacity:0}
#tuRoot.on .tu-spot.show{opacity:1}
.tu-spot::after{content:"";position:absolute;inset:-6px;border:3px solid #FF7A26;border-radius:13px;animation:tuPulse 1.6s ease-in-out infinite}
@keyframes tuPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(1.06)}}
.tu-pop{position:absolute;width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:#fff;color:#241008;border:3px solid #241008;border-radius:20px;box-shadow:8px 8px 0 rgba(36,16,8,.85);pointer-events:auto;opacity:0;transform:translateY(14px) scale(.97);transition:opacity .35s,transform .35s,left .45s,top .45s}
.tu-pop.on{opacity:1;transform:none}
.tu-ph{display:flex;align-items:center;gap:10px;padding:14px 18px 10px;border-bottom:2px dashed #e8d9c4}
.tu-tag{background:#FF7A26;color:#241008;font-weight:800;font-size:13px;padding:3px 10px;border-radius:999px}
.tu-course{font-size:13px;color:#7A4532;font-weight:700}
.tu-cnt{margin-left:auto;font-size:12px;color:#8a7766;font-weight:700}
.tu-x{border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:#7A4532;padding:0 2px}
.tu-pb{display:flex;gap:14px;padding:14px 18px 4px}
.tu-face{flex:0 0 150px;height:150px;display:flex;align-items:flex-end;justify-content:center;position:relative}
.tu-dodo{max-width:150px;max-height:150px}
.tu-dodo.tu-bnc{animation:tuBounce .5s}
@keyframes tuBounce{0%{transform:scale(.8)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
.tu-mood{position:absolute;top:-4px;left:-4px;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;border:2px solid #241008;background:#FCF0E0}
.tu-txt{flex:1;min-width:0}
.tu-txt h3{margin:0 0 6px;font-size:20px;letter-spacing:-.01em}
.tu-txt p{margin:0 0 8px;font-size:14.5px;line-height:1.62;color:#3b2a20}
.tu-bub{position:relative;background:#FCF0E0;border:2px solid #241008;border-radius:14px;padding:10px 14px;font-size:14.5px;line-height:1.55;font-weight:600;margin:4px 18px 0}
.tu-bub::before{content:"";position:absolute;left:58px;top:-12px;border:10px solid transparent;border-bottom-color:#241008;border-top:0}
.tu-bub::after{content:"";position:absolute;left:60px;top:-8px;border:8px solid transparent;border-bottom-color:#FCF0E0;border-top:0}
.tu-bub.good{background:#E6F6EA}.tu-bub.good::after{border-bottom-color:#E6F6EA}
.tu-bub.bad{background:#FDE8E3}.tu-bub.bad::after{border-bottom-color:#FDE8E3}
.tu-note{margin:10px 18px 0;padding:8px 12px;border-left:4px solid #FFCC33;background:#FFF8E1;font-size:13.5px;line-height:1.55}
.tu-task{margin:10px 18px 0;padding:8px 12px;border-left:4px solid #FF7A26;background:#FFF1E6;font-size:13.5px;line-height:1.55;font-weight:600}
.tu-quiz{display:flex;flex-direction:column;gap:7px;margin:12px 18px 0}
.tu-quiz button{text-align:left;font:inherit;font-size:14px;padding:9px 12px;border:2px solid #241008;border-radius:10px;background:#fff;cursor:pointer;color:#241008}
.tu-quiz button:hover{background:#FCF0E0}
.tu-quiz button.ok{background:#E6F6EA;border-color:#22A04B}.tu-quiz button.no{background:#FDE8E3;border-color:#D9442B}
.tu-pf{display:flex;align-items:center;gap:8px;padding:14px 18px 16px}
.tu-en{font-size:12px;color:#8a7766;margin-right:auto}
.tu-btn{font:inherit;font-weight:800;font-size:15px;padding:9px 18px;border-radius:10px;border:2px solid #241008;cursor:pointer;background:#fff;color:#241008}
.tu-btn.pri{background:#FF7A26;color:#241008;box-shadow:none;padding:10px 26px;font-size:16px}
.tu-btn.pri:hover{background:#FF8F47}
.tu-btn:disabled{opacity:.35;cursor:default}
.tu-menu{display:flex;flex-direction:column;gap:8px;margin:12px 18px 0}
.tu-menu button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;font:inherit;padding:11px 14px;border:2px solid #241008;border-radius:12px;background:#fff;cursor:pointer;color:#241008}
.tu-menu button:hover{background:#FCF0E0}
.tu-menu b{font-size:15.5px}.tu-menu small{font-size:12.5px;color:#7A4532}
.tu-chip{position:absolute;right:14px;bottom:14px;display:none;align-items:center;gap:8px;background:#fff;border:2px solid #241008;border-radius:999px;padding:4px 14px 4px 4px;font-size:13px;font-weight:700;pointer-events:auto;box-shadow:3px 3px 0 rgba(36,16,8,.6)}
.tu-chip img{width:34px;height:34px}
.tu-chip.show{display:flex}
.tu-cursor{position:absolute;width:26px;height:26px;pointer-events:none;display:none;filter:drop-shadow(1px 2px 1px rgba(0,0,0,.4))}
.tu-cursor.show{display:block;animation:tuCur 2.2s ease-in-out infinite}
@keyframes tuCur{0%{transform:translate(var(--fx),var(--fy));opacity:0}15%{opacity:1}55%{transform:translate(var(--tx),var(--ty)) scale(1)}62%{transform:translate(var(--tx),var(--ty)) scale(.8)}70%{transform:translate(var(--tx),var(--ty)) scale(1)}90%{opacity:1}100%{transform:translate(var(--tx),var(--ty));opacity:0}}
@media (prefers-reduced-motion:reduce){.tu-spot::after,.tu-cursor.show,.tu-dodo.tu-bnc{animation:none}}`;

  function mount() {
    if (root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement("div"); root.id = "tuRoot";
    root.innerHTML = `<div class="tu-dim"></div><div class="tu-spot"></div><svg class="tu-cursor" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.5L16 20l-3 1.5-3.5-7.5L4 18z" fill="#FF7A26" stroke="#241008" stroke-width="1.6" stroke-linejoin="round"/></svg><div class="tu-pop" role="dialog" aria-live="polite"></div><button type="button" class="tu-chip"><img src="edu/dodo_explain.webp" alt="">교육 중 · <span></span></button>`;
    document.body.appendChild(root);
    spot = $(".tu-spot", root); pop = $(".tu-pop", root); chip = $(".tu-chip", root); cursor = $(".tu-cursor", root);
    chip.onclick = () => { if (typeof closeTopDlg === "function") while (dlgStack.length) closeTopDlg(); };
    pop.addEventListener("click", onClick);
    addEventListener("resize", place); addEventListener("keydown", (e) => { if (!cur || !root.classList.contains("on")) return; if (e.key === "ArrowRight" && !isTyping(e)) next(); if (e.key === "ArrowLeft" && !isTyping(e)) prev(); });
  }
  const isTyping = (e) => /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "");

  function face(m) {
    const img = $(".tu-dodo", pop); if (!img) return;
    img.src = "edu/dodo_" + m + ".webp"; img.classList.remove("tu-bnc"); void img.offsetWidth; img.classList.add("tu-bnc");
    $(".tu-mood", pop).textContent = MOOD[m];
  }
  const steps = () => (cur ? STEPS[cur.course] : []);
  const stepObj = () => steps()[cur.step];
  const targetEl = (s) => { if (!s || !s.target) return null; const el = typeof s.target === "function" ? s.target() : $(s.target); if (!el) return null; const r = el.getBoundingClientRect(); return r.width || r.height ? el : null; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {} };

  function render() {
    const s = stepObj(), n = steps().length;
    const quiz = s.quiz ? `<div class="tu-quiz">${s.quiz.map((q, i) => `<button type="button" data-q="${i}">${esc(q[0])}</button>`).join("")}</div>` : "";
    pop.innerHTML = `<div class="tu-ph"><span class="tu-tag">${esc(s.id)}</span><span class="tu-course">${esc(COURSES[cur.course].name)}</span><span class="tu-cnt">${cur.step + 1} / ${n}</span><button type="button" class="tu-x" data-tu="stop" aria-label="교육 끝내기">×</button></div>
<div class="tu-pb"><div class="tu-face"><span class="tu-mood"></span><img class="tu-dodo" alt="도도" src="edu/dodo_${s.mood || "explain"}.webp"></div><div class="tu-txt"><h3>${esc(s.title)}</h3><p>${s.body}</p></div></div>
<div class="tu-bub">${s.say}</div>${s.note ? `<div class="tu-note">${s.note}</div>` : ""}${s.task ? `<div class="tu-task">해 보기 · ${s.task}</div>` : ""}${quiz}
<div class="tu-pf"><span class="tu-en">${typeof LANG !== "undefined" && LANG !== "ko" ? "교육 과정은 한국어로 제공됩니다 (Korean only)" : ""}</span><button type="button" class="tu-btn" data-tu="prev"${cur.step ? "" : " disabled"}>이전</button><button type="button" class="tu-btn pri" data-tu="next">${cur.step === n - 1 ? "끝내기" : "다음"}</button></div>`;
    face(s.mood || "explain");
  }

  function place() {
    if (!cur || !pop || !pop.firstChild) return;
    const s = stepObj(); if (!s) return;
    const minimize = typeof dlgStack !== "undefined" && dlgStack.length > 0 && !(targetEl(s) && targetEl(s).closest(".dlg"));
    chip.classList.toggle("show", minimize); $("span", chip).textContent = s.id;
    pop.style.visibility = minimize ? "hidden" : "visible";
    const el = minimize ? null : targetEl(s);
    spot.classList.toggle("show", !!el); $(".tu-dim", root).classList.toggle("show", !el && !minimize);
    const W = innerWidth, H = innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = (W - pw) / 2, y = (H - ph) / 2;
    if (el) {
      const r = el.getBoundingClientRect();
      Object.assign(spot.style, { left: r.left - 4 + "px", top: r.top - 4 + "px", width: r.width + 8 + "px", height: r.height + 8 + "px" });
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (r.bottom + 16 + ph <= H) y = r.bottom + 16; else if (r.top - 16 - ph >= 0) y = r.top - 16 - ph; else y = (H - ph) / 2;
      x = cx < W / 2 ? Math.max(r.right + 20, cx - pw / 2) : Math.min(r.left - 20 - pw, cx - pw / 2);
      if (y === r.bottom + 16 || y === r.top - 16 - ph) x = cx - pw / 2;
      if (s.cursor) {
        cursor.style.setProperty("--fx", x + pw / 2 + "px"); cursor.style.setProperty("--fy", y + 30 + "px");
        cursor.style.setProperty("--tx", cx - 4 + "px"); cursor.style.setProperty("--ty", cy - 2 + "px");
      }
    }
    cursor.classList.toggle("show", !!(el && s.cursor));
    x = Math.max(12, Math.min(W - pw - 12, x)); y = Math.max(12, Math.min(H - ph - 12, y));
    pop.style.left = x + "px"; pop.style.top = y + "px";
  }

  function react(kind) {
    const s = stepObj(); if (!s) return;
    face(kind === "good" ? "happy" : "oops");
    const b = $(".tu-bub", pop); b.className = "tu-bub " + kind;
    b.innerHTML = s[kind] || (kind === "good" ? "좋아요! 잘했어요." : "다시 한번 해 볼까요?");
    if (kind === "good") $('[data-tu="next"]', pop).focus();
  }

  function show(i) {
    mount(); ensurePop(); cur.step = Math.max(0, Math.min(steps().length - 1, i)); save(); reacted = false;
    const s = stepObj();
    try { s.before && s.before(); } catch (e) {}
    pop.classList.remove("on"); root.classList.add("on");
    setTimeout(() => { render(); place(); requestAnimationFrame(() => pop.classList.add("on")); }, 120);
    clearInterval(timer);
    timer = setInterval(() => {
      if (!cur) return; place();
      const st = stepObj();
      if (st && st.check && !reacted) { let r = null; try { r = st.check(); } catch (e) {} if (r === true) { reacted = true; react("good"); } }
    }, 500);
  }

  function onClick(e) {
    const q = e.target.closest("[data-q]");
    if (q) { const ok = !!stepObj().quiz[+q.dataset.q][1]; q.classList.add(ok ? "ok" : "no"); react(ok ? "good" : "bad"); return; }
    const b = e.target.closest("[data-tu]"); if (!b) return;
    const a = b.dataset.tu;
    if (a === "next") next(); else if (a === "prev") prev(); else if (a === "stop") stop();
    else if (a === "pick") start(b.dataset.c, 0); else if (a === "resume") { const sv = saved(); if (sv) start(sv.course, sv.step); }
  }
  function next() { if (!cur) return; if (cur.step >= steps().length - 1) { const c = cur.course; stop(); toastDone(c); return; } show(cur.step + 1); }
  function prev() { if (cur && cur.step > 0) show(cur.step - 1); }
  function toastDone(c) { if (typeof toast === "function") toast(COURSES[c].name + " 완료! 수고했어요."); }
  function saved() { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && STEPS[v.course] && STEPS[v.course][v.step] ? v : null; } catch (e) { return null; } }

  function start(course, step) { if (!STEPS[course] || !STEPS[course].length) return; mount(); cur = { course, step: step || 0 }; show(cur.step); }
  function stop() {
    clearInterval(timer); timer = null; cur = null;
    if (!root) return;
    root.classList.remove("on"); cursor.classList.remove("show"); chip.classList.remove("show"); spot.classList.remove("show");
    if (pop) { pop.remove(); pop = null; }
  }
  function ensurePop() { if (pop) return; pop = document.createElement("div"); pop.className = "tu-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-live", "polite"); pop.addEventListener("click", onClick); root.appendChild(pop); }
  function menu() {
    mount(); stop(); cur = null; ensurePop();
    const sv = saved();
    pop.innerHTML = `<div class="tu-ph"><span class="tu-tag">EDU</span><span class="tu-course">ECDIS 교육 과정</span><button type="button" class="tu-x" data-tu="stop" aria-label="닫기" style="margin-left:auto">×</button></div>
<div class="tu-pb"><div class="tu-face"><span class="tu-mood">설명</span><img class="tu-dodo tu-bnc" alt="도도" src="edu/dodo_explain.webp"></div><div class="tu-txt"><h3>무엇부터 배워 볼까요?</h3><p>설명할 버튼만 밝게 비추고, 직접 해 보면 맞았는지 알려 드려요. 언제든 × 로 끝낼 수 있어요.</p></div></div>
<div class="tu-menu">${sv ? `<button type="button" data-tu="resume"><b>이어서 하기 · ${esc(COURSES[sv.course].name)} ${sv.step + 1}단계</b><small>지난번 멈춘 곳부터</small></button>` : ""}${Object.keys(COURSES).map((k) => `<button type="button" data-tu="pick" data-c="${k}"><b>${esc(COURSES[k].name)}</b><small>${esc(COURSES[k].sub)} · ${STEPS[k].length}단계</small></button>`).join("")}</div>
<div class="tu-pf"><span class="tu-en">${typeof LANG !== "undefined" && LANG !== "ko" ? "교육 과정은 한국어로 제공됩니다 (Korean only)" : ""}</span></div>`;
    root.classList.add("on"); $(".tu-dim", root).classList.add("show"); spot.classList.remove("show");
    pop.style.visibility = "visible"; pop.style.left = (innerWidth - pop.offsetWidth) / 2 + "px"; pop.style.top = Math.max(12, (innerHeight - pop.offsetHeight) / 2) + "px";
    requestAnimationFrame(() => pop.classList.add("on"));
  }

  window.Tutor = { STEPS, COURSES, menu, start, next, prev, stop, react, state: () => (cur ? { course: cur.course, step: cur.step } : null) };
})();

/* ===== 공통 D. 화면 둘러보기 ===== */
(() => {
  const q = (s) => document.querySelector(s);
  const btnText = (txt) => () => [...document.querySelectorAll("button")].find((b) => b.textContent.replace(/\s+/g, "") === txt && b.getBoundingClientRect().width);
  const navi = () => { try { if (S.mode !== "NAVI") setMode("NAVI"); } catch (e) {} };
  let sawOther = false;
  Tutor.STEPS.D.push(
    { id: "D1", mood: "explain", target: "#cvChart", before: navi, title: "해도 화면", cursor: false,
      body: "전자해도(ENC)가 표시되는 곳이에요. 드래그로 옮기고, 휠·핀치로 축척을 바꿔요. 길게 누르거나 오른쪽 클릭하면 픽 리포트로 물표 정보를 볼 수 있어요.",
      say: "안녕하세요! 저는 항해사 도도예요. 해도는 그림이 아니라 정보 덩어리예요. 등부표를 오른쪽 클릭해 보세요!" },
    { id: "D2", mood: "explain", target: () => { const b = q('[data-act="mode"]'); return b && b.parentElement; }, before: navi, title: "작업 모드 — 항해 / 해도관리 / 항로계획",
      body: "항해 중 감시, 해도 설치·관리, 항로 작성의 세 작업 모드예요. 실선 ECDIS도 같은 구조예요.",
      say: "지금 하는 일에 맞춰 모드를 바꾸면 돼요." },
    { id: "D3", mood: "explain", target: "#bDisp", before: navi, title: "표시 화면 — 전자해도 / 컨닝",
      body: "해도 화면과 컨닝(조타·기관 계기) 화면을 바꿔요.", say: "컨닝은 조타실 앞 계기판이라고 생각하시면 돼요." },
    { id: "D4", mood: "caution", target: "#bBase", cursor: true, before: () => { navi(); sawOther = false; }, title: "표시 단계 — 기본 / 표준 / 전체",
      body: "IMO가 정한 Display Base · Standard · All other information이에요. 항로를 계획할 때는 '전체 표시'로 놓아야 놓치는 위험물이 없어요.",
      say: "기본 표시만 보고 항로를 짜면 안 돼요. 숨겨진 위험물이 있을 수 있어요!",
      task: "버튼을 눌러 표시 단계를 바꿔 본 뒤, 마지막에 '전체 표시'로 맞춰 주세요.",
      check: () => { if (S.set.dbase !== "ALL") sawOther = true; return sawOther && S.set.dbase === "ALL"; },
      good: "맞아요! 전체 표시로 바꾸니 작은 위험물까지 다 보이죠?", bad: "지금은 '전체 표시'가 아니에요. 한 번 더 눌러 주세요." },
    { id: "D5", mood: "explain", target: "#bUp", before: navi, title: "방위 표시 · 자선으로",
      body: "방위 표시(North up 등)를 바꾸고, '자선으로' 버튼으로 화면을 자선 위치로 되돌려요.", say: "해도를 너무 멀리 옮겼다면 '자선으로'를 누르면 돼요." },
    { id: "D6", mood: "think", target: "#rp", before: navi, title: "정보창 — HDG · COG · SOG · STW",
      body: "센서에서 들어오는 자선 정보예요. HDG와 COG가 다르면 바람이나 조류로 밀리고 있다는 뜻이에요.",
      say: "HDG 090, COG 095면 배는 어느 쪽으로 밀리고 있을까요?",
      quiz: [["오른쪽(우현 쪽)으로 밀리고 있어요", true], ["왼쪽(좌현 쪽)으로 밀리고 있어요", false], ["밀리지 않아요", false]],
      good: "정답이에요! COG가 HDG보다 오른쪽이니 우현 쪽으로 밀리고 있어요.", bad: "COG 095는 HDG 090보다 오른쪽이에요. 다시 생각해 볼까요?" },
    { id: "D7", mood: "explain", target: btnText("EBL/VRM"), before: navi, title: "EBL / VRM",
      body: "방위·거리를 재는 도구예요. 물표까지 거리와 방위를 잴 때 써요.", say: "해도 아래쪽 EBL·VRM 칸의 ◀ ▶ 로 값을 바꿀 수 있어요." },
    { id: "D8", mood: "caution", target: () => q("#ackAll") || q("#alLog"), before: navi, title: "경보 — 확인(ACK) · 경보 기록",
      body: "안전 등심선 횡단, 항로 이탈, 좌초 같은 경보가 뜨는 곳이에요. 경보는 확인(ACK)해야 꺼져요.",
      say: "경보는 끄는 게 목적이 아니에요. 왜 울렸는지부터 봐 주세요!" },
    { id: "D9", mood: "explain", target: "#bLvl", before: navi, title: "상대선 단계 · 해도 수정 잠금",
      body: "연습 난이도(조우선 수)와, 실수로 해도를 건드리지 않게 막는 잠금이에요.", say: "처음에는 상대선을 '쉬움'으로 두고 연습해 보세요." },
    { id: "D10", mood: "happy", target: '[data-act="help"]', before: navi, title: "도움말",
      body: "도움말에는 메뉴 설명과 약어 목록이 있어요. 이 교육은 상단 '기타 → 교육 과정'에서 언제든 다시 열 수 있어요.",
      say: "화면 둘러보기 끝! 이제 진짜 항로를 짜러 가요." }
  );
})();
