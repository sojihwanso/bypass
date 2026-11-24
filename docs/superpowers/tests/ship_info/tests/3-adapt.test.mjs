import { withPage, assert } from '../lib.mjs';
const M = {width:390,height:844};
export default [
 {name:'no-hscroll-mobile', fn: async () => {
   for (const h of ['#home','#type-container','#co-HMM','#compare','#news','#board']){
     await withPage({...M, hash:h}, async p => {
       const w = await p.evaluate(() => document.documentElement.scrollWidth);
       assert(w <= 390, h+' scrollWidth '+w);
     });
   }
 }},
 {name:'card-shows-job', fn: () => withPage({...M, hash:'#type-container'}, async p => {
   const r = await p.$eval('#reg-body tr.row .jobs', el => el.getBoundingClientRect().right);
   assert(r <= 390, 'jobs right '+r);
 })},
 {name:'touch-targets', fn: () => withPage({...M, hash:'#type-container'}, async p => {
   if (await p.$eval('#f-toggle', b => b.getAttribute('aria-expanded')) !== 'true') await p.click('#f-toggle');
   const h = await p.evaluate(() => ({
     pick: document.querySelector('#reg-body td.pick').getBoundingClientRect().height,
     pickLabel: (() => { const i = document.querySelector('#reg-body input[data-pickco]'); const l = i.closest('label') || document.querySelector('label[for="'+i.id+'"]'); return l ? l.getBoundingClientRect().height : 0; })(),
     star: document.querySelector('#type-head .star').getBoundingClientRect().height,
     chip: document.querySelector('#f-routes .chip').getBoundingClientRect().height }));
   assert(h.pickLabel >= 40, 'pick label '+h.pickLabel);
   assert(h.star >= 40, 'star '+h.star);
   assert(h.chip >= 40, 'chip '+h.chip);
 })},
 {name:'row-keyboard', fn: async () => {
   await withPage({hash:'#type-container'}, async p => {
     await p.focus('#reg-body tr.row'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
     assert((await p.evaluate(() => location.hash)).startsWith('#co-'), 'row enter');
   });
   await withPage({}, async p => {
     await p.focus('#type-list .trow'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
     assert((await p.evaluate(() => location.hash)).startsWith('#type-'), 'trow enter');
   });
 }},
 {name:'qtabs-arrows', fn: () => withPage({hash:'#board'}, async p => {
   await p.focus('#qt-pub'); await p.keyboard.press('ArrowRight');
   assert(await p.$eval('#qt-wait', b => b.getAttribute('aria-selected')) === 'true', 'not selected');
   assert(await p.evaluate(() => document.activeElement.id) === 'qt-wait', 'focus not moved');
 })},
 {name:'mobile-mast-height', fn: () => withPage({...M}, async p => {
   const h = await p.$eval('header.mast', el => el.getBoundingClientRect().height);
   assert(h <= 170, 'mast '+h);
 })}
];
