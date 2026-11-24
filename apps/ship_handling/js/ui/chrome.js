/* 화면 위에 떠 있는 장치: 목차 판, 진도 띠, 창, 버전(이스터에그), 테마 */
import { CATEGORIES, UNITS, STAGE1 } from '../data/catalog.js';
import { isOpen } from '../router.js';
import { VERSION, PATCH_NOTES } from '../data/patchnotes.js';
import { roomHref } from '../router.js';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let lastFocus = null;
function trapOpen(el, focusEl) { lastFocus = document.activeElement; el.classList.add('open'); document.body.style.overflow = 'hidden'; (focusEl || el.querySelector('[data-close], a, button')).focus(); }
function trapClose(el) { el.classList.remove('open'); document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

export function openDialog(html) { $('dlgBody').innerHTML = html; trapOpen($('dlg'), $('dlg').querySelector('.close-x')); $('dlg').querySelector('.box').scrollTop = 0; }
export function closeDialog() { trapClose($('dlg')); }

export function renderToc(currentId, progress) {
  const sheet = $('tocSheet');
  sheet.innerHTML = `<button class="close-x" type="button" data-close aria-label="목차 닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <h2>전체 목차</h2><a href="#" data-home><span class="n"></span><span>처음 화면</span><span></span></a>` +
  CATEGORIES.map(c => `<div class="cat"><h3>${c.no} ${esc(c.title)}</h3>${UNITS.filter(u => u.cat === c.id).map(u => {
    const tag = !isOpen(u) ? '<span class="tag soon">준비 중</span>' : progress.has(u.id) ? '<span class="tag exam">봄</span>' : u.exam ? '<span class="tag exam">시험</span>' : '';
    return `<a href="${roomHref(u.id)}" class="${isOpen(u) ? '' : 'soon'} ${u.id === currentId ? 'cur' : ''}" ${u.id === currentId ? 'aria-current="page"' : ''}><span class="n">${u.no}</span><span>${esc(u.title)}</span>${tag}</a>`;
  }).join('')}</div>`).join('');
}
export function renderProgress(progress) {
  const seen = progress.count();
  $('progress').innerHTML = `<span class="bar" aria-hidden="true">${UNITS.map(u => `<i class="${u.stage === 1 ? 's1' : ''} ${progress.has(u.id) ? 'seen' : ''}"></i>`).join('')}</span><span><b>${UNITS.length}개 중 ${seen}개</b> 봄</span>`;
  $('tocCnt').textContent = `${seen}/${UNITS.length}`;
}

export function initChrome({ onTheme }) {
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', e => { const box = e.currentTarget.closest('.toc, .dlg'); trapClose(box); }));
  $('tocSheet').addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; if (a.hasAttribute('data-home')) { e.preventDefault(); location.hash = ''; history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); } trapClose($('toc')); });
  $('tocBtn').addEventListener('click', () => trapOpen($('toc'), $('tocSheet').querySelector('a.cur') || $('tocSheet').querySelector('.close-x')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('dlg').classList.contains('open')) trapClose($('dlg')); else if ($('toc').classList.contains('open')) trapClose($('toc')); } });
  $('themeBtn').addEventListener('click', () => {
    const r = document.documentElement, next = r.dataset.theme === 'dark' ? 'light' : 'dark';
    r.dataset.theme = next; try { localStorage.setItem('shs-theme', next); } catch (e) { /* 무시 */ }
    onTheme && onTheme(next);
  });
  /* 버전 다섯 번 누르면 이스터에그 */
  const hits = [];
  const egg = () => {
    const now = Date.now(); hits.push(now); while (hits.length && now - hits[0] > 2500) hits.shift();
    if (hits.length >= 5) { hits.length = 0; openEgg(); }
  };
  $('helpBtn').addEventListener('click', () => { try { localStorage.setItem('shs-help', '1'); } catch (e) { /* 무시 */ } document.querySelector('.help-tip')?.remove(); openHelp(); });
  let seen = false; try { seen = !!localStorage.getItem('shs-help'); } catch (e) { seen = true; }
  if (!seen) { const tip = document.createElement('p'); tip.className = 'help-tip'; tip.textContent = '도움말은 여기'; $('helpBtn').appendChild(tip); setTimeout(() => tip.remove(), 9000); }
  $('verTop').textContent = 'v. ' + VERSION; $('verTop').addEventListener('click', egg);
  document.addEventListener('click', e => { if (e.target.closest('.foot .ver')) egg(); });
}
function openHelp() {
  const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  openDialog(`<p class="kicker">도움말</p><h2 id="dlgTitle">이 사이트 쓰는 법</h2>
    <h3 class="help-h">장면 재생</h3><dl class="help-dl">
      ${row('재생 · 정지', '재생바 왼쪽 큰 단추. 키보드 스페이스로도 된다.')}
      ${row('처음으로', '둥근 화살표 단추. 장면을 0초로 되돌린다.')}
      ${row('재생바', '끌어서 원하는 순간으로 옮긴다. 눈금은 설명 단계가 바뀌는 자리다. 키보드 ← → 는 1초씩 옮긴다.')}
      ${row('0.5배 · 1배 · 2배', '재생 빠르기. 오른쪽 시간 아래에 실제 시간이 몇 배로 줄었는지 적혀 있다.')}
      ${row('흐름 목록', "'흐름' 칸의 단계 이름을 누르면 그 단계로 바로 간다.")}
    </dl>
    <h3 class="help-h">시점 이동</h3><dl class="help-dl">
      ${row('처음 각도 · 위 · 옆 · 뒤 · 아래', '장면 왼쪽 위 단추. 정해 둔 방향에서 배를 본다. 좁은 화면에서는 옆·뒤가 숨겨진다.')}
      ${row('따라가기', '켜면 시점이 움직이는 배를 따라간다.')}
      ${row('마우스', '왼쪽 단추로 끌면 돌려 보기, 휠은 확대·축소, 오른쪽 단추(또는 Shift)로 끌면 시점 이동.')}
      ${row('손가락', '한 손가락으로 끌면 돌려 보기, 두 손가락을 벌리거나 모으면 확대·축소, 두 손가락을 함께 끌면 시점 이동.')}
    </dl>
    <h3 class="help-h">보이기 단추 (장면 왼쪽 아래)</h3><dl class="help-dl">
      ${row('수면', '바다 면을 켜고 끈다. 끄면 물속 선체가 잘 보인다.')}
      ${row('흐름선', '물과 바람의 흐름을 나타내는 선. 밝고 길수록 빠르다.')}
      ${row('이름표', '부품 이름과 힘 화살표 이름을 켜고 끈다.')}
      ${row('선체 윤곽', '선체를 윤곽선만 남긴다. 확대했을 때 타나 프로펠러가 선체에 가려지지 않는다. 초록은 갑판선, 파랑은 만재흘수선, 주황은 용골선, 빨강은 선수·선미 끝, 회색은 단면선이다.')}
    </dl>
    <h3 class="help-h">더 알아보기</h3><dl class="help-dl">
      ${row('부품 누르기', '초록 테두리 이름표나 움직이는 부품을 누르면 그 안의 물리 원리를 설명하는 창이 열린다.')}
      ${row('조건 바꾸기', "'조건 바꾸기' 칸에서 속력·타각 같은 조건을 바꾸면 장면을 다시 계산한다. 6자유도 운동에서는 운동 하나만 골라 볼 수 있다.")}
      ${row('지금 값 · 그래프', '재생 중인 순간의 수치와 그래프. 모델 값은 교재 수치를 바탕으로 한 계산값이다.')}
      ${row('시험에서는', '시험 단원 끝에 문항과 답안의 뼈대, 그려 볼 그림이 있다.')}
      ${row('영상', '영상이 있는 단원은 재생바를 끌어 장면을 옮겨 볼 수 있다.')}
    </dl>
    <h3 class="help-h">화면 모서리</h3><dl class="help-dl">
      ${row('목차', '왼쪽 아래 단추. 단원 목록을 열고, 본 단원에는 표시가 남는다.')}
      ${row('진도', '아래 가운데. 전체 단원 가운데 몇 개를 봤는지 보여 준다.')}
      ${row('달 모양 단추', '밝은 화면과 어두운 화면을 바꾼다.')}
      ${row('단원 넘기기', '키보드 [ 와 ] 로 앞뒤 단원으로 간다.')}
    </dl>`);
}
function openEgg() {
  openDialog(`<p class="kicker">숨은 창</p><h2 id="dlgTitle">갑판에서 찾으셨네요</h2>
    <p>버전 표시를 다섯 번 누르면 열리는 창입니다. 이 사이트는 선박조종학 수업 자료로 공부하던 학생이 시험 준비를 위해 만들었습니다.</p>
    <p><button class="btn btn-solid" type="button" id="pnBtn">패치노트</button></p>
    <div class="notes" id="pnBox" hidden></div>`);
  document.getElementById('pnBtn').addEventListener('click', () => {
    const b = document.getElementById('pnBox'); b.hidden = false;
    b.innerHTML = PATCH_NOTES.map(n => `<p><span class="v">v. ${n.v}</span> <span class="num">${n.date}</span></p><ol>${n.items.map(i => `<li>${esc(i)}</li>`).join('')}</ol>`).join('');
  });
}
export { esc, STAGE1 };
