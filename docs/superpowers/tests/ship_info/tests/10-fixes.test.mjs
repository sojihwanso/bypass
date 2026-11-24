import { withPage, assert } from '../lib.mjs';
const M = {width:390,height:844};
const CMP = (v) => ({fn: x => localStorage.setItem('sasarok-cmp-v1', x), arg: JSON.stringify(v)});
const shown = (p, s) => p.$eval(s, e => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
export default [
 {name:'mobile-filters-collapsed', fn: () => withPage({...M, hash:'#type-container'}, async p => {
   const top = await p.$eval('#reg-body tr.row', e => e.getBoundingClientRect().top);
   assert(top < 844, 'first card at '+top);
   assert(!(await shown(p, '#f-routes')), 'routes visible while collapsed');
   await p.click('#f-toggle');
   assert(await shown(p, '#f-routes'), 'routes hidden after open');
   assert(await p.$eval('#f-toggle', b => b.getAttribute('aria-expanded')) === 'true', 'aria-expanded');
 })},
 {name:'filter-count-cue', fn: () => withPage({hash:'#type-container?cadet=1&kind=owner'}, async p => {
   const t = await p.$eval('#f-active', e => e.textContent);
   assert(t.includes('2'), 'cue '+t);
   const m = await withPage({...M, hash:'#type-container?cadet=1'}, q => q.$eval('#f-toggle', b => b.textContent));
   assert(m.includes('1'), 'mobile toggle '+m);
 })},
 {name:'type-switcher', fn: () => withPage({hash:'#type-container?cadet=1'}, async p => {
   assert(await p.$$eval('#type-switch a', e => e.length) === 9, 'count');
   assert(await p.$eval('#type-switch a[aria-current="page"]', e => e.getAttribute('href').startsWith('#type-container')), 'current');
   await p.click('#type-switch a[href^="#type-lng"]'); await p.waitForTimeout(200);
   assert((await p.evaluate(() => location.hash)).startsWith('#type-lng'), 'nav');
 })},
 {name:'compare-job-rows-first', fn: () => withPage({hash:'#compare', init:CMP({co:['HMM','팬오션'],ty:[]})}, async p => {
   const rows = await p.$$eval('.cmp tbody th', e => e.map(x => x.textContent.trim()));
   assert(rows[1] === '2027 실습생' && rows[2] === '초급사관 채용' && rows[3] === '승선근무예비역', 'rows '+rows.slice(0,5));
 })},
 {name:'compare-sticky-first-col', fn: () => withPage({...M, hash:'#compare', init:CMP({co:['HMM','팬오션','장금상선'],ty:[]})}, async p => {
   const r = await p.evaluate(() => { const box = document.querySelector('#cmp-table'); box.scrollLeft = 300; const th = document.querySelector('.cmp tbody th').getBoundingClientRect(); return {th: th.left, box: box.getBoundingClientRect().left, sl: box.scrollLeft}; });
   assert(r.sl > 0, 'not scrollable');
   assert(Math.abs(r.th - r.box) <= 2, 'first column scrolled away '+JSON.stringify(r));
 })},
 {name:'egg-focus-trap', fn: () => withPage({}, async p => {
   for (let i=0;i<5;i++) await p.click('#ver-top');
   for (let i=0;i<4;i++) await p.keyboard.press('Tab');
   assert(await p.evaluate(() => !!document.activeElement.closest('.egg')), 'focus escaped');
 })},
 {name:'pickall-feedback-when-nothing-new', fn: () => withPage({hash:'#type-lng?q=K-LNG'}, async p => {
   await p.click('#f-pickall');
   assert(!(await shown(p, '#toast')), 'toast on first add');
   await p.click('#f-pickall');
   assert(await shown(p, '#toast'), 'no feedback when nothing new');
 })},
 {name:'crumb-only-from-table', fn: () => withPage({hash:'#type-container'}, async p => {
   await p.evaluate(() => location.hash = 'home'); await p.waitForTimeout(100);
   await p.evaluate(() => location.hash = 'co-HMM'); await p.waitForTimeout(150);
   assert(await p.$('#v-co .crumb a[data-back]') === null, 'crumb shown without coming from table');
 })},
 {name:'mobile-hero-img-block', fn: () => withPage({...M}, async p => {
   assert(await p.$eval('.hero-day', e => getComputedStyle(e).display) === 'block', 'inline');
 })},
 {name:'only-theme-image-loads', fn: () => withPage({}, async p => {
   const r = await p.evaluate(() => [document.querySelector('.hero-day').currentSrc, document.querySelector('.hero-night').getAttribute('src')]);
   assert(r[0].endsWith('hero-day.webp') && !r[1], 'srcs '+r);
 })},
 {name:'mobile-card-other-types', fn: () => withPage({...M, hash:'#type-bulk'}, async p => {
   const n = await p.$$eval('#reg-body tr.row td:nth-child(9) .other a', es => es.filter(e => e.getClientRects().length).length);
   assert(n > 0, 'other types hidden');
 })},
 {name:'board-copy-text', fn: () => withPage({hash:'#board'}, async p => {
   const t = await p.$eval('#v-board .page-lead, #v-board p.lines', e => e.textContent);
   assert(!t.includes('보내기를 눌러도'), 'old copy');
 })},
 {name:'board-copy-all-fields', fn: () => withPage({hash:'#board'}, async p => {
   await p.fill('#p-company','HMM'); await p.fill('#p-when','2025 하반기'); await p.fill('#p-route','미주'); await p.fill('#p-body','본문');
   const txt = await p.evaluate(() => boardText());
   assert(['HMM','2025 하반기','미주','본문'].every(x => txt.includes(x)), 'text '+txt);
 })},
 {name:'cmp-proto-names', fn: () => withPage({hash:'#compare', init:CMP({co:['constructor','HMM','HMM'],ty:['toString','lng','lng']})}, async (p, errors) => {
   assert(await p.$eval('#cmp-n', e => e.textContent.trim()) === '선사 1 / 선종 1', 'count');
   assert(!errors.length, errors.join('|'));
 })},
 {name:'news-fade-off-when-short', fn: () => withPage({}, async p => {
   const c = await p.evaluate(() => { NEWS_ALL.length = 1; renderHome(); return document.querySelector('#news-list').classList.contains('at-end'); });
   assert(c, 'fade still on');
 })},
 {name:'readme-heading', fn: () => withPage({}, async p => {
   const r = await p.evaluate(() => { const h = [...document.querySelectorAll('footer h2')].find(e => e.textContent.includes('읽기 전에')); return h && !h.closest('summary'); });
   assert(r, 'h2 inside summary');
 })}
];
