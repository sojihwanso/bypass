import { withPage, assert } from '../lib.mjs';
export default [
 {name:'mobile-compact-rows', fn: () => withPage({hash:'#type-bulk', width:390, height:844}, async p => {
   await p.waitForSelector('#reg-body tr.row');
   const hidden = await p.$eval('#reg-body tr.row', tr => [6,7,9].every(i => getComputedStyle(tr.children[i-1]).display === 'none'));
   assert(hidden, 'fleet/routes/other cells still shown');
   const h = await p.evaluate(() => document.querySelector('#reg-body').getBoundingClientRect().height);
   assert(h < 24 * 200, 'table still tall: '+h);
   const btn = await p.$('#reg-body tr.row .row-more');
   assert(btn, 'no expand button');
   await btn.click(); await p.waitForTimeout(150);
   assert(await btn.getAttribute('aria-expanded') === 'true', 'aria');
   assert((await p.evaluate(() => location.hash)).startsWith('#type-bulk'), 'navigated away');
   const shown = await p.$eval('#reg-body tr.row', tr => getComputedStyle(tr.children[6]).display !== 'none');
   assert(shown, 'not expanded');
 })},
 {name:'mobile-active-filter-chips', fn: () => withPage({hash:'#type-bulk?cadet=1', width:390, height:844}, async p => {
   await p.waitForSelector('#f-chips button[data-foff]');
   assert((await p.$eval('#f-chips', e => e.textContent)).includes('2027 실습생 선발'), 'chip text');
   await p.click('#f-chips button[data-foff="cadet"]'); await p.waitForTimeout(200);
   assert(!(await p.evaluate(() => location.hash)).includes('cadet=1'), 'filter not removed');
 })},
 {name:'default-sort-rank-then-cadet-toggle', fn: () => withPage({hash:'#type-bulk'}, async p => {
   await p.waitForSelector('#reg-body tr.row');
   const ranks = await p.$$eval('#reg-body tr.row', trs => trs.map(tr => +tr.querySelector('td:nth-child(2)').textContent.trim()));
   assert(ranks.every((v, i) => i === 0 || v > ranks[i-1]), 'default not rank order: '+ranks.slice(0, 8));
   assert(!(await p.evaluate(() => location.hash)).includes('sort='), 'default sort written to url');
   assert(await p.$eval('#sort-seg [data-sort="rank"]', b => b.getAttribute('aria-pressed')) === 'true', 'rank seg not pressed');
   await p.click('#sort-seg [data-sort="job"]'); await p.waitForTimeout(150);
   const yes = await p.$$eval('#reg-body tr.row', trs => trs.map(tr => { const c = CO_BY[tr.dataset.co]; return !!(c.job && c.job.yes); }));
   const firstNo = yes.indexOf(false);
   assert(firstNo > 0 && yes.slice(firstNo).every(v => !v), 'cadet companies not first: '+JSON.stringify(yes));
   assert(await p.$eval('.reg th[data-col="job"]', th => th.getAttribute('aria-sort')) === 'descending', 'aria-sort');
   assert((await p.evaluate(() => location.hash)).includes('sort=job'), 'job sort not in url');
   assert(await p.$eval('.th-sort[data-sort="rank"]', b => b.textContent) === '규모 순위', 'rank header not renamed');
   assert((await p.$eval('#sort-why', e => e.textContent)).includes('실습생 선발'), 'sort-why');
 })},
 {name:'cadet-filters-first', fn: () => withPage({hash:'#type-bulk'}, async p => {
   const first = await p.$eval('#filters .fgroup', g => g.textContent);
   assert(first.includes('2027 실습생 선발') && first.includes('승선근무예비역'), first);
 })},
];
