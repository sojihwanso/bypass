/* 부팅: 첫 화면과 학습실을 주소에 따라 바꾼다 */
import { UNITS, unitById } from './data/catalog.js';
import { parseHash } from './router.js';
import { createProgress } from './progress.js';
import { initChrome, renderToc, renderProgress, openDialog, closeDialog } from './ui/chrome.js';
import { renderHome } from './ui/home.js';

const app = document.getElementById('app');
const progress = createProgress();
let room = null, roomMod = null, current = null, seq = 0;

function hideLoader() { const l = document.getElementById('loader'); if (l && !l.classList.contains('done')) { l.classList.add('done'); setTimeout(() => l.remove(), 700); } }
function swapOn(on) { document.getElementById('swap').classList.toggle('on', on); }

async function route() {
  const my = ++seq;   /* 주소가 빨리 바뀌면 가장 마지막 요청만 살린다 */
  const r = parseHash(location.hash, UNITS, { all: /[?&]all\b/.test(location.search) });
  if (r.view === 'room') {
    if (current === r.id && room) return;
    swapOn(true);
    try {
      roomMod = roomMod || await import('./ui/room.js');
      if (my !== seq) return;
      if (room) { room.dispose(); room = null; current = null; }
      document.body.classList.remove('on-hero');
      const opened = await roomMod.openRoom(app, r.id, { progress, onSeen: () => { renderProgress(progress); renderToc(r.id, progress); } });
      if (my !== seq) { opened.dispose(); return; }
      room = opened; current = r.id; window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="wrap" style="padding:120px 0"><h1>이 단원을 열지 못했습니다</h1><p>${String(e.message || e)}</p><p><a href="#">처음 화면으로</a></p></div>`;
    }
    swapOn(false);
  } else {
    if (room) { room.dispose(); room = null; }
    if (current !== null || !app.firstChild) { current = null; renderHome(app, progress); document.body.classList.add('on-hero'); }
    if (r.view === 'soon') {
      const u = unitById(r.id);
      openDialog(`<p class="kicker">${u.no}</p><h2 id="dlgTitle">${u.title}</h2><p>이 단원은 2단계에서 채울 예정입니다. 지금은 시험 준비자료와 연계된 열 단원을 먼저 열어 두었습니다.</p><p><a class="btn btn-solid" href="#exams" data-close>시험 단원 보기</a></p>`);
      document.querySelector('#dlg [href="#exams"]').addEventListener('click', () => closeDialog());
      history.replaceState(null, '', location.pathname + '#index');
      const idx = document.getElementById('index'); if (idx) idx.scrollIntoView();
    } else if (r.section) {
      const t = document.getElementById(r.section); if (t) t.scrollIntoView();
    } else window.scrollTo(0, 0);
  }
  renderToc(current, progress); renderProgress(progress);
  hideLoader();
}

initChrome({ onTheme: () => { if (room) room.applyTheme(); else { const y = scrollY; renderHome(app, progress); scrollTo(0, y); } } });
window.addEventListener('hashchange', route);
route();
setTimeout(hideLoader, 4000);
