/* SMCP 무전 교신 훈련소 · 공통 엔진
   연습실(practice/)과 실전 교신(radio/)이 함께 씀.
   - 채점: norm, grade, skeleton
   - 소리: speak(읽어 주기 + 무전 잡음), squelch, noise
   - 음성인식: listener (누르고 말하기)
   - 기록: best (브라우저에 최고 점수 저장)
   문제 데이터는 scenarios.js (window.SMCP) */
(() => {
'use strict';
const D = window.SMCP;

/* ───────── 채점용 문장 정리 ─────────
   "Zero-niner-zero" / "0 9 0" / "090" → "090". "ninety" 는 그대로 남아 틀림 처리 */
const NUM = { zero:'0', zeero:'0', one:'1', wun:'1', two:'2', too:'2', three:'3', tree:'3',
  four:'4', fower:'4', five:'5', fife:'5', six:'6', seven:'7', eight:'8', ait:'8', nine:'9', niner:'9', nina:'9' };
const aliasList = [];
for (const [right, wrongs] of Object.entries(D.aliases || {}))
  for (const w of wrongs) aliasList.push([w.toLowerCase().replace(/[-.']/g, ' ').replace(/\s+/g, ' ').trim(), right]);
aliasList.sort((a, b) => b[0].length - a[0].length);

function norm(s) {
  let t = ' ' + String(s).toLowerCase().replace(/[-–—_/]/g, ' ').replace(/[^a-z0-9à-ÿ\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  for (const [w, r] of aliasList) t = t.split(' ' + w + ' ').join(' ' + r + ' ');
  const out = [];
  for (const w0 of t.trim().split(' ').filter(Boolean)) {
    const w = NUM[w0] ?? w0;
    if (/^\d+$/.test(w) && out.length && /^\d+$/.test(out[out.length - 1])) out[out.length - 1] += w;
    else out.push(w);
  }
  return ' ' + out.join(' ') + ' ';
}
function count(hay, needle) {
  if (!needle.trim()) return 0;
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length - 1; }
  return n;
}

/* ───────── 시나리오 준비 ───────── */
function scenario(id) {
  const base = D.scenarios.find(x => x.id === id);
  return base ? Object.assign({}, base, { ship: Object.assign({}, D.ship, base.ship || {}) }) : null;
}
const fill = (s, sc) => String(s).replace(/\{ship\}/g, sc.ship.name).replace(/\{station\}/g, sc.station);
function resolve(c) {
  if (typeof c !== 'string') return c;
  const p = D.presets[c];
  if (!p) { console.warn('scenarios.js: 없는 preset 이름', c); return { label: c, say: [c] }; }
  return p;
}

/* ───────── 채점 ───────── */
function grade(answer, turn, sc, extra) {
  const a = norm(answer);
  const items = turn.check.map(resolve).map(c => {
    let ok;
    if (c.not) ok = !c.not.some(x => count(a, norm(fill(x, sc))) > 0);
    else ok = (c.say || []).some(x => count(a, norm(fill(x, sc))) >= (c.times || 1));
    return { label: c.label, tip: c.tip ? fill(c.tip, sc) : '', ok, pts: c.pts || 1 };
  });
  for (const x of (extra || [])) items.push(Object.assign({ pts: 1 }, x));
  const total = items.reduce((s, x) => s + x.pts, 0);
  const got = items.reduce((s, x) => s + (x.ok ? x.pts : 0), 0);
  return { items, score: Math.round(got / total * 100), pass: Math.round(got / total * 100) >= D.passScore };
}

/* ───────── 힌트 뼈대: 표준 답안에서 값만 빈칸으로 ───────── */
const KEEP = new Set(('this is over out my your i will am is are the of to at in on and a an all stations ' +
  'position course speed eta draft degrees knots miles mile metres metre persons board require request ' +
  'information intention question answer warning advice instruction correction say again ' +
  'mayday pan securite call sign negative affirmative changing channel').split(' '));
function skeleton(model, sc) {
  const NB = ' ';
  for (const n of [sc.ship.name, sc.station]) model = model.split(n).join(n.replace(/ /g, NB));
  const out = [];
  for (const raw of model.split(/ +/)) {
    const core = raw.toLowerCase().replace(/[^a-z -]/g, '');
    const keep = core && (raw.includes(NB) || KEEP.has(core) || core === 'pan-pan');
    if (keep) out.push(raw.replace(/ /g, ' '));
    else {
      const tail = (raw.match(/[.,]$/) || [''])[0];
      const prev = out[out.length - 1];
      if (prev && /^_+$/.test(prev)) out[out.length - 1] = '_____' + tail;
      else out.push('_____' + tail);
    }
  }
  return out.join(' ');
}

/* ───────── 소리 ───────── */
let ac = null, noiseBuf = null;
function audio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
function noise(vol, dur) {
  const c = audio(); if (!c) return () => {};
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = .7;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(bp).connect(g).connect(c.destination); src.start();
  let done = false;
  const stop = () => { if (done) return; done = true; try { g.gain.setTargetAtTime(0, c.currentTime, .03); src.stop(c.currentTime + .2); } catch (e) {} };
  if (dur) setTimeout(stop, dur);
  return stop;
}
const squelch = () => noise(.22, 140);
function beep(freq, dur, vol) {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'square'; o.frequency.value = freq || 2200; g.gain.value = vol || .03;
  o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + (dur || 60) / 1000);
}

/* 영어 목소리 고르기
   안드로이드 Chrome 등은 목소리를 직접 지정하지 않으면 lang 을 무시하고 기기 기본(한국어) 목소리로 읽음.
   그래서 반드시 영어 목소리 객체를 찾아서 지정함. 목록은 늦게 도착할 수 있어서 기다렸다가 고름 */
let voice = null;
const isEn = v => /^en([-_]|$)/i.test(v.lang || '') && !/ko|kr|korea/i.test(v.lang + ' ' + v.name);
function score(v) {
  const l = (v.lang || '').replace('_', '-').toLowerCase(), n = (v.name || '').toLowerCase();
  let s = 0;
  if (l === 'en-gb') s += 30; else if (l === 'en-us') s += 25; else if (/en-(au|ie|in|za|nz|ca)/.test(l)) s += 18; else s += 10;
  if (/google|natural|neural|premium|enhanced/.test(n)) s += 8;
  if (/daniel|serena|kate|arthur|samantha|karen|moira|libby|ryan|sonia/.test(n)) s += 5;
  if (v.localService) s += 2;
  return s;
}
function pickVoice() {
  const vs = ((window.speechSynthesis && speechSynthesis.getVoices()) || []).filter(isEn);
  voice = vs.sort((a, b) => score(b) - score(a))[0] || null;
  return voice;
}
let voicesReady = null;
function ensureVoice() {
  if (voice || !window.speechSynthesis) return Promise.resolve(voice);
  if (pickVoice()) return Promise.resolve(voice);
  if (!voicesReady) voicesReady = new Promise(res => {
    const done = () => { pickVoice(); res(voice); };
    speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    let n = 0; const poll = setInterval(() => { if (pickVoice() || ++n > 20) { clearInterval(poll); res(voice); } }, 100);
  });
  return voicesReady;
}
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
/* 이 기기에 영어 목소리가 있는지 (안내 문구용) */
function voiceInfo() { if (window.SMCP_VOICE && Object.keys(window.SMCP_VOICE).length) return Promise.resolve({ ok: true, recorded: true }); return ensureVoice().then(v => v ? { ok: true, name: v.name, lang: v.lang } : { ok: !window.speechSynthesis ? null : false }); }

/* ───────── 녹음 파일 (voice/build.py 가 만든 고품질 녹음) ─────────
   window.SMCP_VOICE = { "fx|대사": "voice/audio/x.mp3", "slow|대사": ..., "model|대사": ... }
   녹음이 있으면 녹음을, 없으면 브라우저 목소리로 읽음 */
const BASE = ((document.currentScript && document.currentScript.src) || '').replace(/engine\.js(\?.*)?$/, '');
const splitParts = text => String(text).split(/\s*\.\.\.\s*(?:\.\.\.\s*)?/).map(p => p.trim()).filter(Boolean);
const bufCache = {};
let playing = [];
function clipUrl(role, part) { const m = window.SMCP_VOICE; return m && m[role + '|' + part] ? BASE + m[role + '|' + part] : null; }
function loadBuf(url) {
  if (!bufCache[url]) bufCache[url] = fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(b => new Promise((res, rej) => audio().decodeAudioData(b, res, rej)))
    .catch(e => { delete bufCache[url]; throw e; });
  return bufCache[url];
}
function playBuf(buf) {
  return new Promise(res => {
    const c = audio(); const src = c.createBufferSource(); src.buffer = buf;
    src.connect(c.destination); src.onended = () => { playing = playing.filter(x => x !== src); res(); };
    playing.push(src); src.start();
  });
}
/* 대사 녹음을 미리 받아 두기 (교신 시작 전에 불러 두면 끊김 없음) */
function preload(texts, role) {
  if (!audio()) return;
  for (const t of texts) for (const p of splitParts(t || '')) { const u = clipUrl(role || 'fx', p); if (u) loadBuf(u).catch(() => {}); }
}

let speakToken = 0;
function stopSpeaking() {
  speakToken++;
  if (window.speechSynthesis) speechSynthesis.cancel();
  for (const s of playing) { try { s.stop(); } catch (e) {} }
  playing = [];
}
/* 읽어 주기. "..." 는 잡음에 묻힌 부분.
   opts.rate < .85 이면 느린 녹음, opts.role = 'model' 이면 표준 예시 녹음(깨끗한 목소리), opts.bed = 0 이면 잡음 없음 */
async function speak(text, opts) {
  opts = opts || {};
  const my = ++speakToken;
  const role = opts.role === 'model' ? 'model' : (opts.rate && opts.rate < .85 ? 'slow' : 'fx');
  const parts = splitParts(text);
  const urls = parts.map(p => clipUrl(role, p));
  if (audio() && parts.length && urls.every(Boolean)) {
    let bufs = null;
    try { bufs = await Promise.all(urls.map(loadBuf)); } catch (e) { bufs = null; }
    if (bufs && my === speakToken) return playClips(bufs, text, opts, my);
  }
  if (my !== speakToken) return;
  return speakTTS(text, opts, my);
}
async function playClips(bufs, text, opts, my) {
  const radio = opts.role !== 'model';
  if (radio) squelch();
  const bed = radio ? noise(opts.bed ?? .03) : () => {};
  await new Promise(r => setTimeout(r, radio ? 160 : 0));
  const garbled = /\.\.\./.test(text) && /^\s*\.\.\./.test(text);
  for (let i = 0; i < bufs.length; i++) {
    if (my !== speakToken) break;
    if (i > 0 || garbled) { noise(.25, 700); await new Promise(r => setTimeout(r, 700)); }
    if (my !== speakToken) break;
    await playBuf(bufs[i]);
  }
  bed();
  if (radio && my === speakToken) { await new Promise(r => setTimeout(r, 120)); squelch(); }
}
function speakTTS(text, opts, my) {
  return ensureVoice().then(() => new Promise(res => {
    if (my !== speakToken) return res();
    squelch();
    if (!window.speechSynthesis) return setTimeout(res, 600);
    speechSynthesis.cancel();
    const parts = text.split(/\s*\.\.\.\s*(?:\.\.\.\s*)?/);
    const bed = noise(opts.bed ?? .035);
    let i = 0;
    const end = () => { bed(); setTimeout(() => { if (my === speakToken) squelch(); res(); }, 150); };
    const nextPart = () => {
      if (my !== speakToken) return end();
      if (i >= parts.length) return end();
      const p = parts[i++];
      if (i > 1) noise(.25, 700);
      if (!p.trim()) return setTimeout(nextPart, i > 1 ? 700 : 0);
      const u = new SpeechSynthesisUtterance(p.replace(/-/g, ' '));
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang.replace('_', '-') : 'en-US'; u.rate = opts.rate || .92;
      // 목소리가 없는 기기에서는 onend 가 안 올 수 있어서, 길이로 어림한 시간이 지나면 넘어감
      let fired = false;
      const after = () => { if (fired) return; fired = true; clearTimeout(guard); setTimeout(nextPart, i < parts.length ? 700 : 0); };
      const guard = setTimeout(after, 1500 + p.split(/\s+/).length * 520 / (opts.rate || .92));
      u.onend = after; u.onerror = after;
      speechSynthesis.speak(u);
    };
    setTimeout(nextPart, 180);
  }));
}

/* ───────── 음성인식 (누르고 말하기) ─────────
   const L = listener({ onText(t), onDone(t), onError(msg) }); L.start(); L.stop(); */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function listener(cb) {
  let rec = null, fin = '', live = '', prev = '', holding = false, want = false;
  const heard = () => (prev + ' ' + (fin || live)).trim();
  return {
    supported: !!SR,
    get on() { return holding; },
    start() {
      if (!SR || holding) return false;
      stopSpeaking();
      holding = true; want = false; fin = live = prev = '';
      rec = new SR(); rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;
      rec.onresult = e => {
        let f = '', m = '';
        for (let i = 0; i < e.results.length; i++) (e.results[i].isFinal ? (f += e.results[i][0].transcript + ' ') : (m += e.results[i][0].transcript));
        fin = f; live = f + m; cb.onText && cb.onText((prev + ' ' + live).trim());
      };
      rec.onerror = e => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') cb.onError && cb.onError('마이크 권한이 꺼져 있어요. 주소창 옆 자물쇠에서 마이크를 허용하거나, 타자로 답해 주세요.', true);
        else if (e.error === 'network') cb.onError && cb.onError('음성인식에 인터넷 연결이 필요해요.', false);
      };
      rec.onend = () => {
        if (holding) { prev = heard(); fin = live = ''; try { rec.start(); } catch (e) {} return; }
        if (want) cb.onDone && cb.onDone(heard());
      };
      try { rec.start(); } catch (e) {}
      return true;
    },
    stop() {
      if (!holding) return;
      holding = false; want = true;
      try { rec.stop(); } catch (e) { cb.onDone && cb.onDone(heard()); }
    }
  };
}

/* ───────── 기록 (브라우저 저장) ───────── */
const best = {
  all(key) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; } },
  set(key, id, v) {
    try { const b = best.all(key); if (!(b[id] >= v)) { b[id] = v; localStorage.setItem(key, JSON.stringify(b)); } } catch (e) {}
  }
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

window.SMCP_ENGINE = { D, norm, grade, skeleton, scenario, fill, audio, noise, squelch, beep, speak, stopSpeaking, preload, voiceInfo, listener, SR: !!SR, best, esc };
})();
