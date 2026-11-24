import { withPage, assert } from '../lib.mjs';
export default [
 {name:'table-above-pros', fn: () => withPage({hash:'#type-container'}, async p => {
   const r = await p.evaluate(() => [document.querySelector('#v-type .table-scroll').getBoundingClientRect().top, document.querySelector('#type-pc').getBoundingClientRect().top]);
   assert(r[0] < r[1], 'table not above pros '+r);
 })},
 {name:'table-in-first-screens-mobile', fn: () => withPage({width:390,height:844,hash:'#type-container'}, async p => {
   const top = await p.$eval('#reg-body tr', el => el.getBoundingClientRect().top + scrollY);
   assert(top < 1400, 'first row at '+top);
 })},
 {name:'pros-collapsed', fn: () => withPage({hash:'#type-lng'}, async p => {
   const visible = () => p.$$eval('#type-pc .pros li', els => els.filter(e => e.getClientRects().length).length);
   const total = await p.$$eval('#type-pc .pros li', els => els.length);
   assert(await visible() === 3, 'visible '+(await visible()));
   await p.click('#type-pc .pros .pc-more');
   assert(await visible() === total, 'after expand '+(await visible())+'/'+total);
   assert(await p.$eval('#type-pc .pros .pc-more', b => b.getAttribute('aria-expanded')) === 'true', 'aria-expanded');
 })},
 {name:'readme-open-home-only', fn: async () => {
   await withPage({}, async p => assert(await p.$eval('#readme', d => !d.hidden) === true, 'closed on home'));
   await withPage({hash:'#type-lng'}, async p => assert(await p.$eval('#readme', d => !d.hidden) === false, 'open on type'));
 }}
];
