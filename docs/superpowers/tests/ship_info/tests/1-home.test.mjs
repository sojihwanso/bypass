import { withPage, assert, contrast } from '../lib.mjs';
const vis = (p, sel) => p.$eval(sel, el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().height > 0; });
export default [
 {name:'hero-present', fn: () => withPage({}, async p => {
   const h = await p.$eval('#v-home .hero h1, .hero h1', el => el.textContent.replace(/\s/g,''));
   assert(h === '배종류부터정하면지원할회사가좁혀집니다', 'h1: '+h);
   const c = await p.$eval('.hero-cta', el => el.textContent.trim());
   assert(c === '선종 고르기', 'cta: '+c);
 })},
 {name:'hero-theme-swap', fn: async () => {
   await withPage({theme:'light'}, async p => {
     assert(await vis(p,'.hero-art.hero-day'), 'day hidden in light');
     assert(!(await vis(p,'.hero-art.hero-night')), 'night visible in light');
   });
   await withPage({theme:'dark'}, async p => {
     assert(await vis(p,'.hero-art.hero-night'), 'night hidden in dark');
     assert(!(await vis(p,'.hero-art.hero-day')), 'day visible in dark');
     const col = await p.$eval('.hero h1', el => getComputedStyle(el).color);
     const r = contrast(col, 'rgb(11,22,38)'); assert(r >= 4.5, 'dark h1 contrast '+r.toFixed(2));
   });
 }},
 {name:'hero-only-on-home', fn: () => withPage({hash:'#type-lng'}, async p => {
   assert(!(await vis(p,'.hero')), 'hero visible on type page');
 })},
 {name:'types-first', fn: async () => {
   await withPage({width:1440}, async p => {
     const r = await p.evaluate(() => Object.fromEntries(['.types','.fav','.news'].map(s => { const b = document.querySelector('#v-home '+s).getBoundingClientRect(); return [s,{x:b.x,y:b.y}]; })));
     assert(r['.types'].y <= r['.news'].y && r['.types'].y <= r['.fav'].y, 'types not top: '+JSON.stringify(r));
     assert(r['.types'].x < r['.news'].x, 'types not left');
   });
   await withPage({width:390,height:844}, async p => {
     const order = await p.evaluate(() => ['.hero','#v-home .types','#v-home .fav','#v-home .news','#v-home .bshell','#v-home .bypass'].map(s => document.querySelector(s).getBoundingClientRect().top));
     for (let i=1;i<order.length;i++) assert(order[i] > order[i-1], 'mobile order broken at '+i+': '+order.join(','));
   });
 }},
 {name:'fav-collapsed-empty', fn: () => withPage({}, async p => {
   const h = await p.$eval('#v-home .fav', el => el.getBoundingClientRect().height);
   assert(h <= 72, 'fav height '+h);
 })},
 {name:'cta-contrast', fn: () => withPage({}, async p => {
   const c = await p.$eval('.hero-cta', el => getComputedStyle(el).color);
   assert(c === 'rgb(22, 24, 29)', 'cta color '+c);
 })}
];
