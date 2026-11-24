import { withPage, assert, contrast } from '../lib.mjs';
const bgOf = (p, sel) => p.$eval(sel, el => { let e = el; while (e) { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; e = e.parentElement; } return 'rgb(255,255,255)'; });
export default [
 {name:'chip-contrast', fn: async () => {
   for (const theme of ['light','dark']) await withPage({theme, hash:'#news'}, async p => {
     const sel = '#news-cats .chip[aria-pressed="true"]';
     const bg = await bgOf(p, sel);
     const fg = await p.$eval(sel, el => getComputedStyle(el).color);
     const sm = await p.$eval(sel+' small', el => ({c:getComputedStyle(el).color, o:getComputedStyle(el).opacity}));
     assert(contrast(fg,bg) >= 4.5, theme+' chip '+contrast(fg,bg).toFixed(2));
     assert(sm.o === '1' && contrast(sm.c,bg) >= 4.5, theme+' chip small '+contrast(sm.c,bg).toFixed(2)+' op '+sm.o);
   });
 }},
 {name:'placeholder-contrast', fn: async () => {
   for (const theme of ['light','dark']) await withPage({theme}, async p => {
     const c = await p.$eval('#q-all', el => getComputedStyle(el, '::placeholder').color);
     const bg = await bgOf(p, '#q-all');
     assert(contrast(c,bg) >= 4.5, theme+' placeholder '+c+' on '+bg+' = '+contrast(c,bg).toFixed(2));
   });
 }},
 {name:'compare-uses-ctag', fn: () => withPage({hash:'#type-container'}, async p => {
   const boxes = await p.$$('#reg-body input[data-pickco]');
   await boxes[0].check(); await boxes[1].check();
   await p.evaluate(() => location.hash = 'compare'); await p.waitForTimeout(200);
   const n = await p.$$eval('#cmp-table .ctag', e => e.length);
   const txt = await p.$eval('#cmp-table', e => e.textContent);
   assert(n >= 1, 'no ctag in compare');
   assert(!/\((보도|환산|추정)\)/.test(txt), 'bracket tags remain');
 })},
 {name:'estimate-not-red', fn: () => withPage({hash:'#type-container'}, async p => {
   const c = await p.evaluate(() => { const s = document.createElement('span'); s.className = 'ctag e'; document.body.append(s); return getComputedStyle(s).color; });
   assert(c !== 'rgb(179, 38, 30)', 'estimate is red');
 })},
 {name:'status-no-sidebar', fn: () => withPage({hash:'#board'}, async p => {
   const b = await p.$eval('.status', el => { const s = getComputedStyle(el); return [s.borderLeftWidth, s.borderTopWidth]; });
   assert(b[0] === b[1], 'border '+b);
 })}
];
