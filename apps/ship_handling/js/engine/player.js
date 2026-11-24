/* 재생 상태(시간·재생 여부·속도)와 재생바 연결 */
export function createPlayer({ dur, steps = [] }) {
  const p = {
    t: 0, dur, playing: false, rate: 1, steps,
    seek(t) { p.t = Math.min(p.dur, Math.max(0, t)); },
    seekFrac(f) { p.seek(f * p.dur); },
    setPlaying(b) { if (b && p.t >= p.dur - 1e-6) p.t = 0; p.playing = !!b; },
    tick(dt) { if (!p.playing) return; p.t += dt * p.rate; if (p.t >= p.dur) { p.t = p.dur; p.playing = false; } },
    rebuild(newDur, keepFrac) { const f = p.dur ? p.t / p.dur : 0; p.dur = newDur; p.t = keepFrac ? f * newDur : 0; },
    stepIndex() { let k = 0; p.steps.forEach((s, i) => { if (p.t >= s.t - 1e-6) k = i; }); return k; }
  };
  return p;
}

const fmt = s => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
export function realTime(s) { s = Math.max(0, Math.round(s)); if (s < 60) return s + '초'; const m = Math.floor(s / 60), r = s % 60; return m + '분' + (r ? ' ' + r + '초' : ''); }

/* root 안의 [data-p] 요소들을 재생기에 연결한다.
   play, restart, scrub(input range 0..1000), fill, ticks, time, rate 버튼(data-rate) */
export function bindPlayerUI(p, root, { scale = () => 1, onSeek = () => {} } = {}) {
  const q = s => root.querySelector(`[data-p="${s}"]`);
  const play = q('play'), scrub = q('scrub'), fill = q('fill'), ticks = q('ticks'), time = q('time');
  const icon = () => { play.innerHTML = p.playing ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>'; play.setAttribute('aria-label', p.playing ? '정지' : '재생'); };
  play.onclick = () => { p.setPlaying(!p.playing); icon(); };
  q('restart').onclick = () => { p.seek(0); onSeek(); };
  let was = false;
  scrub.addEventListener('pointerdown', () => { was = p.playing; p.playing = false; icon(); });
  scrub.addEventListener('input', () => { p.seekFrac(scrub.value / 1000); onSeek(); });
  scrub.addEventListener('pointerup', () => { if (was) { p.playing = true; icon(); } });
  root.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => { p.rate = +b.dataset.rate; root.querySelectorAll('[data-rate]').forEach(x => x.classList.toggle('on', x === b)); });
  const drawTicks = () => { ticks.innerHTML = p.steps.slice(1).map(s => `<i style="left:${s.t / p.dur * 100}%"></i>`).join(''); };
  drawTicks(); icon();
  let lastK = -1;
  return {
    refresh() { drawTicks(); lastK = -1; this.update(); icon(); },
    update() {
      const f = p.dur ? p.t / p.dur : 0; scrub.value = Math.round(f * 1000); fill.style.width = f * 100 + '%';
      const sc = scale();
      time.innerHTML = `${fmt(p.t)} / ${fmt(p.dur)}<small>${sc !== 1 ? '실제 ' + realTime(p.t * sc) + ' · ' + Math.round(sc) + '배속' : '실제 시간과 같음'}</small>`;
      const k = p.stepIndex(); if (k !== lastK) { lastK = k; ticks.querySelectorAll('i').forEach((t, i) => t.classList.toggle('on', i + 1 <= k)); }
      if ((play.getAttribute('aria-label') === '정지') !== p.playing) icon();
      return k;
    }
  };
}
