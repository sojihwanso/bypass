/* 첫 화면: 사진 반반 구성, 카테고리 목차, 시험 단원 바로가기, 모델 제원과 출처 */
import { CATEGORIES, UNITS, STAGE1 } from '../data/catalog.js';
import { isOpen } from '../router.js';
import { VERSION } from '../data/patchnotes.js';
import { roomHref } from '../router.js';
import { esc } from './chrome.js';
/* 첫 화면 사진: 밝은 화면과 어두운 화면에 각각 세 장. 10초마다 옆으로 넘어가고, '중지'로 멈출 수 있다 */
const SLIDES = {
  light: [['day-bow', '선교에서 내려다본 선수와 갑판 · 지중해'], ['day-rainbow', '비 갠 뒤 무지개 아래의 컨테이너 갑판 · 말라카 해협'], ['day-clouds', '맑은 날 윙 브리지에서 본 갑판과 바다 · 남중국해']],
  dark: [['sunset-wake', '해 질 녘, 섬 사이로 지는 해 · 일본 규슈 연안'], ['night-harbor', '밤의 컨테이너 항구와 다리 · 홍콩항'], ['night-canal', '어스름 속 운하를 지나는 컨테이너선 · 수에즈 운하 통과 중']]
};
const HOLD = 10000;
let heroTimer = 0, heroTick = null, heroBound = false;
const chev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

export function renderHome(root, progress) {
  const dark = document.documentElement.dataset.theme === 'dark';
  const slides = SLIDES[dark ? 'dark' : 'light'];
  let paused = false; try { paused = localStorage.getItem('shs-hero-pause') === '1'; } catch (e) { /* 무시 */ }
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) paused = true;
  const slideImg = ([f, c], i) => `<img src="assets/photo/${f}.webp" srcset="assets/photo/${f}-s.webp 900w, assets/photo/${f}.webp 1800w" sizes="(max-width: 900px) 100vw, 58vw" alt="${i === 0 ? c : ''}" ${i === 0 ? 'fetchpriority="high"' : 'aria-hidden="true"'} decoding="async">`;
  const openCats = new Set(['motion']);
  root.innerHTML = `
  <section class="hero" aria-labelledby="heroTitle">
    <div class="hero-text">
      <div>
        <p class="hero-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" stroke-width="1.5"/><g fill="currentColor"><path d="M16 16c.4-3.4 2.9-5.5 5-5-1.7 1.3-3 2.9-5 5z"/><path d="M16 16c.4-3.4 2.9-5.5 5-5-1.7 1.3-3 2.9-5 5z" transform="rotate(72 16 16)"/><path d="M16 16c.4-3.4 2.9-5.5 5-5-1.7 1.3-3 2.9-5 5z" transform="rotate(144 16 16)"/><path d="M16 16c.4-3.4 2.9-5.5 5-5-1.7 1.3-3 2.9-5 5z" transform="rotate(216 16 16)"/><path d="M16 16c.4-3.4 2.9-5.5 5-5-1.7 1.3-3 2.9-5 5z" transform="rotate(288 16 16)"/></g></svg>선박 조종 3D 모델</p>
        <h1 id="heroTitle">배가 왜 그렇게 움직이는지, 돌려 보고 멈춰 보며</h1>
        <p class="lede">강의 슬라이드와 교재의 그림을 3D 장면으로 옮겼습니다. 한 척의 6,000TEU 컨테이너선이 기울고, 돌고, 밀리고, 닻을 끕니다. 재생바를 끌어 원하는 순간에 멈추고, 배를 돌려 물속까지 들여다보세요.</p>
        <div class="acts">
          <a class="btn btn-solid" href="#exams">시험 단원부터 보기</a>
          <a class="btn btn-line" href="#index">전체 목차</a>
        </div>
      </div>
      <dl class="facts">
        <div><dt>시험 단원</dt><dd><b>${STAGE1.length}개</b></dd></div>
        <div><dt>전체 단원</dt><dd><b>${UNITS.length}개</b></dd></div>
        <div><dt>기준 선박</dt><dd><b>L 301 m</b></dd></div>
      </dl>
    </div>
    <figure class="hero-photo" aria-roledescription="사진 넘김" aria-label="바다 사진">
      <div class="hero-track">${slides.map(slideImg).join('')}${slideImg(slides[0], 1)}</div>
      <figcaption aria-live="polite">${slides[0][1]}</figcaption>
      <div class="hero-ctl">
        <span class="dots">${slides.map((s, i) => `<button type="button" class="dot ${i === 0 ? 'on' : ''}" data-i="${i}" aria-label="${i + 1}번째 사진: ${s[1]}"></button>`).join('')}</span>
        <button type="button" class="hero-pause" aria-pressed="${paused}">${paused ? '재생' : '중지'}</button>
      </div>
    </figure>
  </section>

  <div class="wrap">
    <section class="exam-strip" id="exams" aria-labelledby="examTitle">
      <figure><img src="assets/photo/turn-spray-s.webp" srcset="assets/photo/turn-spray-s.webp 800w, assets/photo/turn-spray.webp 1600w" sizes="(max-width: 900px) 100vw, 40vw" alt="물보라를 일으키며 크게 선회하는 대형 컨테이너선을 비스듬히 위에서 본 그림" loading="lazy"></figure>
      <div>
        <h2 id="examTitle">이번 학기 시험에 나오는 열 단원</h2>
        <p>중간·기말 시험 준비자료의 열 문항을 단원으로 옮겼습니다. 단원 끝 '시험에서는' 칸에 문항과 답안의 뼈대를 정리했습니다.</p>
        <ul class="exam-list">${STAGE1.map(u => `<li><a href="${roomHref(u.id)}"><small>${u.exam}</small>${esc(u.title)}</a></li>`).join('')}</ul>
      </div>
    </section>

    <section class="index" id="index" aria-labelledby="idxTitle">
      <div class="index-head"><h2 id="idxTitle">강의 순서대로 본 전체 목차</h2><p>번호는 강의 S1~S14의 흐름을 따릅니다. 흐리게 보이는 단원은 2단계에서 채웁니다.</p></div>
      <ul class="cats">${CATEGORIES.map(c => {
        const us = UNITS.filter(u => u.cat === c.id), ready = us.filter(isOpen).length;
        return `<li class="cat-row ${openCats.has(c.id) ? 'open' : ''}" data-cat="${c.id}">
          <button class="cat-btn" type="button" aria-expanded="${openCats.has(c.id)}" aria-controls="u-${c.id}"><span class="no">${c.no}</span><span><span class="tt">${esc(c.title)}</span><span class="ld">${esc(c.lede)}</span></span><span class="cnt">${ready ? `<b>${ready}개 열림</b> / ` : ''}${us.length}개 단원</span>${chev}</button>
          <ul class="units" id="u-${c.id}">${us.map(u => `<li><a href="${roomHref(u.id)}" class="${isOpen(u) ? '' : 'soon'}"><span class="n">${u.no}</span><span class="t">${esc(u.title)}</span><span class="d">${esc(u.lede)}</span><span class="f">${u.forms.join(', ')}</span><span class="side">${!isOpen(u) ? '<span class="tag soon">준비 중</span>' : progress.has(u.id) ? '<span class="tag exam">봄</span>' : u.exam ? `<span class="tag exam">${u.exam}</span>` : ''}</span></a></li>`).join('')}</ul>
        </li>`;
      }).join('')}</ul>
    </section>

    <section class="about" aria-label="모델 제원과 자료">
      <div><h2>기준 선박</h2><table class="spec">
        <tr><th>선종</th><td>6,000TEU 컨테이너선, 만재</td></tr>
        <tr><th>수선간장 L</th><td>301 m</td></tr><tr><th>폭 B, 흘수 d</th><td>42.8 m, 14.0 m</td></tr>
        <tr><th>방형계수 Cb</th><td>0.63</td></tr><tr><th>주기관</th><td>42,500 PS</td></tr>
        <tr><th>배수량</th><td>약 116,500 t (계산)</td></tr><tr><th>GM</th><td>1.8 m (가정)</td></tr>
      </table><p class="src-line">교재 Volume 4 시험선 자료의 6,000TEU 컨테이너선 제원. 배수량과 GM은 이 사이트에서 계산하거나 정한 값입니다.</p></div>
      <div><h2>자료와 출처</h2><ul>
        <li>선박조종학 강의 슬라이드 S1~S14</li>
        <li>『선박조종학』 Kinzo Inoue 저, 정창현·박영수 역, 문현출판사</li>
        <li>『고등학교 선박 운용』</li>
        <li>2026년 2학기 중간·기말시험 준비자료</li>
      </ul><p class="src-line">교재 문장과 그림은 옮기지 않았습니다. 설명은 새로 썼고, 수치와 정의에는 쪽수를 달았습니다.</p></div>
      <div><h2>읽기 전에</h2><p class="note-box"><b>모델 값에 주의.</b> 3D 장면의 숫자는 개념을 보이기 위한 단순 모델의 결과입니다. 실제 선박의 조종 특성은 선박 조종성 자료(Pilot card, Wheelhouse poster)와 시운전 기록을 따릅니다.</p></div>
    </section>
  </div>
  <footer class="foot"><div>선박조종학 수업 자료로 만든 학습용 사이트</div><button class="ver" type="button" title="버전" aria-label="버전 정보">v. ${VERSION} · TEAM BYPASS</button></footer>`;

  root.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => {
    const row = b.closest('.cat-row'), open = !row.classList.contains('open'); row.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
  }));
  /* 사진 넘김 */
  clearTimeout(heroTimer);
  const fig = root.querySelector('.hero-photo'), track = fig.querySelector('.hero-track'), capEl = fig.querySelector('figcaption'), dots = [...fig.querySelectorAll('.dot')], pbtn = fig.querySelector('.hero-pause');
  let cur = 0;
  const show = (i, anim = true) => {
    track.style.transition = anim ? '' : 'none'; track.style.transform = `translateX(${-i * 100}%)`;
    const k = i % slides.length; capEl.textContent = slides[k][1]; dots.forEach((d, j) => d.classList.toggle('on', j === k)); cur = i;
    if (i === slides.length) setTimeout(() => { if (track.isConnected) { show(0, false); void track.offsetWidth; track.style.transition = ''; } }, 950);
  };
  const tick = () => { clearTimeout(heroTimer); if (!fig.isConnected) return; if (paused || document.hidden) return; heroTimer = setTimeout(() => { if (!fig.isConnected) return; show(cur + 1); tick(); }, HOLD); };
  dots.forEach(d => d.addEventListener('click', () => { show(+d.dataset.i); tick(); }));
  pbtn.addEventListener('click', () => {
    paused = !paused; pbtn.textContent = paused ? '재생' : '중지'; pbtn.setAttribute('aria-pressed', paused);
    try { localStorage.setItem('shs-hero-pause', paused ? '1' : '0'); } catch (e) { /* 무시 */ }
    tick();
  });
  heroTick = tick; if (!heroBound) { heroBound = true; document.addEventListener('visibilitychange', () => heroTick && heroTick()); }
  tick();
  const img = root.querySelector('.hero-photo img');
  const done = () => document.body.classList.add('ready');
  if (img.complete) done(); else img.addEventListener('load', done, { once: true });
}
