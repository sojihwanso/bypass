import { withPage, assert } from '../lib.mjs';
export default [
 {name:'version-shown', fn: () => withPage({}, async p => {
   const r = await p.evaluate(() => ({
     top: document.querySelector('#ver-top').textContent.trim(), foot: document.querySelector('#ver-foot').textContent.trim(),
     tx: document.querySelector('#ver-top').getBoundingClientRect().x, lx: document.querySelector('.bp-logo').getBoundingClientRect().x,
     fc: (r => r.x + r.width/2)(document.querySelector('#ver-foot').getBoundingClientRect()), vc: innerWidth/2 }));
   assert(r.top === 'v1.0.0' && r.foot === 'v1.0.0', 'text '+r.top+' / '+r.foot);
   assert(r.tx < r.lx, 'version not left of logo');
   assert(Math.abs(r.fc - r.vc) <= 4, 'footer not centered '+r.fc+' vs '+r.vc);
 })},
 {name:'egg-opens', fn: () => withPage({}, async p => {
   for (let i=0;i<5;i++) await p.click('#ver-top');
   assert(await p.$eval('.egg-card .ev', e => e.textContent.trim()) === 'Ver.1.0.0', 'ev');
   await p.click('.egg-pn');
   const first = await p.$eval('.egg-card.pn section h4', e => e.textContent);
   assert(first.includes('v1.0.0'), 'patch '+first);
   await p.keyboard.press('Escape');
   assert(await p.$('.egg') === null, 'egg not closed');
 })},
 {name:'bp-logo-link', fn: () => withPage({}, async p => {
   const r = await p.$eval('.bp-logo', a => [a.href, a.querySelector('img').getAttribute('src')]);
   assert(r[0] === 'https://teambypass.vercel.app/', 'href '+r[0]);
   assert(r[1] === '/assets/favicon.svg', 'src '+r[1]);
 })},
 {name:'news-filter-heights', fn: () => withPage({hash:'#news'}, async p => {
   const r = await p.evaluate(() => ['#nf-from','#nf-reset'].map(s => document.querySelector(s).getBoundingClientRect().height));
   assert(Math.abs(r[0]-r[1]) <= 2, 'heights '+r);
 })},
 {name:'reset-style-same', fn: async () => {
   const get = (hash, sel) => withPage({hash}, p => p.$eval(sel, e => { const s = getComputedStyle(e); return [s.borderTopWidth, s.paddingTop, s.paddingLeft, s.fontSize, s.textDecorationLine].join('|'); }));
   const a = await get('#type-container', '#f-reset'), b = await get('#news', '#nf-reset');
   assert(a === b, a+' vs '+b);
 }},
 {name:'home-news-fade', fn: () => withPage({}, async p => {
   const m = await p.$eval('#news-list', e => { const s = getComputedStyle(e); return s.maskImage || s.webkitMaskImage || 'none'; });
   assert(m !== 'none', 'mask '+m);
 })},
 {name:'header-fits-360', fn: () => withPage({width:360,height:780}, async p => {
   const r = await p.evaluate(() => ({w: document.documentElement.scrollWidth, logo: document.querySelector('.bp-logo').getBoundingClientRect(), ver: document.querySelector('#ver-top').getBoundingClientRect()}));
   assert(r.w <= 360, 'scrollWidth '+r.w);
   const dh = await p.$eval('.mast-meta > span:first-child', e => e.getClientRects().length ? e.getBoundingClientRect().height : 0);
   assert(dh < 24, 'date wraps '+dh);
   assert(Math.abs(r.logo.top - r.ver.top) < 12 && r.logo.right <= 360, 'logo wrapped '+JSON.stringify(r.logo));
 })},
 {name:'cmp-head-line', fn: () => withPage({hash:'#type-container'}, async p => {
   await (await p.$$('#reg-body input[data-pickco]'))[0].check();
   await p.evaluate(() => location.hash = 'compare'); await p.waitForTimeout(200);
   const w = await p.$eval('.cmp thead th:first-child', e => getComputedStyle(e).borderLeftWidth);
   assert(w === '0px', 'border '+w);
 })}
];
