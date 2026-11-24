import { withPage, assert } from '../lib.mjs';
export default [
 {name:'compare-filled-no-hscroll-mobile', fn: () => withPage({width:390,height:844,hash:'#compare', init:{fn: () => localStorage.setItem('sasarok-cmp-v1', JSON.stringify({co:['HMM','팬오션'], ty:['lng','bulk']}))}}, async p => {
   for (const tab of ['#ct-co','#ct-ty']){
     await p.click(tab);
     const w = await p.evaluate(() => document.documentElement.scrollWidth);
     assert(w <= 390, tab+' scrollWidth '+w);
   }
 })},
 {name:'fleet-reset-across-types', fn: () => withPage({hash:'#type-container?fleet=l&cadet=1'}, async p => {
   await p.evaluate(() => location.hash = 'type-bulk'); await p.waitForTimeout(200);
   assert(await p.$eval('#f-fleet', s => s.value) === 'all', 'fleet kept');
   assert(await p.$eval('#f-cadet', c => c.checked), 'cadet lost');
 })},
 {name:'mobile-header-dark-filled', fn: async () => {
   for (const theme of ['light','dark']) await withPage({width:390,height:844,theme,init:{fn: () => localStorage.setItem('sasarok-cmp-v1', JSON.stringify({co:['HMM','팬오션'], ty:['lng']}))}}, async p => {
     const r = await p.evaluate(() => ({w: document.documentElement.scrollWidth, logo: document.querySelector('.bp-logo').getBoundingClientRect().right}));
     assert(r.w <= 390 && r.logo <= 390, theme+' '+JSON.stringify(r));
   });
 }}
];
