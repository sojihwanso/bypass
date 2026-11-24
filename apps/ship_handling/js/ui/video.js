/* 영상 재생기: 재생/정지, 끌 수 있는 재생바, 시간 표시. 파일이 없으면 칸을 숨긴다. */
const f = s => { s = Math.max(0, s || 0); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
export function videoHTML(v) {
  return `<figure class="vid" data-vid>
    <div class="vid-box"><video preload="metadata" playsinline ${v.poster ? `poster="${v.poster}"` : ''} src="${v.src}" aria-label="${v.title}"></video></div>
    <div class="player vid-bar">
      <button class="pbtn" type="button" data-v="play" aria-label="영상 재생"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg></button>
      <div class="track"><div class="rail"><b data-v="fill"></b></div><input type="range" min="0" max="1000" value="0" step="1" data-v="scrub" aria-label="영상 재생 위치"></div>
      <div class="time" data-v="time">0:00 / 0:00</div>
    </div>
    <figcaption>${v.title}</figcaption></figure>`;
}
export function bindVideo(root) {
  const fig = root.querySelector('[data-vid]'); if (!fig) return () => {};
  const vid = fig.querySelector('video'), play = fig.querySelector('[data-v=play]'), scrub = fig.querySelector('[data-v=scrub]'), fill = fig.querySelector('[data-v=fill]'), time = fig.querySelector('[data-v=time]');
  const icon = () => { play.innerHTML = vid.paused ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'; play.setAttribute('aria-label', vid.paused ? '영상 재생' : '영상 정지'); };
  const upd = () => { const d = vid.duration || 0, r = d ? vid.currentTime / d : 0; scrub.value = Math.round(r * 1000); fill.style.width = r * 100 + '%'; time.textContent = `${f(vid.currentTime)} / ${f(d)}`; };
  vid.addEventListener('error', () => { fig.hidden = true; });
  vid.addEventListener('loadedmetadata', upd); vid.addEventListener('timeupdate', upd); vid.addEventListener('play', icon); vid.addEventListener('pause', icon); vid.addEventListener('ended', icon);
  play.addEventListener('click', () => { if (vid.paused) vid.play(); else vid.pause(); });
  vid.addEventListener('click', () => { if (vid.paused) vid.play(); else vid.pause(); });
  let was = false;
  scrub.addEventListener('pointerdown', () => { was = !vid.paused; vid.pause(); });
  scrub.addEventListener('input', () => { if (vid.duration) { vid.currentTime = scrub.value / 1000 * vid.duration; upd(); } });
  scrub.addEventListener('pointerup', () => { if (was) vid.play(); });
  return () => { vid.pause(); };
}
