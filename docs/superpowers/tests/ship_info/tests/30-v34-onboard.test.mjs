import { withPage, assert } from '../lib.mjs';
export default [
 {name:'compare-empty-has-type-links', fn: () => withPage({hash:'#compare'}, async p => {
   const n = await p.$$eval('#v-compare .cmp-empty a[href^="#type-"]', as => as.length);
   assert(n === 9, 'type links '+n);
 })},
 {name:'wage-row-links-type', fn: () => withPage({hash:'#wage'}, async p => {
   await p.waitForSelector('#wage-main tbody tr.wrow');
   const row = await p.$('#wage-main tbody tr.wrow:has-text("벌크선 (잡화)")');
   assert(row, 'bulk row');
   const href = await row.$eval('a[href^="#type-"]', a => a.getAttribute('href'));
   assert(href === '#type-bulk', href);
   const cold = await p.$('#wage-main tbody tr.wrow:has-text("냉동") a[href^="#type-"]');
   assert(!cold, 'stat-only type should have no link');
 })},
];
