/* 레이더 시뮬레이터 교육 과정 — ECDIS 시뮬레이터 tutor.js 엔진을 옮겨 씀(배경 어둡게 + 강조 + 도도 팝업).
   도도 그림은 ECDIS 것을 그대로 참조. 단계 데이터는 edu-steps.js. 공개: window.Tutor */
(() => {
  const KEY = "radar-edu", DONE_KEY = "radar-edu-done", ORDER = ["R1", "R2", "R3", "R4", "R5"], DODO = "../ecdis/edu/dodo_";
  const doneList = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY) || "[]"); } catch (e) { return []; } };
  const markDone = (c) => { const d = doneList(); if (!d.includes(c)) d.push(c); try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (e) {} };
  const ck = (k) => (doneList().includes(k) ? `<span class="tu-ck" aria-label="완료">✓</span>` : "");
  const MOOD = { explain: "설명", happy: "기쁨", oops: "당황", caution: "주의", think: "생각" };
  const COURSES = {
    R1: { name: "과정 1 · 화면과 영상 조정", sub: "처음이라면 여기부터 · 송신 · GAIN · SEA · RAIN · 밴드" },
    R2: { name: "과정 2 · 거리·방위 재기와 화면 모드", sub: "커서 · EBL · VRM · 방위·운동 모드 · PI · 마크" },
    R3: { name: "과정 3 · TT · AIS · Trial maneuver", sub: "포착 · 벡터 · CPA/TCPA · 경보 · 물표 목록" },
    R4: { name: "과정 4 · 거짓 상과 클러터", sub: "다중 반사 · 사이드로브 · 그림자 · 간섭 · SART" },
    R5: { name: "과정 5 · 충돌 회피 시나리오", sub: "판단 순서 · 배속과 날씨 · Conning · 결과" },
  };
  // 단계 데이터: Tutor.STEPS[course] = [{id,title,body,say,mood,target?,before?,check?,good?,bad?,note?,quiz?,cursor?}]
  const STEPS = { R1: [], R2: [], R3: [], R4: [], R5: [] };

  const $ = (q, r = document) => r.querySelector(q);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let cur = null; // {course, step}
  // 교육 중 경보음: 들어가자마자 울리지 않게 기본은 끔. 단계에 sound:true면 켜고, 사용자가 단추로 바꾸면 그 과정 동안은 그 선택을 따른다
  let active = false, sndOver = null, snd = null;
  let root, spot, pop, chip, cursor, timer = null, reacted = false, manual = null, drag = null, engaged = false, clicks = [];

  const CSS = `
#tuRoot{position:fixed;inset:0;z-index:90;pointer-events:none;font-family:inherit}
#tuRoot .tu-dim{position:absolute;inset:0;background:rgba(8,14,24,.72);opacity:0;transition:opacity .45s}
#tuRoot.on .tu-dim.show{opacity:1}
.tu-spot{position:absolute;border-radius:10px;box-shadow:0 0 0 4000px rgba(8,14,24,.72);transition:left .5s cubic-bezier(.4,.1,.2,1),top .5s cubic-bezier(.4,.1,.2,1),width .5s,height .5s;opacity:0}
#tuRoot.on .tu-spot.show{opacity:1}
.tu-spot.tu-lite{box-shadow:none}
.tu-glow{position:relative;z-index:1;animation:tuGlow 1.3s ease-out infinite;outline:2px solid #FF7A26;outline-offset:1px}
@keyframes tuGlow{0%{box-shadow:0 0 0 0 rgba(255,122,38,.55)}80%{box-shadow:0 0 0 12px rgba(255,122,38,0)}100%{box-shadow:0 0 0 0 rgba(255,122,38,0)}}
@media (prefers-reduced-motion:reduce){.tu-glow{animation:none}}
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
#tuRoot .tu-snd{position:fixed;left:50%;top:100px;transform:translateX(-50%);display:none;align-items:center;gap:6px;pointer-events:auto;background:#fff;color:#241008;border:2px solid #241008;border-radius:999px;padding:6px 14px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;box-shadow:3px 3px 0 rgba(36,16,8,.85)}
#tuRoot .tu-snd.show{display:flex}
#tuRoot .tu-snd.on{background:#E6F6EA}
.tu-cursor{position:absolute;width:26px;height:26px;pointer-events:none;display:none;filter:drop-shadow(1px 2px 1px rgba(0,0,0,.4))}
.tu-cursor.show{display:block;animation:tuCur 2.2s ease-in-out infinite}
@keyframes tuCur{0%{transform:translate(var(--fx),var(--fy));opacity:0}15%{opacity:1}55%{transform:translate(var(--tx),var(--ty)) scale(1)}62%{transform:translate(var(--tx),var(--ty)) scale(.8)}70%{transform:translate(var(--tx),var(--ty)) scale(1)}90%{opacity:1}100%{transform:translate(var(--tx),var(--ty));opacity:0}}
@media (prefers-reduced-motion:reduce){.tu-spot::after,.tu-cursor.show,.tu-dodo.tu-bnc{animation:none}}`;

  function mount() {
    if (root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement("div"); root.id = "tuRoot";
    root.innerHTML = `<div class="tu-dim"></div><div class="tu-spot"></div><svg class="tu-cursor" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.5L16 20l-3 1.5-3.5-7.5L4 18z" fill="#FF7A26" stroke="#241008" stroke-width="1.6" stroke-linejoin="round"/></svg><div class="tu-pop" role="dialog" aria-live="polite"></div><button type="button" class="tu-chip"><img src="${DODO}explain.webp" alt="">교육 중 · <span></span></button>`;
    snd = document.createElement("button"); snd.type = "button"; snd.className = "tu-snd"; root.appendChild(snd);
    snd.onclick = () => { sndOver = !(sndOver ?? soundStep()); applySnd(); };
    document.body.appendChild(root);
    spot = $(".tu-spot", root); pop = $(".tu-pop", root); chip = $(".tu-chip", root); cursor = $(".tu-cursor", root);
    chip.onclick = () => { document.querySelectorAll("dialog[open]").forEach((d) => d.close()); };
    pop.addEventListener("click", onClick); pop.addEventListener("pointerdown", onDown);
    addEventListener("resize", place);
    // 비춘 버튼이나 화면을 직접 누르면 그 단계에서는 어두운 막을 걷어 결과가 보이게
    document.addEventListener("pointerdown", (e) => { if (!cur || (e.target.closest && e.target.closest("#tuRoot"))) return; clicks.push(e.target); if (!engaged) { engaged = true; place(); } }, true);
  }
  // 좁은 세로 화면(휴대폰 세로) 여부 — 테스트에서 바꿔 끼울 수 있게 Tutor._narrow로 노출
  const narrow = () => (window.Tutor && Tutor._narrow ? Tutor._narrow() : matchMedia("(orientation: portrait) and (max-width: 900px)").matches);

  function face(m) {
    const img = $(".tu-dodo", pop); if (!img) return;
    img.src = DODO + m + ".webp"; img.classList.remove("tu-bnc"); void img.offsetWidth; img.classList.add("tu-bnc");
  }
  const steps = () => (cur ? STEPS[cur.course] : []);
  const stepObj = () => steps()[cur.step];
  const soundStep = () => { const s = cur && stepObj(); return !!(s && s.sound); };
  function applySnd() {
    const on = sndOver ?? soundStep();
    window.EDU_MUTE = active && !on;
    if (!snd) return;
    snd.classList.toggle("show", active); snd.classList.toggle("on", on);
    snd.textContent = on ? "🔊 경보음 켜짐 · 끄기" : "🔇 교육 중 경보음 꺼짐 · 켜기";
    snd.setAttribute("aria-pressed", String(on));
  }
  const targetEl = (s) => { if (!s || !s.target) return null; const el = typeof s.target === "function" ? s.target() : $(s.target); if (!el) return null; const r = el.getBoundingClientRect(); return r.width || r.height ? el : null; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {} };

  function render() {
    const s = stepObj(), n = steps().length;
    const quiz = s.quiz ? `<div class="tu-quiz">${s.quiz.map((q, i) => `<button type="button" data-q="${i}">${esc(q[0])}</button>`).join("")}</div>` : "";
    pop.innerHTML = `<div class="tu-ph" title="끌어서 옮길 수 있어요"><span class="tu-grip" aria-hidden="true">⠿</span><span class="tu-tag">${esc(s.id)}</span><span class="tu-course">${esc(COURSES[cur.course].name)}</span><span class="tu-cnt">${cur.step + 1} / ${n}</span><button type="button" class="tu-x" data-tu="stop" aria-label="교육 끝내기">×</button></div>
<div class="tu-pb"><div class="tu-face"><img class="tu-dodo" alt="도도" src="${DODO}${s.mood || "explain"}.webp"></div><div class="tu-txt"><h3>${esc(s.title)}</h3><p>${s.body}</p></div></div>
<div class="tu-bub">${s.say}</div>${s.note ? `<div class="tu-note">${s.note}</div>` : ""}${s.task ? `<div class="tu-task">해 보기 · ${s.task}</div>` : ""}${s.clip ? `<div class="tu-clip"><button type="button" class="tu-cbtn" data-tu="clip" aria-expanded="false">▶ 시연 보기</button><div class="tu-vid"></div></div>` : ""}${quiz}
<div class="tu-pf"><span class="tu-en">${document.documentElement.lang === "en" ? "교육 과정은 한국어로 제공됩니다 (Korean only)" : ""}</span><button type="button" class="tu-btn" data-tu="prev"${cur.step ? "" : " disabled"}>이전</button><button type="button" class="tu-btn pri" data-tu="next">${cur.step === n - 1 ? "끝내기" : "다음"}</button></div>`;
    pop.classList.toggle("tu-narrow", narrow());
    face(s.mood || "explain");
  }

  function place() {
    if (!cur || !pop || !pop.firstChild) return;
    const s = stepObj(); if (!s) return;
    const menuOpen = [...document.querySelectorAll(".pop")].some((e) => !e.closest("#tuRoot") && e.getBoundingClientRect().width > 0);
    let minimize = (engaged && s.foldOnUse && !reacted) || menuOpen || !!document.querySelector("dialog[open]") || (typeof dlgStack !== "undefined" && dlgStack.length > 0 && !(targetEl(s) && targetEl(s).closest(".dlg")));
    // 대상이 대화상자 안에 있으면 그 대화상자와 겹치지 않는 자리를 찾고, 없으면 접기
    const t0 = !minimize && targetEl(s), inDlg = t0 && t0.closest(".dlg");
    let dlgSpot = null;
    if (inDlg && !manual) {
      const A = inDlg.getBoundingClientRect(), W0 = innerWidth, H0 = innerHeight, pw0 = pop.offsetWidth, ph0 = pop.offsetHeight, cx0 = (A.left + A.right) / 2, cy0 = (A.top + A.bottom) / 2;
      const fits = (x, y) => x >= 12 && y >= 12 && x + pw0 <= W0 - 12 && y + ph0 <= H0 - 12;
      const cands = [[cx0 - pw0 / 2, A.bottom + 16], [cx0 - pw0 / 2, A.top - 16 - ph0], [A.right + 20, cy0 - ph0 / 2], [A.left - 20 - pw0, cy0 - ph0 / 2]].map(([x, y]) => [Math.max(12, Math.min(W0 - pw0 - 12, x)), Math.max(12, Math.min(H0 - ph0 - 12, y))]);
      dlgSpot = cands.find(([x, y]) => fits(x, y) && !(x < A.right && x + pw0 > A.left && y < A.bottom && y + ph0 > A.top)) || null;
      if (!dlgSpot) minimize = true;
    }
    chip.classList.toggle("show", minimize); $("span", chip).textContent = s.id;
    pop.style.visibility = minimize ? "hidden" : "visible";
    // 팝업이 접혀도 대화상자 안의 대상은 계속 비추고 강조
    const el = minimize ? (inDlg ? t0 : null) : targetEl(s);
    document.querySelectorAll(".tu-glow").forEach((g) => { if (g !== el || !s.glow) g.classList.remove("tu-glow"); });
    if (el && s.glow) el.classList.add("tu-glow");
    spot.classList.toggle("show", !!el); spot.classList.toggle("tu-lite", engaged || (minimize && !!el)); $(".tu-dim", root).classList.toggle("show", !el && !minimize && !engaged);
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
    if (dlgSpot) { x = dlgSpot[0]; y = dlgSpot[1]; }
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
    mount(); ensurePop(); cur.step = Math.max(0, Math.min(steps().length - 1, i)); save(); reacted = false; manual = null; engaged = false; clicks = [];
    const s = stepObj();
    applySnd();
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
    if (q) { const st = stepObj(), ok = !!st.quiz[+q.dataset.q][1]; q.classList.add(ok ? "ok" : "no"); if (ok && st.onGood) { try { st.onGood(); } catch (er) {} } react(ok ? "good" : "bad"); return; }
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
    mount(); stop(); active = true; applySnd(); ensurePop();
    const d = doneList(), after = ORDER.slice(ORDER.indexOf(c) + 1).concat(ORDER.slice(0, ORDER.indexOf(c)));
    const rec = after.find((k) => !d.includes(k)) || null;
    const others = ORDER.filter((k) => k !== rec);
    const btn = (k, main) => `<button type="button" data-tu="pick" data-c="${k}"${main ? ' class="tu-rec"' : ""}><b>${main ? "추천 · " : ""}${esc(COURSES[k].name)}${ck(k)}</b><small>${esc(COURSES[k].sub)} · ${STEPS[k].length}단계</small></button>`;
    pop.innerHTML = `<div class="tu-done"><div class="tu-ph" title="끌어서 옮길 수 있어요"><span class="tu-grip" aria-hidden="true">⠿</span><span class="tu-tag">완료</span><span class="tu-course">${esc(COURSES[c].name)}</span><button type="button" class="tu-x" data-tu="stop" aria-label="닫기" style="margin-left:auto">×</button></div>
<div class="tu-pb"><div class="tu-face"><img class="tu-dodo tu-bnc" alt="도도" src="${DODO}happy.webp"></div><div class="tu-txt"><h3>${esc(COURSES[c].name)} 완료!</h3><p>${rec ? "수고했어요! 바로 이어서 다음 과정을 해 볼까요?" : "모든 과정을 마쳤어요! 다시 보고 싶은 과정을 골라 보세요."}</p></div></div>
<div class="tu-menu">${rec ? btn(rec, true) : ""}${others.map((k) => btn(k, false)).join("")}</div>
<div class="tu-pf"><span class="tu-en"></span><button type="button" class="tu-btn" data-tu="stop">교육 끝내기</button></div></div>`;
    pop.classList.toggle("tu-narrow", narrow());
    root.classList.add("on"); $(".tu-dim", root).classList.add("show"); spot.classList.remove("show");
    pop.style.visibility = "visible"; pop.style.left = (innerWidth - pop.offsetWidth) / 2 + "px"; pop.style.top = Math.max(12, (innerHeight - pop.offsetHeight) / 2) + "px";
    requestAnimationFrame(() => pop.classList.add("on"));
  }
  function saved() { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && STEPS[v.course] && STEPS[v.course][v.step] ? v : null; } catch (e) { return null; } }

  function start(course, step) { if (!STEPS[course] || !STEPS[course].length) return; mount(); active = true; sndOver = null; cur = { course, step: step || 0 }; show(cur.step); }
  function stop() {
    clearInterval(timer); timer = null; cur = null; active = false; applySnd(); document.querySelectorAll(".tu-glow").forEach((g) => g.classList.remove("tu-glow"));
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
    mount(); stop(); cur = null; active = true; sndOver = null; applySnd(); ensurePop();
    const sv = saved();
    pop.innerHTML = `<div class="tu-ph"><span class="tu-tag">EDU</span><span class="tu-course">레이더 교육 과정</span><button type="button" class="tu-x" data-tu="stop" aria-label="닫기" style="margin-left:auto">×</button></div>
<div class="tu-pb"><div class="tu-face"><img class="tu-dodo tu-bnc" alt="도도" src="${DODO}explain.webp"></div><div class="tu-txt"><h3>무엇부터 배워 볼까요?</h3><p>설명할 버튼만 밝게 비추고, 직접 해 보면 맞았는지 알려 드려요. 언제든 × 로 끝낼 수 있어요.</p></div></div>
${narrow() ? `<div class="tu-rot"><b>📱 가로 화면을 권장해요</b>휴대폰을 가로로 돌려서 하면 설명과 버튼이 잘 보여요. 세로 화면에서도 진행할 수는 있어요.</div>` : ""}<div class="tu-menu">${sv ? `<button type="button" data-tu="resume"><b>이어서 하기 · ${esc(COURSES[sv.course].name)}</b><small>지난번 멈춘 곳부터 · ${sv.step + 1} / ${STEPS[sv.course].length}</small></button>` : ""}${Object.keys(COURSES).map((k) => `<button type="button" data-tu="pick" data-c="${k}"><b>${esc(COURSES[k].name)}${ck(k)}</b><small>${esc(COURSES[k].sub)} · ${STEPS[k].length}단계</small></button>`).join("")}</div>
<div class="tu-pf"><span class="tu-en">${document.documentElement.lang === "en" ? "교육 과정은 한국어로 제공됩니다 (Korean only)" : ""}</span></div>`;
    root.classList.add("on"); $(".tu-dim", root).classList.add("show"); spot.classList.remove("show");
    pop.style.visibility = "visible"; pop.style.left = (innerWidth - pop.offsetWidth) / 2 + "px"; pop.style.top = Math.max(12, (innerHeight - pop.offsetHeight) / 2) + "px";
    requestAnimationFrame(() => pop.classList.add("on"));
  }

  const clicked = (sel, text) => clicks.some((el) => { const h = el.closest && el.closest(sel); return !!h && (!text || (el.textContent || "").includes(text) || (h.textContent || "").includes(text)); });
  window.Tutor = { clicked, _narrow: null, STEPS, COURSES, menu, start, next, prev, stop, react, state: () => (cur ? { course: cur.course, step: cur.step } : null) };
})();

