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

// ---------- Task 4: 치트시트 현지 모드 ----------
const toPhrases = page => page.evaluate(() => switchView('phrases'));
test('fav-persist', async () => {
  const page = await open();
  await toPhrases(page);
  await page.click('.fav-btn[data-id="3"]');
  eq(await page.getAttribute('.fav-btn[data-id="3"]', 'aria-pressed'), 'true', 'pressed');
  await reload(page); await toPhrases(page);
  eq((await page.textContent('#chip-fav')).trim(), '★ 고정 (1)', 'fav chip');
  await page.click('#chip-fav');
  eq(await page.$$eval('#phrase-list .phrase-item', els => els.length), 1, 'one favourite listed');
  assert(await page.$('#phrase-list .fav-btn[data-id="3"]'), 'it is #3');
});
test('fav-empty', async () => {
  const page = await open();
  await toPhrases(page);
  await page.click('#chip-fav');
  assert((await page.textContent('#phrase-empty')).includes('고정한 문장이 없습니다'), 'fav empty text');
});
test('search-empty', async () => {
  const page = await open();
  await toPhrases(page);
  await page.fill('#phrase-search', 'zzzz');
  const t = await page.textContent('#phrase-empty');
  assert(t.includes('‘zzzz’에 맞는 문장이 없습니다'), `empty text: ${t}`);
  assert((await page.$$('#phrase-empty .chip')).length >= 3, 'scene chips offered');
  await page.click('#phrase-empty .search-clear');
  eq(await page.$$eval('#phrase-list .phrase-item', els => els.length), 210, 'all back');
});
test('compact-default', async () => {
  const m = await open({ width: 390 });
  await toPhrases(m);
  eq(await m.$eval('#phrase-list .phrase-item', el => !!el.querySelector('.phrase-tip') && el.querySelector('.phrase-tip').checkVisibility()), false, 'mobile hides tip');
  const d = await open({ width: 1280, height: 900 });
  await toPhrases(d);
  eq(await d.$eval('#phrase-list .phrase-item .phrase-tip', el => el.checkVisibility()), true, 'desktop shows tip');
  await d.click('#density-toggle [data-density="compact"]');
  await reload(d); await toPhrases(d);
  eq(await d.$eval('#phrase-list .phrase-item', el => !!el.querySelector('.phrase-tip') && el.querySelector('.phrase-tip').checkVisibility()), false, 'choice persists');
});
test('sticky-search', async () => {
  const page = await open({ width: 390 });
  await toPhrases(page);
  await page.evaluate(() => scrollTo(0, 2000)); await page.waitForTimeout(300);
  const top = await page.$eval('#phrase-search', el => el.getBoundingClientRect().top);
  assert(top < 120 && top > 0, `search top ${top}`);
});
test('mobile-first-screen', async () => {
  const page = await open({ width: 390, height: 844 });
  await toPhrases(page); await page.waitForTimeout(300);
  const n = await page.evaluate(() => { const bar = document.querySelector('.tabbar').getBoundingClientRect().top; return [...document.querySelectorAll('#phrase-list .phrase-item')].filter(el => el.getBoundingClientRect().bottom <= bar).length; });
  assert(n >= 3, `fully visible items: ${n}`);
});
test('chip-counts', async () => {
  const page = await open({ width: 1280, height: 900 });
  await toPhrases(page);
  await page.fill('#phrase-search', '화장실');
  const nums = await page.$$eval('#phrase-cat-chips .chip', els => els.map(e => (e.textContent.match(/\((\d+)\)/) || [])[1]).filter(Boolean).map(Number));
  const listed = await page.$$eval('#phrase-list .phrase-item', els => els.length);
  // 칩 순서: ★, 전체, 카테고리 7개. 전체 칩 숫자 = 목록 개수, 카테고리 합 = 전체
  eq(nums[1], listed, 'all chip equals results');
  eq(nums.slice(2).reduce((a, b) => a + b, 0), listed, 'categories sum to results');
});

// ---------- Task 5: 크게 보기 줄바꿈과 글자 토큰 ----------
const charTops = (page, sel) => page.$eval(sel, el => {
  const out = []; const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) for (let i = 0; i < n.length; i++) {
    const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
    const rect = r.getClientRects()[0]; if (rect) out.push([n.data[i], Math.round(rect.top)]);
  }
  return out;
});
test('wrap-dokoka', async () => {
  for (const [w, h] of [[1280, 900], [1024, 768], [390, 844]]) {
    const page = await open({ width: w, height: h });
    await page.evaluate(() => openShowCard(LANGUAGE_PACKS.ja.phrases.find(p => p.jp.startsWith('トイレはどこ')).id));
    await page.waitForTimeout(150);
    const cs = await charTops(page, '#sc-jp');
    const i = cs.findIndex((c, k) => c[0] === 'ど' && cs[k + 1] && cs[k + 1][0] === 'こ');
    assert(i >= 0, 'found どこ');
    eq(cs[i][1], cs[i + 1][1], `ど and こ on the same line at ${w}px`);
  }
});
test('wrap-zh', async () => {
  const page = await open({ width: 1280, height: 900, storage: { version: 1, lang: 'zh', courseMode: 7, showKoPron: true, phraseDensity: null, langs: {} } });
  await page.evaluate(() => openShowCard(LANGUAGE_PACKS.zh.phrases.find(p => p.jp.length > 5).id));
  assert((await page.$eval('#sc-jp', el => el.innerHTML)).includes('<wbr>'), 'zh segmented');
});
test('detect-clean', async () => {
  const { spawnSync } = require('child_process');
  const r = spawnSync('/Users/turo/.claude/skills/impeccable/scripts/impeccable', ['detect', '--json', 'index.html'], { cwd: require('path').join(__dirname, '../../../apps/passport-snap'), encoding: 'utf8' });
  const found = JSON.parse(r.stdout || '[]');
  const bad = found.filter(f => ['design-system-font-size', 'design-system-color'].includes(f.antipattern || f.rule || f.id));
  eq(bad.length, 0, `font-size/color advisories: ${bad.map(b => (b.antipattern || b.rule) + '@' + b.line).join(', ')}`);
});

// ---------- Task 6: 학습 화면 접근성과 키보드 ----------
test('dialog-role', async () => {
  const page = await open({ width: 1280, height: 900 });
  await page.focus('#today-primary');
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  eq(await page.getAttribute('#quiz-screen', 'role'), 'dialog', 'role');
  eq(await page.getAttribute('#quiz-screen', 'aria-modal'), 'true', 'aria-modal');
  eq(await page.evaluate(() => document.getElementById('quiz-screen').contains(document.activeElement)), true, 'focus inside');
  eq(await page.evaluate(() => document.querySelector('main').inert), true, 'main inert');
  await page.evaluate(() => closeQuizScreen()); await page.waitForTimeout(100);
  eq(await page.evaluate(() => document.activeElement && document.activeElement.id), 'today-primary', 'focus returned');
  eq(await page.evaluate(() => document.querySelector('main').inert), false, 'main not inert');
});
test('keys-preview', async () => {
  const page = await open({ width: 1280, height: 900 });
  await page.evaluate(() => startLesson('7-1')); await page.waitForTimeout(150);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
  eq((await page.textContent('#quiz-counter')).trim(), '카드 2/30', 'after right');
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(100);
  eq((await page.textContent('#quiz-counter')).trim(), '카드 1/30', 'after left');
});
test('keys-quiz', async () => {
  const page = await open({ width: 1280, height: 900 });
  await page.evaluate(() => startRandomSprint()); await page.waitForTimeout(150);
  const before = await page.evaluate(() => quiz.queue.length);
  await page.keyboard.press('1'); await page.waitForTimeout(100);
  assert(await page.$('.option-btn.selected'), 'first option selected');
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  eq(await page.evaluate(() => quiz.answered), true, 'answered');
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  eq(await page.evaluate(() => quiz.answered), false, 'moved to next question');
  assert(await page.evaluate(n => quiz.queue.length <= n, before), 'queue advanced');
});
test('one-h1', async () => {
  const page = await open();
  const hs = await page.$$eval('h1', els => els.map(e => e.textContent.trim()));
  eq(hs.length, 1, 'h1 count'); eq(hs[0], '여권스냅', 'h1 text');
});

// ---------- Task 7: 현지 정보 용어, 버전 ----------
test('no-jewon', async () => {
  for (const lang of ['ja', 'zh']) {
    const page = await open({ width: 1280, height: 900, storage: { version: 1, lang, courseMode: 7, showKoPron: true, phraseDensity: null, langs: {} } });
    const texts = [];
    texts.push(await page.evaluate(() => document.body.innerText));
    await page.evaluate(() => switchView('specs')); texts.push(await page.evaluate(() => document.body.innerText));
    await page.evaluate(() => { toggleLangMenu(); }); texts.push(await page.evaluate(() => document.body.innerText));
    await page.evaluate(() => { toggleLangMenu(); openHelpModal(); }); texts.push(await page.evaluate(() => document.body.innerText));
    await page.evaluate(() => { closeHelpModal(); startRandomSprint(); }); await answerAll(page); texts.push(await page.evaluate(() => document.body.innerText));
    assert(!texts.join('\n').includes('제원'), `${lang}: '제원' still visible`);
  }
});
test('help-storage', async () => {
  const page = await open();
  await page.evaluate(() => openHelpModal());
  const t = await page.evaluate(() => document.getElementById('help-overlay').innerText);
  assert(!t.includes('아직 저장되지 않습니다'), 'stale storage help removed');
  assert(t.includes('이 기기'), 'help mentions device storage');
});
test('version', async () => {
  const page = await open({ width: 1280, height: 900 });
  eq((await page.textContent('#ver-top')).trim(), 'v1.1.0', 'top version');
  eq(await page.evaluate(() => PATCH_NOTES[0].v), '1.1.0', 'patch notes head');
});

// ---------- Final review fixes ----------
test('undo-delete', async () => {
  const p1 = { id: 1, cat: 0, jp: 'x', kana: 'x', ko: 'x', mean: 'x', tip: 'x', wrongTimes: 2, lastWrongAt: '' };
  const page = await open({ storage: { version: 1, lang: 'ja', courseMode: 7, showKoPron: true, phraseDensity: null, langs: { ja: { completed: {}, usable: [], favorites: [], notebook: { phrases: { 1: p1 }, chars: {} } } } } });
  await page.evaluate(() => switchView('notes'));
  await page.evaluate(() => removeWrongItem('phrase', 1));
  eq(Object.keys((await stored(page)).langs.ja.notebook.phrases).length, 0, 'deleted');
  await page.click('#toast .toast-action');
  const nb = (await stored(page)).langs.ja.notebook.phrases;
  eq(nb['1'] && nb['1'].wrongTimes, 2, 'restored with its count');
});
test('review-char-from-pack', async () => {
  const page = await open();
  const ok = await page.evaluate(() => {
    const k = LANGUAGE_PACKS.ja.kanji[0];
    const nb = ensureLangNotebook();
    nb.chars[`kanji:${k.char}`] = { key: `kanji:${k.char}`, charTab: 'kanji', char: k.char, title: k.meaning, sub: `${k.ko} (${k.reading})`, tip: k.tip, wrongTimes: 1 };
    startWrongNotebookQuiz();
    const it = quiz.queue[0].item;
    return it.reading === k.reading && it.ko === k.ko && it.meaning === k.meaning;
  });
  eq(ok, true, 'review uses the pack item, not the notebook summary');
});
test('day-rollover', async () => {
  const page = await open();
  await page.evaluate(() => startLesson('7-1'));
  await answerAll(page);
  await page.evaluate(() => closeQuizScreen());
  assert((await page.textContent('#today')).includes('오늘 분량 완료'), 'done today first');
  await page.evaluate(() => {
    const D = Date, off = 86400000;
    window.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } };
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  eq((await visiblePrimaries(page))[0], 'DAY 2 시작 →', 'next day shows DAY 2 start');
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
