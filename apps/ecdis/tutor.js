/* ECDIS 시뮬레이터 교육 과정 (v2.0.0) — 배경 어둡게 + 강조 + 도도 마스코트 팝업
   본체 전역(S, LANG, dlgStack, setMode …)을 읽기만 한다. 공개: window.Tutor */
(() => {
  const KEY = "ecdis-edu", DONE_KEY = "ecdis-edu-done", ORDER = ["D", "A", "C"];
  const doneList = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY) || "[]"); } catch (e) { return []; } };
  const markDone = (c) => { const d = doneList(); if (!d.includes(c)) d.push(c); try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (e) {} };
  const ck = (k) => (doneList().includes(k) ? `<span class="tu-ck" aria-label="완료">✓</span>` : "");
  const MOOD = { explain: "설명", happy: "기쁨", oops: "당황", caution: "주의", think: "생각" };
  const COURSES = {
    D: { name: "화면 둘러보기", sub: "처음이라면 여기부터" },
    A: { name: "과정 1 · 항로 계획", sub: "Passage Plan 전 과정 + User chart · ECA" },
    C: { name: "과정 2 · 선박 조종", sub: "타각 · RPM · 자동 조타 · 항로 추종" },
  };
  // 단계 데이터: Tutor.STEPS[course] = [{id,title,body,say,mood,target?,before?,check?,good?,bad?,note?,quiz?,cursor?}]
  const STEPS = { D: [], A: [], C: [] };

  const $ = (q, r = document) => r.querySelector(q);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let cur = null; // {course, step}
  let root, spot, pop, chip, cursor, timer = null, reacted = false, manual = null, drag = null;

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
.tu-ph{display:flex;align-items:center;gap:10px;padding:14px 18px 10px;border-bottom:2px dashed #e8d9c4;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.tu-ph:active{cursor:grabbing}.tu-grip{color:#b9a58e;font-size:15px;letter-spacing:-2px;margin-right:-2px}
.tu-pop.tu-dragging{transition:opacity .35s,transform .35s}
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
.tu-pop.tu-narrow .tu-pb{display:block;position:relative}
.tu-pop.tu-narrow .tu-face{position:absolute;left:18px;top:12px;width:56px;height:56px;flex:none}
.tu-pop.tu-narrow .tu-dodo{max-width:56px;max-height:56px}
.tu-pop.tu-narrow .tu-txt h3{min-height:56px;padding-left:66px;display:flex;align-items:center;font-size:18px}
.tu-pop.tu-narrow .tu-bub::before,.tu-pop.tu-narrow .tu-bub::after{display:none}
.tu-txt h3{margin:0 0 6px;font-size:20px;letter-spacing:-.01em}
.tu-txt p{margin:0 0 8px;font-size:14.5px;line-height:1.62;color:#3b2a20}
.tu-bub{position:relative;background:#FCF0E0;border:2px solid #241008;border-radius:14px;padding:10px 14px;font-size:14.5px;line-height:1.55;font-weight:600;margin:4px 18px 0}
.tu-bub::before{content:"";position:absolute;left:58px;top:-12px;border:10px solid transparent;border-bottom-color:#241008;border-top:0}
.tu-bub::after{content:"";position:absolute;left:60px;top:-8px;border:8px solid transparent;border-bottom-color:#FCF0E0;border-top:0}
.tu-bub.good{background:#E6F6EA}.tu-bub.good::after{border-bottom-color:#E6F6EA}
.tu-bub.bad{background:#FDE8E3}.tu-bub.bad::after{border-bottom-color:#FDE8E3}
.tu-note{margin:10px 18px 0;padding:8px 12px;border-left:4px solid #FFCC33;background:#FFF8E1;font-size:13.5px;line-height:1.55}
.tu-task{margin:10px 18px 0;padding:8px 12px;border-left:4px solid #FF7A26;background:#FFF1E6;font-size:13.5px;line-height:1.55;font-weight:600}
.tu-clip{margin:10px 18px 0}.tu-cbtn{font:inherit;font-weight:800;font-size:13.5px;padding:7px 14px;border:2px solid #241008;border-radius:999px;background:#FCF0E0;color:#241008;cursor:pointer}
.tu-vid video{display:block;width:100%;margin-top:8px;border:2px solid #241008;border-radius:10px;background:#0d1b2a}
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
.tu-rot{margin:12px 18px 0;padding:10px 12px;border:2px solid #241008;border-radius:12px;background:#FFF1C2;font-size:13.5px;line-height:1.55}.tu-rot b{display:block;font-size:14.5px;margin-bottom:2px}
.tu-menu{display:flex;flex-direction:column;gap:8px;margin:12px 18px 0}
.tu-menu button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;font:inherit;padding:11px 14px;border:2px solid #241008;border-radius:12px;background:#fff;cursor:pointer;color:#241008}
.tu-menu button:hover{background:#FCF0E0}
.tu-menu b{font-size:15.5px}.tu-ck{color:#22A04B;margin-left:6px;font-weight:900}.tu-menu button.tu-rec{background:#FF7A26}.tu-menu button.tu-rec:hover{background:#FF8F47}.tu-menu button.tu-rec small{color:#241008}.tu-menu small{font-size:12.5px;color:#7A4532}
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
    pop.addEventListener("click", onClick); pop.addEventListener("pointerdown", onDown);
    addEventListener("resize", place);
  }
  // 좁은 세로 화면(휴대폰 세로) 여부 — 테스트에서 바꿔 끼울 수 있게 Tutor._narrow로 노출
  const narrow = () => (window.Tutor && Tutor._narrow ? Tutor._narrow() : matchMedia("(orientation: portrait) and (max-width: 900px)").matches);

  function face(m) {
    const img = $(".tu-dodo", pop); if (!img) return;
    img.src = "edu/dodo_" + m + ".webp"; img.classList.remove("tu-bnc"); void img.offsetWidth; img.classList.add("tu-bnc");
  }
  const steps = () => (cur ? STEPS[cur.course] : []);
  const stepObj = () => steps()[cur.step];
  const targetEl = (s) => { if (!s || !s.target) return null; const el = typeof s.target === "function" ? s.target() : $(s.target); if (!el) return null; const r = el.getBoundingClientRect(); return r.width || r.height ? el : null; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {} };

  function render() {
    const s = stepObj(), n = steps().length;
    const quiz = s.quiz ? `<div class="tu-quiz">${s.quiz.map((q, i) => `<button type="button" data-q="${i}">${esc(q[0])}</button>`).join("")}</div>` : "";
    pop.innerHTML = `<div class="tu-ph" title="끌어서 옮길 수 있어요"><span class="tu-grip" aria-hidden="true">⠿</span><span class="tu-tag">${esc(s.id)}</span><span class="tu-course">${esc(COURSES[cur.course].name)}</span><span class="tu-cnt">${cur.step + 1} / ${n}</span><button type="button" class="tu-x" data-tu="stop" aria-label="교육 끝내기">×</button></div>
<div class="tu-pb"><div class="tu-face"><img class="tu-dodo" alt="도도" src="edu/dodo_${s.mood || "explain"}.webp"></div><div class="tu-txt"><h3>${esc(s.title)}</h3><p>${s.body}</p></div></div>
<div class="tu-bub">${s.say}</div>${s.note ? `<div class="tu-note">${s.note}</div>` : ""}${s.task ? `<div class="tu-task">해 보기 · ${s.task}</div>` : ""}${s.clip ? `<div class="tu-clip"><button type="button" class="tu-cbtn" data-tu="clip" aria-expanded="false">▶ 시연 보기</button><div class="tu-vid"></div></div>` : ""}${quiz}
<div class="tu-pf"><span class="tu-en">${typeof LANG !== "undefined" && LANG !== "ko" ? "교육 과정은 한국어로 제공됩니다 (Korean only)" : ""}</span><button type="button" class="tu-btn" data-tu="prev"${cur.step ? "" : " disabled"}>이전</button><button type="button" class="tu-btn pri" data-tu="next">${cur.step === n - 1 ? "끝내기" : "다음"}</button></div>`;
    pop.classList.toggle("tu-narrow", narrow());
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
    if (manual) { x = manual.x; y = manual.y; }
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
    mount(); ensurePop(); cur.step = Math.max(0, Math.min(steps().length - 1, i)); save(); reacted = false; manual = null;
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
    if (a === "clip") { const box = $(".tu-vid", pop), open = !box.firstChild; box.innerHTML = open ? `<video src="edu/clips/${stepObj().clip}.mp4" autoplay muted loop playsinline preload="auto" aria-label="시연 영상"></video>` : ""; b.textContent = open ? "■ 시연 닫기" : "▶ 시연 보기"; b.setAttribute("aria-expanded", open); place(); return; }
    if (a === "next") next(); else if (a === "prev") prev(); else if (a === "stop") stop();
    else if (a === "pick") start(b.dataset.c, 0); else if (a === "resume") { const sv = saved(); if (sv) start(sv.course, sv.step); }
  }
  function next() { if (!cur) return; if (cur.step >= steps().length - 1) { const c = cur.course; markDone(c); showDone(c); return; } show(cur.step + 1); }
  function prev() { if (cur && cur.step > 0) show(cur.step - 1); }
  // 과정을 마치면 다음 과정을 바로 고를 수 있는 팝업
  function showDone(c) {
    mount(); stop(); ensurePop();
    const d = doneList(), after = ORDER.slice(ORDER.indexOf(c) + 1).concat(ORDER.slice(0, ORDER.indexOf(c)));
    const rec = after.find((k) => !d.includes(k)) || null;
    const others = ORDER.filter((k) => k !== rec);
    const btn = (k, main) => `<button type="button" data-tu="pick" data-c="${k}"${main ? ' class="tu-rec"' : ""}><b>${main ? "추천 · " : ""}${esc(COURSES[k].name)}${ck(k)}</b><small>${esc(COURSES[k].sub)} · ${STEPS[k].length}단계</small></button>`;
    pop.innerHTML = `<div class="tu-done"><div class="tu-ph" title="끌어서 옮길 수 있어요"><span class="tu-grip" aria-hidden="true">⠿</span><span class="tu-tag">완료</span><span class="tu-course">${esc(COURSES[c].name)}</span><button type="button" class="tu-x" data-tu="stop" aria-label="닫기" style="margin-left:auto">×</button></div>
<div class="tu-pb"><div class="tu-face"><img class="tu-dodo tu-bnc" alt="도도" src="edu/dodo_happy.webp"></div><div class="tu-txt"><h3>${esc(COURSES[c].name)} 완료!</h3><p>${rec ? "수고했어요! 바로 이어서 다음 과정을 해 볼까요?" : "모든 과정을 마쳤어요! 다시 보고 싶은 과정을 골라 보세요."}</p></div></div>
<div class="tu-menu">${rec ? btn(rec, true) : ""}${others.map((k) => btn(k, false)).join("")}</div>
<div class="tu-pf"><span class="tu-en"></span><button type="button" class="tu-btn" data-tu="stop">교육 끝내기</button></div></div>`;
    pop.classList.toggle("tu-narrow", narrow());
    root.classList.add("on"); $(".tu-dim", root).classList.add("show"); spot.classList.remove("show");
    pop.style.visibility = "visible"; pop.style.left = (innerWidth - pop.offsetWidth) / 2 + "px"; pop.style.top = Math.max(12, (innerHeight - pop.offsetHeight) / 2) + "px";
    requestAnimationFrame(() => pop.classList.add("on"));
  }
  function saved() { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && STEPS[v.course] && STEPS[v.course][v.step] ? v : null; } catch (e) { return null; } }

  function start(course, step) { if (!STEPS[course] || !STEPS[course].length) return; mount(); cur = { course, step: step || 0 }; show(cur.step); }
  function stop() {
    clearInterval(timer); timer = null; cur = null;
    if (!root) return;
    root.classList.remove("on"); cursor.classList.remove("show"); chip.classList.remove("show"); spot.classList.remove("show");
    if (pop) { pop.remove(); pop = null; }
  }
  function ensurePop() { if (pop) return; pop = document.createElement("div"); pop.className = "tu-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-live", "polite"); pop.addEventListener("click", onClick); pop.addEventListener("pointerdown", onDown); root.appendChild(pop); }
  // 머리줄을 잡고 끌어서 팝업 옮기기 (마우스·터치)
  function onDown(e) {
    const h = e.target.closest(".tu-ph"); if (!h || e.target.closest("button")) return;
    const r = pop.getBoundingClientRect();
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    pop.classList.add("tu-dragging"); e.preventDefault();
    addEventListener("pointermove", onMove); addEventListener("pointerup", onUp); addEventListener("pointercancel", onUp);
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const W = innerWidth, H = innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight;
    manual = { x: Math.max(12, Math.min(W - pw - 12, e.clientX - drag.dx)), y: Math.max(12, Math.min(H - Math.min(ph, 80) - 12, e.clientY - drag.dy)) };
    pop.style.left = manual.x + "px"; pop.style.top = manual.y + "px";
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null; pop && pop.classList.remove("tu-dragging");
    removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("pointercancel", onUp);
  }
  function menu() {
    mount(); stop(); cur = null; ensurePop();
    const sv = saved();
    pop.innerHTML = `<div class="tu-ph"><span class="tu-tag">EDU</span><span class="tu-course">ECDIS 교육 과정</span><button type="button" class="tu-x" data-tu="stop" aria-label="닫기" style="margin-left:auto">×</button></div>
<div class="tu-pb"><div class="tu-face"><img class="tu-dodo tu-bnc" alt="도도" src="edu/dodo_explain.webp"></div><div class="tu-txt"><h3>무엇부터 배워 볼까요?</h3><p>설명할 버튼만 밝게 비추고, 직접 해 보면 맞았는지 알려 드려요. 언제든 × 로 끝낼 수 있어요.</p></div></div>
${narrow() ? `<div class="tu-rot"><b>📱 가로 화면을 권장해요</b>휴대폰을 가로로 돌려서 하면 설명과 버튼이 잘 보여요. 세로 화면에서도 진행할 수는 있어요.</div>` : ""}<div class="tu-menu">${sv ? `<button type="button" data-tu="resume"><b>이어서 하기 · ${esc(COURSES[sv.course].name)} ${sv.step + 1}단계</b><small>지난번 멈춘 곳부터</small></button>` : ""}${Object.keys(COURSES).map((k) => `<button type="button" data-tu="pick" data-c="${k}"><b>${esc(COURSES[k].name)}${ck(k)}</b><small>${esc(COURSES[k].sub)} · ${STEPS[k].length}단계</small></button>`).join("")}</div>
<div class="tu-pf"><span class="tu-en">${typeof LANG !== "undefined" && LANG !== "ko" ? "교육 과정은 한국어로 제공됩니다 (Korean only)" : ""}</span></div>`;
    root.classList.add("on"); $(".tu-dim", root).classList.add("show"); spot.classList.remove("show");
    pop.style.visibility = "visible"; pop.style.left = (innerWidth - pop.offsetWidth) / 2 + "px"; pop.style.top = Math.max(12, (innerHeight - pop.offsetHeight) / 2) + "px";
    requestAnimationFrame(() => pop.classList.add("on"));
  }

  window.Tutor = { _narrow: null, STEPS, COURSES, menu, start, next, prev, stop, react, state: () => (cur ? { course: cur.course, step: cur.step } : null) };
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
      say: "안녕하세요! 해도는 그림이 아니라 정보 덩어리예요. 등부표를 오른쪽 클릭해 보세요!" },
    { id: "D2", mood: "explain", target: () => { const b = q('[data-act="mode"]'); return b && b.parentElement; }, before: navi, title: "작업 모드 — 항해 / 해도관리 / 항로계획",
      body: "항해 중 감시, 해도 설치·관리, 항로 작성의 세 작업 모드예요. 실제 선박의 ECDIS도 같은 구조예요.",
      say: "지금 하는 일에 맞춰 모드를 바꾸면 돼요." },
    { id: "D3", mood: "explain", target: "#bDisp", before: navi, title: "표시 화면 — 전자해도 / Conning",
      body: "해도 화면과 Conning(조타·기관 계기) 화면을 바꿔요.", say: "Conning 화면은 조타실 앞 계기판이라고 생각하시면 돼요." },
    { id: "D4", clip: "d4", mood: "caution", target: "#bBase", cursor: true, before: () => { navi(); sawOther = false; }, title: "표시 단계 — 기본 / 표준 / 전체",
      body: "IMO가 정한 Display Base · Standard · All other information이에요. 항로를 계획할 때는 '전체 표시'로 놓아야 놓치는 위험물이 없어요. 일반적으로는 All(전체 표시) 모드로 놓고 사용해요.",
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
    { id: "D7", mood: "explain", target: "#eblBox", before: navi, title: "EBL / VRM",
      body: "방위·거리를 재는 도구예요. 물표까지 거리와 방위를 잴 때 써요.", say: "해도 아래쪽 EBL·VRM 칸의 ◀ ▶ 로 값을 바꿀 수 있어요." },
    { id: "D8", mood: "caution", target: () => { const b = q("#ackAll") || q('[data-act="ack"]'); return b && (b.closest(".al, .alb, div") || b); }, optTarget: true, before: navi, title: "경보 — 확인(ACK) · 경보 기록",
      body: "안전 등심선 횡단, 항로 이탈, 좌초 같은 경보가 뜨는 곳이에요. 경보는 확인(ACK)해야 꺼져요.",
      say: "경보는 끄는 게 목적이 아니에요. 왜 울렸는지부터 봐 주세요!" },
    { id: "D9", mood: "explain", target: "#bLvl", before: navi, title: "상대선 단계 · 해도 수정 잠금",
      body: "연습 난이도(조우선 수)와, 실수로 해도를 건드리지 않게 막는 잠금이에요.", say: "처음에는 상대선을 '쉬움'으로 두고 연습해 보세요." },
    { id: "D10", mood: "happy", target: '[data-act="help"]', before: navi, title: "도움말",
      body: "도움말에는 메뉴 설명과 약어 목록이 있어요. 이 교육은 상단 '기타 → 교육 과정'에서 언제든 다시 열 수 있어요.",
      say: "화면 둘러보기 끝! 이제 진짜 항로를 짜러 가요." }
  );
})();

/* ===== 과정 1. 항로 계획 (A) + User chart (B) + ECA ===== */
(() => {
  const q = (s) => document.querySelector(s);
  const mode = (m) => () => { try { if (S.mode !== m) setMode(m); } catch (e) {} };
  const plan = mode("PLAN"), charts = mode("CHARTS"), navi = mode("NAVI");
  const uc = '[data-act="uchart"]';
  Tutor.STEPS.A.push(
    { id: "A0", mood: "explain", title: "항로 계획은 4단계예요",
      body: "IMO 지침(A.893(21))에 따라 <b>평가(Appraisal) → 계획(Planning) → 실행(Execution) → 감시(Monitoring)</b> 순서로 해요. 이번 과정에서는 앞의 두 단계를 ECDIS로 직접 해 볼 거예요.",
      say: "출항 전에 '선석에서 선석까지(Berth to Berth)' 전부 계획이 있어야 해요!" },
    { id: "A1", clip: "a1", mood: "explain", target: '[data-act="planning"]', cursor: true, before: plan, title: "대략적인 항로 구성 — 큰 물표 기준 WPT",
      body: "처음에는 세밀하게 짜지 않아요. 출발·도착과 그 사이의 큰 물표(곶, 섬, 등대, TSS 입구)를 기준으로 굵직한 변침점(WPT)만 찍어 전체 모양을 잡아요. 넓은 범위(소축척)에서 시작해요.",
      say: "처음엔 지도 앱에서 경유지 몇 개 찍는 느낌이면 돼요. 큰 곶을 돌아가는 지점, TSS에 들어가는 지점 같은 곳이요!",
      task: "'항로 계획'을 누르고 해도를 클릭해 WPT를 4개 이상 찍어 보세요.",
      check: () => !!(S.plan && S.plan.wps && S.plan.wps.length >= 4),
      good: "좋아요! 큰 그림이 나왔어요. 아직 육지에 붙어 있어도 괜찮아요, 뒤에서 다듬을 거예요.", bad: "WPT가 2개뿐이면 항로가 육지를 그냥 가로질러요. 곶을 돌아가는 점을 추가해 보세요." },
    { id: "A2", mood: "think", title: "대략적인 거리 계산 · 기관부 전달 (Bunker)",
      body: "WPT 표에 레그 거리와 총 거리가 자동으로 계산돼요. 총 거리 ÷ 계획 속력 = 항해 시간이에요. 이 거리와 예상 시간을 기관부(기관장)에 전달하면 연료(Bunker)·윤활유·청수 소요량을 계산해요. 보통 기상 여유분을 더하고, ECA를 지나는 구간 거리도 함께 알려 줘요.",
      say: "총 거리 1,200 NM, 계획 속력 12 kn이면 얼마나 걸릴까요?",
      quiz: [["100시간 (약 4일 4시간)", true], ["120시간 (5일)", false], ["10시간", false]],
      good: "정답이에요! 이 값이 기관부 연료 계산의 출발점이에요.", bad: "거리를 속력으로 나누면 시간이에요. 1,200 ÷ 12를 다시 계산해 볼까요?" },
    { id: "A3", mood: "caution", target: '[data-act="cm"][data-v="license"]', before: charts, title: "해역 해도 구매 및 청구",
      body: "항로가 지나는 해역의 ENC 셀이 설치·허가(라이선스)되어 있는지 확인해요. 없는 셀은 회사 절차에 따라 해도 대리점에 청구(주문)하고, 받은 허가 파일(Permit)과 공개키로 설치해요. 항로를 덮는 가장 큰 축척의 셀까지 갖춰야 해요. 원칙은 입항 며칠 전까지 미리 청구하는 것이지만, 요즘은 위성 통신으로 허가·업데이트를 실시간으로 받아 바로 설치하고 수정할 수도 있어요.",
      say: "항로 위에 허가 안 된 셀이 하나라도 있으면 그 구간은 공식 해도 없이 가는 거예요. 출항 전에 꼭 확인해 주세요!",
      quiz: [["회사 절차에 따라 해도 대리점에 청구해요", true], ["허가 없이 그냥 써요", false], ["종이해도가 있으니 무시해요", false]],
      good: "맞아요! 빠진 셀은 바로 청구 목록에 넣어요.", bad: "공식 해도 없이 항해하면 안 돼요. 다시 골라 볼까요?" },
    { id: "A4", clip: "a4", mood: "caution", target: '[data-act="cm"][data-v="status"]', cursor: true, before: charts, title: "소개정 (Small correction)",
      body: "ENC는 주간 항행통보(NtM)에 맞춘 업데이트 파일로 최신화해요. 셀마다 업데이트 번호가 최신인지 확인하고, 임시·예고 통보(T&amp;P)나 항행경보처럼 ENC에 안 들어간 내용은 수동 개정이나 사용자 해도로 표시해요. 개정 내용은 해도 개정 기록부에 남겨요.",
      say: "업데이트를 안 한 ENC는 '오래된 종이해도'랑 같아요. 새로 생긴 침선이 안 보일 수 있어요!",
      task: "'셀 상태'를 열고 주황색 셀의 '업데이트 적용'을 눌러 보세요.",
      check: () => Object.keys(S.cellUpd || {}).length > 0,
      good: "최신 해도가 됐어요! 업데이트로 새 침선이 해도에 생겼어요.", bad: "그 셀은 이미 최신이에요. 업데이트 번호를 다시 봐 주세요." },
    { id: "A5", mood: "explain", target: '[data-act="llroute"]', before: plan, title: "위도·경도 정리 — 0.1분 단위",
      body: "WPT 위치는 도°분.분′ 형식으로, 가능하면 0.1분 단위로 정리해요(예: 35°06.4′N 129°03.7′E). 다만 반드시 피해야 하는 위험물이 0.1분(약 185 m) 범위 안에 있다면, 반올림하지 말고 정확한 위치로 정해야 해요. 0.1분은 약 185 m예요. 숫자를 깔끔히 맞춰 두면 다른 계기·서류로 옮길 때 오류가 줄고, 교대 당직자도 읽기 쉬워요.",
      say: "0.1분은 약 185 m예요! 항로 위치로는 충분히 정확하고, 받아 적기도 편해요.",
      note: "분 자리는 60을 넘을 수 없어요. 60분이 1도예요." },
    { id: "A6", clip: "a6", mood: "caution", target: '[data-act="rcheck"]', cursor: true, before: plan, title: "항로 시뮬레이션 · 수심 · 위험물 확인",
      body: "먼저 흘수와 UKC로 안전 등심선·안전 수심을 정해요(해도에 없는 값이면 다음 깊은 등심선). 그다음 '항로 점검'을 실행하면 XTD 폭 안에 얕은 수역이나 위험물이 있는지 레그마다 알려 줘요. 마지막으로 '전체 표시', 최대 축척으로 항로를 따라가며 육안으로 직접 다시 점검해요.",
      say: "자동 점검이 '안전'이라고 해도, 위험물 경보를 꺼 둔 항목은 안 잡혀요. 마지막엔 해도를 확대해 가며 직접 육안으로 하나하나 점검해 주세요!",
      task: "'항로 점검'을 눌러 결과를 확인해 보세요.",
      check: () => !!S.checkMarks,
      good: "점검 결과가 나왔어요! 경고가 있으면 그 레그를 고쳐 봐요.", bad: "안전 등심선을 흘수보다 얕게 잡으면 점검이 다 통과돼 버려요!" },
    { id: "A7", mood: "explain", target: '[data-act="manage"]', before: plan, title: "항로 세부 조정",
      body: "점검 결과를 바탕으로 WPT를 옮기거나 추가해 위험물과 이격 거리를 확보해요. 레그마다 XTD(항로 이탈 한계)를 해역에 맞게(협수로는 좁게, 대양은 넓게) 정하고, 선회반경과 속력으로 변침 시작점(Wheel over)이 현실적인지 봐요. 레이더용 평행 지시선(PI)도 이때 넣어요.",
      say: "XTD는 '여기까지 벗어나면 경보'가 울리는 선이에요. 좁은 수로에서 1 NM로 두면 경보가 너무 늦게 울려요." },
    { id: "A8", mood: "explain", target: uc, before: plan, title: "User chart 넣기",
      body: "다음은 사용자 해도(User chart)예요. ENC 위에 덧씌우는 '내 투명 필름'으로, 종이해도에 연필로 적던 내용을 여기 그려요. 경보 계산에 쓰이게 할 수도 있어요.",
      say: "이어서 User chart로 무엇을 표시하는지 하나씩 볼게요!" },
    { id: "B1", mood: "explain", target: uc, before: plan, title: "VTS Area",
      body: "구역(다각형)으로 VTS 관제 해역 경계를 그리고 표시 문자에 'VTS ○○ CH 12'처럼 채널을 적어요. 알림을 '들어가면'으로 두면 진입할 때 메시지가 떠요.",
      say: "들어갈 때 메시지가 뜨게 하면 보고를 안 까먹어요." },
    { id: "B2", mood: "caution", target: uc, before: plan, title: "Abort line",
      body: "선을 그리고 'ABORT'라고 빨간색으로 표시해요. 이 선을 넘기 전까지는 항로를 포기하고 돌아갈 수 있는 마지막 지점이에요. 되돌릴 수 없는(Point of no return) 협수로·항내 진입 전에 둬요.",
      say: "Abort line을 넘은 뒤엔 Contingency 계획밖에 없어요!" },
    { id: "B3", mood: "think", target: uc, before: plan, title: "Contingency Anchorage",
      body: "원(반경)이나 점으로 기관 고장·기상 악화 때 쓸 비상 묘박지를 표시해요.", say: "엔진이 멈추면 어디로 가야 할까요? 미리 표시해 둬요." },
    { id: "B4", mood: "explain", target: uc, before: plan, title: "Call Capt. point · S.B.E 지점",
      body: "점을 찍고 'CALL CAPT'라고 적어요. 이른 아침 연안처럼 어선이 많을 시간대면 더 앞쪽으로 당겨요. S.B.E(Standby Engine) 지점도 같은 방식으로 점을 찍고 'S.B.E'라고 적어 둬요.",
      say: "알림을 '10 NM 앞에서'로 두면 미리 깨워 드릴 수 있어요." },
    { id: "B5", mood: "caution", target: uc, before: plan, title: "위험물 표시",
      body: "새로 보고된 침선·어망 구역처럼 ENC에 없는 위험물(항행경보, T&amp;P)을 점·구역으로 그리고 'Danger'를 켜요. 그러면 경보 계산에 들어가요.",
      say: "Danger와 알림 메시지는 같이 못 써요. 위험물은 Danger로 표시해 주세요!" },
    { id: "B6", mood: "explain", target: uc, before: plan, title: "보고 라인",
      body: "선을 그리고 'REPORT: 선명·위치·ETA'처럼 보고 항목을 적어요. VTS·선박 보고제도(Ship reporting system)의 보고선이에요.", say: "알림을 '들어가면'으로 두면 선을 넘을 때 알려 드려요." },
    { id: "B7", mood: "explain", target: uc, before: plan, title: "항내 속도 제한 구역",
      body: "구역을 그리고 'MAX 10 kn'처럼 적어요. 항만 당국이 정한 속도 제한이에요. 한국 주요 항만의 선박 감속 운항 구역도 여기에 표시하면 좋아요.", say: "다가가면 메시지가 뜨게 해 두면 편해요." },
    { id: "B8", mood: "explain", target: uc, before: plan, title: "특정 해역 통과 시 보고 내용",
      body: "구역의 알림 메시지에 보고 항목을 적어요. 예: 해적 위험해역 진입 시 UKMTO 보고, 군사훈련 구역 통과 보고.", say: "보고할 내용을 미리 적어 두면 당황하지 않아요." },
    { id: "B9", mood: "caution", target: uc, before: plan, title: "ECA (배출규제해역)",
      body: "구역을 그리고 'ECA - 0.1% S FUEL'이라고 적어요. 진입 전에 저유황유 전환을 마쳐야 하고, 전환 시각·위치·탱크별 잔량을 기록해요. 전환에 몇 시간이 걸리니 알림을 '10 NM 앞에서'처럼 미리 둬요.",
      say: "연료 전환은 몇 시간 걸려요. 경계선에서 시작하면 늦어요!" },
    { id: "E1", mood: "explain", title: "ECA 정리 ① MARPOL ECA (2026년 11월 기준)",
      body: "시행 중: 발트해 · 북해 · 북미 · 미국 카리브해 · 지중해(2025.5부터) · 캐나다 북극해 · 노르웨이해(2026.3 지정, 황 0.1%는 2027.3부터). 북동대서양은 채택되어 2027.9 발효, 황 0.1%는 2028.9부터 예정이에요. ECA 안은 황 0.10% 이하, 밖은 0.50% 이하예요.",
      say: "ECA는 IMO가 정한 국제 ECA와, 나라가 자기 법으로 정한 자체 규제구역 두 가지예요!",
      note: "규정은 계속 바뀌어요. 기항 전 대리점·선급 안내로 최신 규정을 꼭 확인하세요." },
    { id: "E2", mood: "caution", title: "ECA 정리 ② 한국 — 배출규제해역",
      body: "인천 · 평택·당진 · 여수·광양 · 부산(서측 해역 포함) · 울산 항만의 지정 해역은 황 <b>0.1% 이하</b>(경유 0.05% 이하)예요. 2020.9부터 정박·계류 중, <b>2022.1부터는 규제해역 안을 항해하는 동안에도</b> 적용돼요. 해양경찰이 시료 채취·기록 점검을 하고 겨울~봄에 집중 단속해요.",
      say: "한국 항만 규제해역은 정박할 때뿐 아니라 안에서 항해할 때도 0.1%예요. 부산 서측 해역도 들어간다는 거 기억하세요!" },
    { id: "E3", mood: "caution", title: "ECA 정리 ③ 중국 — 국내 배출규제구역(DECA)",
      body: "본토 연안 12 NM 이내는 황 <b>0.5% 이하</b>, 하이난 섬 주변 지정 수역과 장강·주강 수계 내륙 구역은 <b>0.1% 이하</b>예요. 연안 전역 0.1% 확대는 검토 중이라 수시 확인이 필요해요. 일부 항만은 육상전원 사용 의무가 있고, 스크러버 세정수 배출 금지 구역도 있어요.",
      say: "같은 중국이라도 어디로 가는지에 따라 연료가 달라져요!" },
    { id: "E4", mood: "think", title: "ECA 퀴즈",
      body: "기타 자체 규정 예: EU 항만 정박 중 0.1%, 미국 캘리포니아 연안 24 NM 0.1%, 홍콩 수역 0.5%.",
      say: "부산항에 입항해서 정박할 예정이에요. 연료는 언제까지 바꿔야 할까요?",
      quiz: [["정박하고 나서", false], ["규제해역 경계에 들어가기 전", true], ["부두에 붙은 뒤", false]],
      good: "정답이에요! 2022년부터는 규제해역 안을 항해할 때도 0.1%예요.", bad: "아쉬워요. 지금은 규제해역에 들어가는 순간부터 0.1%가 적용돼요." },
    { id: "B10", mood: "happy", target: uc, before: plan, title: "항로 연결",
      body: "사용자 해도 창에서 '항로 연결'을 쓰면, 항로를 감시할 때 이 사용자 해도가 자동으로 같이 켜져요.", say: "이제 항로를 켜면 직접 그린 표시도 다 같이 나와요!" },
    { id: "A9", clip: "a9", mood: "caution", target: '[data-act="manage"]', cursor: true, before: plan, title: "항해 계기에 적용 · 백업 ECDIS",
      body: "완성한 항로를 '감시' 항로로 불러오면 XTD 경보, WPT 도착, 다음 변침 방위·거리가 표시돼요. 실제 선박에서는 백업 ECDIS에도 같은 항로를 넣고, 두 대의 항로가 같은지(이름·WPT 수·총 거리)를 꼭 비교해요.",
      say: "주 ECDIS만 고치고 백업 ECDIS를 안 고치는 실수가 정말 많아요!",
      task: "'항로 관리'에서 항로를 '백업 ECDIS로 보내기' 한 뒤 '비교'를 눌러 보세요.",
      check: () => Object.keys(S.backup || {}).length > 0,
      good: "백업 ECDIS로 보냈어요! 항로를 고친 뒤에는 꼭 다시 비교해 주세요.", bad: "두 항로가 달라요. 백업 ECDIS로 다시 보내야 해요." },
    { id: "A10", mood: "think", target: '[data-act="owninfo"]', before: navi, title: "Passage Plan 확인 — UKC · Air draft",
      body: "항로 보고서로 WPT 위경도, 침로, 거리, XTD, 속력, ETA, 구간별 최소 수심·UKC를 뽑아 회사 Passage Plan 양식에 옮겨요. 다리·케이블 밑을 지나면 Air draft(수면에서 선체 최고점까지)와 구조물 높이(조석 고려)로 여유 높이를 확인해요. 작성자 → 선장 승인 → 전 항해사 숙지 서명 순서예요. 얕은 구간에서는 속력에 따른 스쿼트(squat)도 UKC에서 빼고 계산해요.",
      say: "흘수 10.0 m, 최소 수심 11.5 m, 회사 UKC 기준이 흘수의 10%면 지나가도 될까요?",
      note: "UKC는 통상 흘수의 10~20%로 잡아요. 회사마다 규정이 다르니 소속 회사 SMS 기준을 꼭 확인하세요.",
      quiz: [["지나가도 돼요 (여유 1.5 m ≥ 필요 1.0 m)", true], ["안 돼요 (여유가 부족해요)", false], ["수심만 10 m 넘으면 돼요", false]],
      good: "맞아요! 기준이 20%면 2.0 m가 필요해서 안 돼요. 속력이 빠르면 스쿼트(squat)로 더 가라앉는다는 것도 잊지 마세요.", bad: "UKC = 수심 − 흘수예요. 11.5 − 10.0 = 1.5 m, 필요한 건 1.0 m예요. 다시 볼까요?" },
    { id: "A11", mood: "happy", target: '[data-act="report"]', before: plan, title: "다른 서류·게시물에 항로 옮기기",
      body: "확정한 항로는 선교 게시용 Passage Plan, 항해일지, 종이해도 백업, 입항 서류, 기관부 통보 등에 같은 값으로 옮겨요. 옮길 때마다 WPT 번호·위경도를 서로 대조해요.",
      say: "항로 계획 과정 끝! 이제 이 항로로 실제로 배를 몰아 볼까요? 교육 메뉴에서 '선박 조종'을 골라 주세요." }
  );
})();

/* ===== 과정 2. 선박 조종 (C) ===== */
(() => {
  const q = (s) => document.querySelector(s);
  const navi = () => { try { if (S.mode !== "NAVI") setMode("NAVI"); } catch (e) {} };
  let hdg0 = 0;
  const dh = () => { const d = ((S.own.hdg - hdg0 + 540) % 360) - 180; return Math.abs(d); };
  Tutor.STEPS.C.push(
    { id: "C1", mood: "explain", target: "#bLvl", before: navi, title: "시나리오 · 상대선 단계",
      body: "시나리오를 고르고 난이도를 정해요. 처음엔 상대선 '없음'이나 '쉬움'으로 해요.", say: "처음부터 '어려움'은 반칙이에요." },
    { id: "C2", mood: "explain", target: '[data-act="helm"]', before: navi, title: "조종 패널",
      body: "타각, 선수방위(HDG), 기관 명령(RPM), 속력이 한 곳에 모여 있어요. 'Conning' 화면에서는 같은 정보를 계기판처럼 크게 볼 수 있어요.",
      say: "Conning 화면은 조타실 앞 계기판이라고 생각하시면 돼요." },
    { id: "C3", clip: "c3", mood: "caution", target: () => { const b = q('[data-adj="rud"][data-d="10"]'); return b && b.parentElement; }, cursor: true, before: () => { navi(); hdg0 = S.own.hdg; }, title: "수동 조타 · 타각 지시",
      body: "타각은 P(좌현) / S(우현)예요. 키를 쓴 뒤 배가 실제로 돌기까지 시간이 걸려요(선회 지연). 해도의 예측 항적(30초 간격 점)으로 미리 보면서, 원하는 침로 조금 전에 반대 키로 멈춰요.",
      say: "반대 키를 너무 늦게 쓰면 침로를 지나쳐 버려요! 이걸 오버슈트라고 해요.",
      task: "S10으로 침로를 30° 바꿔 보세요. (속도를 ×4로 올리면 빨라요)",
      check: () => S.helm === "HAND" && dh() >= 30,
      good: "30° 돌렸어요! 이제 MID로 키를 돌려 침로를 지켜 보세요.", bad: "아직 30°가 안 됐어요. 조금만 더 기다려 보세요." },
    { id: "C4", mood: "think", target: () => { const b = q('[data-act="tele"]'); return b && b.parentElement; }, before: navi, title: "기관 명령 · 속력",
      body: "기관 명령(항해전속~후진)과 RPM 미세 조정으로 속력을 바꿔요. 속력을 줄여도 배는 바로 서지 않아요. 큰 배는 몇 마일을 더 가요.",
      say: "RPM을 낮추면 배가 바로 설까요?",
      quiz: [["관성 때문에 한참 더 가요", true], ["바로 멈춰요", false]],
      good: "맞아요! 그래서 감속은 미리 계획해야 해요.", bad: "배는 브레이크가 없어요. 관성으로 한참 더 가요." },
    { id: "C5", mood: "caution", target: '[data-act="helm"][data-v="AP"]', cursor: true, before: navi, title: "자동 조타 · 설정 선수방위",
      body: "설정한 방위를 유지해요. 조류·바람이 있으면 HDG는 맞아도 COG가 틀어져요.",
      say: "오토파일럿을 켰다고 끝이 아니에요. 항적을 계속 봐 주세요!",
      task: "'자동 조타'를 눌러 보세요.", check: () => S.helm === "AP",
      good: "자동 조타가 켜졌어요! HDG와 COG를 비교해 보세요.", bad: "아직 수동 조타예요." },
    { id: "C6", mood: "explain", target: '[data-act="helm"][data-v="TRACK"]', cursor: true, before: navi, title: "항로 추종 (TRACK)",
      body: "감시 항로를 따라 자동으로 조타해요. WPT에 닿기 전 변침 경고가 떠요. 오른쪽 '항로 정보'에서 XTD를 계속 확인해요.",
      say: "항로선에 딱 붙어 가는지 XTD로 확인해요.",
      task: "'항로 추종'을 눌러 보세요.", check: () => S.helm === "TRACK",
      good: "항로선에 딱 붙어서 가고 있어요!", bad: "감시 항로가 있어야 항로 추종을 쓸 수 있어요." },
    { id: "C7", mood: "happy", title: "조우선 · TSS · 좌초",
      body: "상대선을 피하고(COLREG), TSS 통항 방향을 지켜요. 좌초하면 '직전 안전 위치로'로 돌아가 다시 해 봐요. 마지막 WPT(GOAL) 0.3 NM 안으로 들어가면 시나리오가 끝나요.",
      say: "안전 등심선 경보를 무시하면 안 돼요. 무사히 GOAL까지 가 보세요!" }
  );
})();
