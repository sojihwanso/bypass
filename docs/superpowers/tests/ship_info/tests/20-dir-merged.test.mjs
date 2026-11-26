import { withPage, assert } from '../lib.mjs';
const ready = p => p.waitForSelector('#dir-list li.firm', {timeout:4000});
export default [
 {name:'dir-385', fn: () => withPage({hash:'#dir'}, async p => {
   await ready(p);
   assert((await p.$eval('#v-dir h1', e => e.textContent)).includes('385곳'), 'head');
   await p.evaluate(() => location.hash = '#dir?co=1'); await p.waitForTimeout(400); await ready(p);
   assert((await p.$eval('#dir-count', e => e.textContent)).startsWith('53곳'), await p.$eval('#dir-count', e => e.textContent));
   assert(await p.isChecked('#dir-co'), 'checkbox');
 })},
 {name:'dir-links-co', fn: () => withPage({hash:'#dir'}, async p => {
   await ready(p);
   const hrefs = await p.$$eval('#dir-list li.firm a.fn', as => as.map(a => a.getAttribute('href')));
   assert(hrefs.every(h => h.startsWith('#co-')), hrefs[0]);
 })},
 {name:'dir-co-only-firmless', fn: () => withPage({hash:'#dir?q=고려해운'}, async p => {
   await ready(p);
   const rows = await p.$$eval('#dir-list li.firm', lis => lis.map(li => li.textContent));
   assert(rows.length === 1, JSON.stringify(rows));
   assert(rows[0].includes('선사 자료') && rows[0].includes('-'), rows[0]);
 })},
 {name:'search-merged', fn: () => withPage({hash:'#home'}, async p => {
   await p.evaluate(() => uniReady());
   await p.fill('#q-all', '흥아');
   await p.waitForTimeout(300);
   const secs = await p.$$eval('#sx-panel .sx-sec', s => s.map(x => x.textContent));
   assert(!secs.includes('등록 업체'), JSON.stringify(secs));
   const items = await p.$$eval('#sx-panel a.sx-item', as => as.map(a => a.textContent));
   assert(items.some(t => t.includes('흥아라인')) && items.some(t => t.includes('흥아마린(주)') && t.includes('13척 등록')), JSON.stringify(items));
 })},
 {name:'nav-dir-label', fn: () => withPage({}, async p => {
   assert((await p.$eval('#navlinks a[href="#dir"]', a => a.textContent.trim())) === '선사 목록', 'label');
   assert((await p.$eval('.types-more a[href="#dir"]', a => a.textContent)).includes('385곳'), 'home link');
 })},
];
