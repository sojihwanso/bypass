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

let voice = null;
function pickVoice() {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  voice = vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

let speakToken = 0;
function stopSpeaking() { speakToken++; if (window.speechSynthesis) speechSynthesis.cancel(); }
/* 읽어 주기. "..." 는 잡음에 묻힌 부분. opts.rate 로 속도 조절 */
function speak(text, opts) {
  opts = opts || {};
  const my = ++speakToken;
  return new Promise(res => {
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
      u.lang = voice ? voice.lang : 'en-GB'; u.rate = opts.rate || .92;
      // 목소리가 없는 기기에서는 onend 가 안 올 수 있어서, 길이로 어림한 시간이 지나면 넘어감
      let fired = false;
      const after = () => { if (fired) return; fired = true; clearTimeout(guard); setTimeout(nextPart, i < parts.length ? 700 : 0); };
      const guard = setTimeout(after, 1500 + p.split(/\s+/).length * 520 / (opts.rate || .92));
      u.onend = after; u.onerror = after;
      speechSynthesis.speak(u);
    };
    setTimeout(nextPart, 180);
  });
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

window.SMCP_ENGINE = { D, norm, grade, skeleton, scenario, fill, audio, noise, squelch, beep, speak, stopSpeaking, listener, SR: !!SR, best, esc };
})();
