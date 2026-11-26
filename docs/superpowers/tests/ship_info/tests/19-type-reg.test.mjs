import { withPage, assert } from '../lib.mjs';
const head = p => p.waitForSelector('#reg-group button[aria-expanded]', {timeout:4000});
export default [
 {name:'reg-group-cement', fn: () => withPage({hash:'#type-cement'}, async p => {
   await head(p);
   const b = await p.$('#reg-group button[aria-expanded]');
   assert(await b.getAttribute('aria-expanded') === 'false', 'not folded');
   assert((await b.textContent()).includes('131곳'), await b.textContent());
   assert(!(await p.isVisible('#reg-list')), 'list visible while folded');
   await b.click(); await p.waitForTimeout(200);
   assert((await p.$$('#reg-list tbody tr')).length === 131, 'rows');
   assert((await p.evaluate(() => location.hash)).includes('more=1'), 'url');
   const c = await p.$$eval('#reg-list tbody tr', trs => trs.map(tr => Number(tr.dataset.n)));
   assert(c.every((v, i) => i === 0 || c[i-1] >= v), 'not sorted');
 })},
 {name:'reg-group-search-opens', fn: () => withPage({hash:'#type-bulk'}, async p => {
   await head(p);
   const n = await p.evaluate(() => regOnlyFor('bulk')[0].n);
   await p.evaluate(h => location.hash = h, '#type-bulk?q=' + encodeURIComponent(n.slice(0, 4)));
   await p.waitForSelector('#reg-list tbody tr', {timeout:4000});
   assert(await p.isVisible('#reg-list'), 'not opened');
   assert((await p.$eval('#reg-list', e => e.textContent)).includes(n), 'firm missing');
   assert((await p.$eval('#reg-group', e => e.textContent)).includes('검색어에 맞는 회사'), 'hint');
 })},
 {name:'reg-group-hidden-by-filter', fn: () => withPage({hash:'#type-bulk?cadet=1'}, async p => {
   await p.waitForSelector('#reg-group .note', {timeout:4000});
   assert(!(await p.$('#reg-list')), 'list shown');
   assert((await p.$eval('#reg-group', e => e.textContent)).includes('선사 자료가 있는 회사에만'), 'note');
 })},
 {name:'reg-group-no-dup', fn: () => withPage({hash:'#type-container?more=1'}, async p => {
   await p.waitForSelector('#reg-list tbody tr', {timeout:4000});
   const top = await p.$$eval('#reg-body tr.row', trs => trs.map(tr => tr.dataset.co));
   const reg = await p.$$eval('#reg-list tbody tr', trs => trs.map(tr => tr.querySelector('a').textContent.trim()));
   assert(!reg.includes('에이치엠엠(주)'), 'HMM firm in group');
   assert(!reg.some(n => top.includes(n)), 'dup');
 })},
 {name:'reg-group-head-count', fn: () => withPage({hash:'#type-lng'}, async p => {
   await head(p);
   await p.waitForFunction(() => document.querySelector('#type-head .sub').textContent.includes('등록만'), null, {timeout:4000});
   assert((await p.$eval('#type-head .sub', e => e.textContent)).includes('등록만 1곳'), 'head');
 })},
 {name:'reg-group-star-keeps-open', fn: () => withPage({hash:'#type-cement?more=1'}, async p => {
   await p.waitForSelector('#reg-list tbody tr', {timeout:4000});
   await p.click('#type-head button[data-star]'); await p.waitForTimeout(300);
   assert(await p.isVisible('#reg-list'), 'collapsed after star');
 })},
 {name:'reg-group-mobile', fn: async () => {
   for (const theme of ['light','dark']) await withPage({hash:'#type-cement?more=1', width:390, height:844, theme}, async p => {
     await p.waitForSelector('#reg-list tbody tr', {timeout:4000});
     const w = await p.evaluate(() => document.documentElement.scrollWidth);
     assert(w <= 390, theme+' scrollWidth '+w);
   });
 }},
];
