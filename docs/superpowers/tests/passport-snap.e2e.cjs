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
