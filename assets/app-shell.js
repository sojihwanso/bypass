/* BYPASS 앱 껍데기 (apps/<주소이름>/index.html 이 불러 씀)

   왜 필요한가
   - 회원이 올린 HTML(apps/<주소이름>/app.html)은 남이 만든 코드라서, 사이트 로그인 정보에 손대지 못하게
     '칸막이(sandbox) iframe' 안에서만 연다. 그런데 칸막이 안에서는 브라우저 저장소(localStorage)가 막혀
     진도가 저장되지 않는다.
   - 그래서 이 껍데기가 앱 안의 localStorage 를 가짜 저장소로 바꿔 끼우고, 앱이 저장할 때마다
     그 내용을 껍데기(사이트 쪽)로 받아서 대신 보관한다.

   어디에 보관하나 (사람마다 따로)
   - 로그인한 사람: 내 계정 (Supabase 표 app_progress, supabase/025_app_progress.sql) → 다른 기기에서도 이어짐
   - 로그인 안 한 사람: 이 브라우저 (사이트 localStorage 'bp-app:<주소이름>')
   - 로그인하기 전에 쌓은 진도는 로그인하면 계정으로 옮겨진다. 둘 다 있으면 더 최근 것을 쓴다.

   앱 쪽은 고칠 것이 없다. 평소처럼 localStorage.getItem / setItem 을 쓰면 된다. */
(async function () {
  const me = document.currentScript;
  const APP = (me && me.dataset.app) || location.pathname.split('/')[2] || '';
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(APP)) return;
  const B = window.BYPASS;
  const sb = B && B.sb;
  const KEY = 'bp-app:' + APP;
  const SAVE_MAX = 1_500_000;   // 한 앱 진도 최대 약 1.5MB (서버 표 제한과 같음)

  /* ----- 화면 ----- */
  const frame = document.createElement('iframe');
  frame.title = document.title;
  // allow-same-origin 은 일부러 뺀다: 앱 코드가 사이트 로그인 정보·저장소에 닿지 못하게
  frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads allow-top-navigation-by-user-activation');
  frame.setAttribute('allow', 'clipboard-write; fullscreen');
  const chip = document.createElement('a');
  chip.className = 'bp-chip';
  chip.hidden = true;
  document.body.append(frame, chip);

  function showChip(text, href) {
    chip.textContent = text;
    if (href) chip.href = href; else chip.removeAttribute('href');
    chip.hidden = false;
    chip.classList.remove('bp-out');
    clearTimeout(showChip.t);
    showChip.t = setTimeout(() => chip.classList.add('bp-out'), 4500);
  }

  /* ----- 보관함 ----- */
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  const writeLocal = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* 저장 공간 부족 등 */ } };

  let session = null;
  if (sb) {
    try { session = (await sb.auth.getSession()).data.session; } catch (e) { session = null; }
    sb.auth.onAuthStateChange((_e, s) => { session = s; });
  }

  // 시작 값: 이 브라우저 것과 계정 것 중 더 최근 것
  let state = readLocal();               // { data: {키: 값}, t: 저장 시각(ms) }
  let fromServer = false;
  if (session) {
    try {
      const { data, error } = await sb.from('app_progress').select('data, updated_at').eq('app', APP).maybeSingle();
      if (!error && data) {
        const t = Date.parse(data.updated_at) || 0;
        if (!state || t >= (state.t || 0)) { state = { data: data.data || {}, t }; fromServer = true; }
      }
    } catch (e) { /* 연결 실패: 이 브라우저 것으로 시작 */ }
  }
  const init = (state && state.data && typeof state.data === 'object') ? state.data : {};

  /* ----- 앱 불러와서 가짜 저장소 끼우기 ----- */
  let html;
  try {
    const res = await fetch(`/apps/${APP}/app.html`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    html = await res.text();
  } catch (e) {
    document.body.innerHTML = '<p style="font:16px/1.6 sans-serif;padding:24px">페이지를 불러오지 못했습니다. 새로고침해 주세요.</p>';
    return;
  }
  const t = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (t && t[1].trim()) { document.title = t[1].trim(); frame.title = document.title; }

  // 앱 안에서 돌아가는 코드 (문자열로 넣는다)
  function storageShim() {
    var D = window.__BP_INIT || {}, timer = 0;
    var has = function (k) { return Object.prototype.hasOwnProperty.call(D, k); };
    function send() { clearTimeout(timer); try { parent.postMessage({ type: 'bp-store', data: D }, '*'); } catch (e) {} }
    function later() { clearTimeout(timer); timer = setTimeout(send, 300); }
    var api = {
      getItem: function (k) { k = String(k); return has(k) ? D[k] : null; },
      setItem: function (k, v) { D[String(k)] = String(v); later(); },
      removeItem: function (k) { delete D[String(k)]; later(); },
      clear: function () { Object.keys(D).forEach(function (k) { delete D[k]; }); later(); },
      key: function (i) { var a = Object.keys(D); return i >= 0 && i < a.length ? a[i] : null; }
    };
    var store = new Proxy(api, {
      get: function (o, p) { if (p === 'length') return Object.keys(D).length; if (p in o) return o[p]; return typeof p === 'string' && has(p) ? D[p] : undefined; },
      set: function (o, p, v) { if (typeof p === 'string' && !(p in o)) { D[p] = String(v); later(); } return true; },
      deleteProperty: function (o, p) { if (has(p)) { delete D[p]; later(); } return true; },
      has: function (o, p) { return p in o || has(p); },
      ownKeys: function () { return Object.keys(D); },
      getOwnPropertyDescriptor: function (o, p) { return has(p) ? { value: D[p], enumerable: true, configurable: true, writable: true } : undefined; }
    });
    try { Object.defineProperty(window, 'localStorage', { value: store, configurable: true, enumerable: true }); } catch (e) {}
    addEventListener('pagehide', send);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(); });
  }
  const json = JSON.stringify(init).replace(/</g, '\\u003c');
  const head = `<base href="${location.origin}/apps/${APP}/"><script>window.__BP_INIT=${json};(${storageShim.toString()})();<\/script>`;
  // 앱의 어떤 코드보다 먼저 실행되도록 맨 앞에 넣는다 (<head> 바로 뒤, 없으면 문서 맨 앞)
  const m = html.match(/<head(\s[^>]*)?>/i);
  html = m ? html.slice(0, m.index + m[0].length) + head + html.slice(m.index + m[0].length) : head + html;
  frame.srcdoc = html;

  /* ----- 앱이 저장하면 받아서 보관 ----- */
  let dirty = false, timer = 0;
  addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow) return;               // 우리 앱에서 온 것만
    const msg = e.data;
    if (!msg || msg.type !== 'bp-store' || !msg.data || typeof msg.data !== 'object') return;
    const data = {};
    for (const [k, v] of Object.entries(msg.data)) if (typeof v === 'string') data[k] = v;
    if (JSON.stringify(data).length > SAVE_MAX) { showChip('진도가 너무 커서 저장하지 못했습니다'); return; }
    state = { data, t: Date.now() };
    writeLocal(state);
    if (session) { dirty = true; clearTimeout(timer); timer = setTimeout(pushServer, 1500); }
  });

  async function pushServer() {
    if (!dirty || !session) return;
    dirty = false;
    const { error } = await sb.from('app_progress').upsert(
      { user_id: session.user.id, app: APP, data: state.data },
      { onConflict: 'user_id,app' }
    );
    if (error) { dirty = true; showChip('계정에 저장하지 못했습니다 · 이 기기에는 저장됨'); }
  }
  // 창을 닫거나 다른 앱으로 넘어갈 때: 남은 것을 바로 보냄 (페이지가 닫혀도 전송되도록 keepalive)
  function flush() {
    if (!dirty || !session || !sb) return;
    dirty = false;
    try {
      fetch(`${sb.supabaseUrl}/rest/v1/app_progress?on_conflict=user_id,app`, {
        method: 'POST', keepalive: true,
        headers: {
          apikey: sb.supabaseKey, Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({ user_id: session.user.id, app: APP, data: state.data })
      });
    } catch (e) { dirty = true; }
  }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  // 로그인 전에 쌓은 진도를 계정으로 옮김
  if (session && state && !fromServer && Object.keys(init).length) { dirty = true; pushServer(); }

  frame.addEventListener('load', () => {
    if (session) showChip('☁ 진도가 내 계정에 저장됩니다');
    else showChip('이 기기에만 저장 중 · 로그인하면 어디서나 이어서', `/login/?next=${encodeURIComponent(location.pathname)}`);
  }, { once: true });
})();
