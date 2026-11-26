import { withPage, assert } from '../lib.mjs';
export default [
 {name:'reg-group-paged', fn: () => withPage({hash:'#type-cement?more=1'}, async p => {
   await p.waitForSelector('#reg-list tbody tr', {timeout:5000});
   const vis = () => p.$$eval('#reg-list tbody tr', trs => trs.filter(tr => !tr.hidden).length);
   assert(await vis() === 20, 'first page '+await vis());
   const more = await p.$('#reg-group button[data-reg-more]');
   assert(more && (await more.textContent()).includes('111곳'), more ? await more.textContent() : 'no button');
   await more.click(); await p.waitForTimeout(150);
   assert(await vis() === 70, 'second page '+await vis());
   assert((await p.$eval('#reg-group', e => e.textContent)).includes('회사 이름 검색만'), 'filter scope note');
 })},
 {name:'side-column-sticky', fn: () => withPage({hash:'#co-HMM'}, async p => {
   await p.waitForSelector('.co-side');
   assert(await p.$eval('.co-side', e => getComputedStyle(e).position) === 'sticky', 'co-side not sticky');
 })},
 {name:'side-column-static-mobile', fn: () => withPage({hash:'#co-HMM', width:390, height:844}, async p => {
   assert(await p.$eval('.co-side', e => getComputedStyle(e).position) !== 'sticky', 'sticky on mobile');
 })},
 {name:'header-shorter', fn: () => withPage({hash:'#home'}, async p => {
   const h = await p.$eval('.mast', e => e.getBoundingClientRect().height);
   assert(h <= 124, 'header '+h);
 })},
];
