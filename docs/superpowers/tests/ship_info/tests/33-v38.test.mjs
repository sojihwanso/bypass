import { withPage, assert } from '../lib.mjs';
const M = {width:390, height:844};
export default [
 {name:'v38-wage-cards-mobile', fn: () => withPage({...M, hash:'#wage'}, async p => {
   await p.waitForSelector('#wage-main tr.wrow');
   const r = await p.evaluate(() => { const tr = document.querySelector('#wage-main tr.wrow'); const tot = tr.querySelector('td[data-l="전체 평균"]').getBoundingClientRect();
     return {disp: getComputedStyle(tr).display, totR: tot.right, vw: innerWidth, sw: document.querySelector('#wage-main').closest('.table-scroll').scrollWidth, cw: document.querySelector('#wage-main').closest('.table-scroll').clientWidth}; });
   assert(r.disp === 'grid' && r.totR <= r.vw && r.sw <= r.cw + 1, JSON.stringify(r));
 })},
 {name:'v38-wage-table-desktop', fn: () => withPage({hash:'#wage'}, async p => {
   await p.waitForSelector('#wage-main tr.wrow');
   assert(await p.$eval('#wage-main tr.wrow', tr => getComputedStyle(tr).display) === 'table-row', 'desktop not table');
 })},
 {name:'v38-filters-more', fn: () => withPage({hash:'#type-bulk'}, async p => {
   assert(!(await p.$eval('#f-fleet', e => e.getBoundingClientRect().height > 0)), 'fleet visible before more');
   await p.click('#f-more');
   assert(await p.$eval('#f-fleet', e => e.getBoundingClientRect().height > 0), 'fleet hidden after more');
   await p.click('#f-routes .chip[data-r="미주"]'); await p.click('#f-more');
   assert(await p.$eval('#f-routes', e => e.getBoundingClientRect().height > 0), 'active secondary filter hidden');
   assert((await p.$eval('#f-more', e => e.textContent)).includes('1개 적용'), 'count');
 })},
 {name:'v38-filters-mobile-all', fn: () => withPage({...M, hash:'#type-bulk'}, async p => {
   await p.click('#f-toggle');
   assert(await p.$eval('#f-routes', e => e.getBoundingClientRect().height > 0), 'routes hidden in mobile panel');
 })},
 {name:'v38-other-types-capped', fn: () => withPage({hash:'#type-bulk'}, async p => {
   const r = await p.$$eval('#reg-body .other', d => d.map(x => x.querySelectorAll('a:not(.more-t)').length));
   assert(r.every(n => n <= 2), 'more than 2 chips '+r);
   assert(await p.$$eval('#reg-body .more-t', a => a.length) > 0, 'no +N chip');
 })},
 {name:'v38-mobile-version-top', fn: () => withPage({width:360, height:700}, async p => {
   const r = await p.$eval('#ver-top', e => { const b = e.getBoundingClientRect(); return {h: b.height, r: b.right, vw: innerWidth}; });
   assert(r.h > 0 && r.r <= r.vw, JSON.stringify(r));
 })},
 {name:'v38-bp-home-yields-on-scroll', fn: () => withPage({...M}, async p => {
   await p.mouse.wheel(0, 900); await p.waitForTimeout(500);
   assert(await p.$eval('.bp-home', b => b.classList.contains('bp-away')), 'not hidden on scroll down');
   await p.mouse.wheel(0, -300); await p.waitForTimeout(500);
   assert(!(await p.$eval('.bp-home', b => b.classList.contains('bp-away'))), 'not shown on scroll up');
 })},
 {name:'v38-switch-overflow-hint', fn: () => withPage({...M, hash:'#type-heavy'}, async p => {
   await p.waitForTimeout(300);
   const ov = await p.$eval('#type-switch', e => e.dataset.ov || '');
   assert(ov.includes('l'), 'no left hint when scrolled to current: '+ov);
 })}
];
