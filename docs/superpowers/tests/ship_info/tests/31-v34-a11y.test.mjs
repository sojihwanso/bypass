import { withPage, assert } from '../lib.mjs';
export default [
 {name:'skip-link-first', fn: () => withPage({hash:'#type-bulk'}, async p => {
   await p.keyboard.press('Tab');
   const r = await p.evaluate(() => ({t: document.activeElement.textContent.trim(), h: document.activeElement.getAttribute('href'), vis: document.activeElement.getBoundingClientRect().height > 0}));
   assert(r.h === '#main' && r.t.includes('본문') && r.vis, JSON.stringify(r));
   await p.keyboard.press('Enter'); await p.waitForTimeout(150);
   const r2 = await p.evaluate(() => ({id: document.activeElement.id, hash: location.hash}));
   assert(r2.id === 'main' && r2.hash.startsWith('#type-bulk'), JSON.stringify(r2));
 })},
 {name:'cadet-badge-not-color-only', fn: () => withPage({hash:'#type-bulk'}, async p => {
   const r = await p.evaluate(() => { const on = getComputedStyle(document.querySelector('.jb.on')), off = getComputedStyle(document.querySelector('.jb:not(.on)')); return [on.fontWeight, off.fontWeight, on.backgroundColor, off.backgroundColor]; });
   assert(Number(r[0]) >= 600 && Number(r[1]) < 600 && r[2] !== r[3], JSON.stringify(r));
 })},
];
