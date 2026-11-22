// 여권스냅 e2e 테스트. 실행: node docs/superpowers/tests/passport-snap.e2e.cjs [이름필터]
// 전제: 워크트리 루트에서 `python3 -m http.server 8791 --bind 127.0.0.1` 가 떠 있음.
const { chromium } = require(process.env.PW_CORE || '/Users/turo/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core');
const URL = process.env.PS_URL || 'http://127.0.0.1:8791/apps/passport-snap/index.html';
const KEY = 'passportsnap.v1';
const filter = process.argv[2] || '';
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

let browser;
async function open({ width = 390, height = 844, storage = null, blockStorage = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  ctx.setDefaultTimeout(5000);
  const page = await ctx.newPage();
  page._errors = [];
  page.on('pageerror', e => page._errors.push(e.message));
  if (blockStorage) {
    await page.addInitScript(() => {
      const boom = () => { throw new Error('blocked'); };
      Storage.prototype.getItem = boom; Storage.prototype.setItem = boom; Storage.prototype.removeItem = boom;
    });
  } else if (storage !== null) {
    await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, [KEY, typeof storage === 'string' ? storage : JSON.stringify(storage)]);
  }
  await page.goto(URL);
  await page.waitForTimeout(250);
  return page;
}
const reload = async page => { await page.reload(); await page.waitForTimeout(250); };
const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
// 현재 퀴즈를 끝까지 푼다. 처음 `wrong`개의 첫 출제 문항은 일부러 오답.
async function answerAll(page, { wrong = 0, wrongIds = null } = {}) {
  await page.evaluate(({ wrong, wrongIds }) => {
    let wrongLeft = wrong, guard = 0;
    if (quiz.stage === 'preview') skipToQuiz();
    while (quiz && quiz.stage !== 'done' && guard++ < 500) {
      const q = quiz.queue[0];
      const isChar = q.kind === 'char';
      const correct = isChar ? q.item.char : q.phrase.id;
      const forceWrong = !q.isRetry && (wrongIds ? (!isChar && wrongIds.includes(q.phrase.id)) : wrongLeft > 0);
      if (isChar) {
        const idx = quiz.currentOptions.findIndex(o => forceWrong ? o.char !== correct : o.char === correct);
        selectCharQuizOption(idx);
      } else {
        const opt = quiz.currentOptions.find(o => forceWrong ? o.id !== correct : o.id === correct);
        selectPhraseQuizOption(opt.id);
      }
      if (forceWrong && !wrongIds) wrongLeft--;
      checkQuizAnswer();
      nextQuizQuestion();
    }
  }, { wrong, wrongIds });
  await page.waitForTimeout(100);
}

// ---------- Task 1: 저장 계층 ----------
test('persist-lesson', async () => {
  const page = await open();
  await page.evaluate(() => startLesson('7-1'));
  await answerAll(page);
  await page.evaluate(() => closeQuizScreen());
  await reload(page);
  const s = await stored(page);
  eq(s && s.langs.ja.completed['7-1'], today(), 'completed date');
  assert(await page.$('[data-lesson="7-1"].done'), 'DAY 1 shows done after reload');
});
test('per-language', async () => {
  const page = await open();
  await page.evaluate(() => startLesson('7-1'));
  await answerAll(page);
  await page.evaluate(() => { closeQuizScreen(); selectLanguage('zh'); });
  await page.waitForTimeout(100);
  assert(!(await page.$('[data-lesson="7-1"].done')), 'zh DAY 1 not done');
});
test('store-corrupt', async () => {
  const page = await open({ storage: '{not json' });
  eq(page._errors.length, 0, 'page errors');
  assert(await page.$('[data-lesson="7-1"]'), 'home rendered');
});
test('store-blocked', async () => {
  const page = await open({ blockStorage: true });
  eq(page._errors.length, 0, 'page errors');
  eq((await page.textContent('#store-badge')).trim(), '저장 안 됨', 'blocked badge');
  const ok = await open();
  eq((await ok.textContent('#store-badge')).trim(), '이 기기에 저장', 'normal badge');
});
test('persist-settings', async () => {
  const page = await open();
  await page.evaluate(() => { setCourseMode(14); selectLanguage('zh'); });
  await reload(page);
  eq(await page.evaluate(() => state.lang), 'zh', 'lang');
  eq(await page.evaluate(() => state.courseMode), 14, 'course mode');
});

// ---------- Task 2: 쓸 수 있는 문장과 결과 화면 ----------
test('usable-first-try', async () => {
  const page = await open();
  await page.evaluate(() => startRandomSprint());
  await answerAll(page, { wrong: 2 });
  eq((await page.textContent('#result-first')).trim(), '8/10', 'first try');
  assert((await page.textContent('#result-usable')).includes('+8'), 'usable +8');
  assert((await page.textContent('#result-wrong')).includes('2'), 'wrong 2');
  eq((await page.textContent('#result-primary')).trim(), '틀린 2문장 바로 복습 →', 'primary');
  assert(!(await page.textContent('#quiz-body')).includes('오늘 학습을 마쳤습니다'), 'random is not today lesson');
  eq((await stored(page)).langs.ja.usable.length, 8, 'stored usable');
});
test('review-recovers', async () => {
  const page = await open();
  await page.evaluate(() => startRandomSprint());
  await answerAll(page, { wrong: 2 });
  await page.click('#result-primary');
  eq(await page.evaluate(() => quiz.queue.length), 2, 'review queue length');
  await answerAll(page);
  const s = await stored(page);
  eq(s.langs.ja.usable.length, 10, 'usable after review');
  eq(Object.keys(s.langs.ja.notebook.phrases).length, 0, 'notebook emptied');
});
test('wrong-removes-usable', async () => {
  const page = await open({ storage: { version: 1, lang: 'ja', courseMode: 7, showKoPron: true, phraseDensity: null, langs: { ja: { completed: {}, usable: [1, 2, 3], favorites: [], notebook: { phrases: {}, chars: {} } } } } });
  await page.evaluate(() => openPhraseQuiz({ mode: 'random', lessonKey: null, title: '테스트', phrases: LANGUAGE_PACKS.ja.phrases.filter(p => [1, 2, 3].includes(p.id)), includePreview: false }));
  await answerAll(page, { wrongIds: [2] });
  const s = await stored(page);
  assert(!s.langs.ja.usable.includes(2), 'phrase 2 removed from usable');
  assert((await page.textContent('#result-usable')).includes('다시 연습 필요'), 'lost note shown');
});
test('no-xp', async () => {
  const page = await open({ width: 1280, height: 900 });
  await page.evaluate(() => startRandomSprint());
  await answerAll(page);
  assert(!(await page.evaluate(() => document.body.innerText)).includes('XP'), 'no XP on result');
  await page.evaluate(() => closeQuizScreen());
  assert(!(await page.evaluate(() => document.body.innerText)).includes('XP'), 'no XP on home');
});
test('all-correct', async () => {
  const page = await open();
  await page.evaluate(() => startRandomSprint());
  await answerAll(page);
  assert((await page.textContent('#result-wrong')).includes('모두 한 번에 맞힘'), 'all correct note');
  eq((await page.textContent('#result-primary')).trim(), '코스로 돌아가기', 'primary when all correct');
});

// ---------- Task 3: 홈 = 오늘 한 페이지 ----------
const visiblePrimaries = page => page.evaluate(() => [...document.querySelectorAll('.btn-primary')].filter(b => b.checkVisibility()).map(b => b.textContent.trim()));
const seed = (completed, extra = {}) => ({ version: 1, lang: 'ja', courseMode: 7, showKoPron: true, phraseDensity: null, langs: { ja: { completed, usable: [], favorites: [], notebook: { phrases: {}, chars: {} } } }, ...extra });
test('one-green', async () => {
  for (const width of [1280, 390]) {
    const page = await open({ width });
    const greens = await visiblePrimaries(page);
    eq(greens.length, 1, `primaries at ${width}`);
    eq(greens[0], 'DAY 1 시작 →', 'primary label');
  }
});
test('done-today', async () => {
  const page = await open();
  await page.evaluate(() => startLesson('7-1'));
  await answerAll(page);
  await page.evaluate(() => closeQuizScreen());
  const t = await page.textContent('#today');
  assert(t.includes('오늘 분량 완료') && t.includes('내일 DAY 2'), `today text: ${t.slice(0, 80)}`);
  eq((await visiblePrimaries(page)).length, 0, 'no primary when done today');
});
test('review-not-today', async () => {
  const page = await open({ storage: seed({ '7-1': '2000-01-01' }) });
  assert((await page.textContent('#today')).includes('DAY 2'), 'today is DAY 2');
  await page.evaluate(() => startLesson('7-1'));
  await answerAll(page);
  await page.evaluate(() => closeQuizScreen());
  eq((await stored(page)).langs.ja.completed['7-1'], '2000-01-01', 'date kept');
  assert(!(await page.textContent('#today')).includes('오늘 분량 완료'), 'review does not count as today');
  eq((await visiblePrimaries(page))[0], 'DAY 2 시작 →', 'still todo DAY 2');
});
test('course-14', async () => {
  const page = await open();
  await page.evaluate(() => { setCourseMode(14); startLesson('14-1'); });
  await answerAll(page);
  await page.evaluate(() => { closeQuizScreen(); setCourseMode(7); });
  eq((await visiblePrimaries(page))[0], 'DAY 1 시작 →', '7-day course untouched');
});
test('course-done', async () => {
  const all = {}; for (let i = 1; i <= 7; i++) all[`7-${i}`] = '2000-01-01';
  const page = await open({ storage: seed(all) });
  assert((await page.textContent('#today')).includes('코스 완료'), 'course done');
  eq((await visiblePrimaries(page)).length, 0, 'no primary');
});
test('timer-autostart', async () => {
  const page = await open();
  await page.click('#today-primary');
  eq(await page.evaluate(() => state.timerRunning), true, 'timer running');
});

(async () => {
  browser = await chromium.launch({ channel: 'chrome' });
  let pass = 0, fail = 0;
  for (const t of tests.filter(t => t.name.includes(filter))) {
    try { await t.fn(); console.log(`ok - ${t.name}`); pass++; }
    catch (e) { console.log(`not ok - ${t.name}: ${e.message.split('\n')[0]}`); fail++; }
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
