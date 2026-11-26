import { withPage, assert } from '../lib.mjs';
const ready = p => p.waitForSelector('#wage-main tbody tr.wrow', {timeout:4000});
const rowsOf = p => p.$$eval('#wage-main tbody tr.wrow', trs => trs.map(tr => [...tr.cells].map(td => td.textContent.trim())));
const num = s => s === '-' ? -1 : Number(s.replace(/,/g, ''));
export default [
 {name:'wage-default-ocean', fn: () => withPage({hash:'#wage'}, async p => {
   await ready(p);
   assert((await p.$eval('#v-wage .seg [aria-pressed="true"]', b => b.textContent.trim())) === '외항선', 'pressed');
   const rows = await rowsOf(p);
   assert(rows[0][0].includes('자동차') && rows[0][1] === '1,053', JSON.stringify(rows[0]));
 })},
 {name:'wage-switch-coastal-url', fn: () => withPage({hash:'#wage'}, async p => {
   await ready(p);
   await p.click('#v-wage .seg button:text-is("내항선")');
   await p.waitForTimeout(300);
   assert((await p.evaluate(() => location.hash)).startsWith('#wage?biz=coastal'), await p.evaluate(() => location.hash));
   assert((await rowsOf(p)).length === 12, 'rows '+(await rowsOf(p)).length);
 })},
 {name:'wage-sort-master', fn: () => withPage({hash:'#wage?biz=ocean&sort=master'}, async p => {
   await ready(p);
   const rows = await rowsOf(p);
   const col = rows.map(r => num(r[2]));
   assert(col[0] === Math.max(...col), JSON.stringify(col));
   assert(await p.$eval('#wage-main th[aria-sort="descending"]', th => th.textContent.trim()).then(s => s.startsWith('선장')), 'aria-sort');
 })},
 {name:'wage-sort-click', fn: () => withPage({hash:'#wage'}, async p => {
   await ready(p);
   await p.click('#wage-main th button:text-is("기관장")');
   await p.waitForTimeout(300);
   assert((await p.evaluate(() => location.hash)).includes('sort=ce'), await p.evaluate(() => location.hash));
 })},
 {name:'wage-bad-query', fn: () => withPage({hash:'#wage?biz=xx&sort=yy'}, async (p, errors) => {
   await ready(p);
   assert((await p.$eval('#v-wage .seg [aria-pressed="true"]', b => b.textContent.trim())) === '외항선', 'pressed');
   assert(errors.length === 0, errors.join('; '));
 })},
 {name:'wage-names-paren', fn: () => withPage({hash:'#wage'}, async p => {
   await ready(p);
   const names = (await rowsOf(p)).map(r => r[0].replace('표본 적음', '').trim());
   assert(names.includes('벌크선 (잡화)'), JSON.stringify(names));
   assert(names.includes('원유운반선·석유제품선/케미컬선 (유조)'), JSON.stringify(names));
   assert(names.includes('냉동'), JSON.stringify(names));
   await p.click('#v-wage .seg button:text-is("내항선")'); await p.waitForTimeout(300);
   const n2 = (await rowsOf(p)).map(r => r[0].replace('표본 적음', '').trim());
   assert(n2.includes('벌크선·시멘트선/연안선 (잡화)'), JSON.stringify(n2));
 })},
 {name:'wage-summary-six', fn: () => withPage({hash:'#wage'}, async p => {
   await ready(p);
   const n = await p.$$eval('#wage-sum tbody tr', trs => trs.length);
   assert(n === 6, 'summary rows '+n);
 })},
 {name:'wage-mobile-no-hscroll', fn: async () => {
   for (const theme of ['light','dark']) await withPage({hash:'#wage', width:390, height:844, theme}, async p => {
     await ready(p);
     const w = await p.evaluate(() => document.documentElement.scrollWidth);
     assert(w <= 390, theme+' scrollWidth '+w);
   });
 }},
];
