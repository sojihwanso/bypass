import { withPage, assert } from '../lib.mjs';
const M = {width:390, height:844};
/* 배 레이어: 배경판 위에 배가 원래 그림 자리에 놓이고(.go 후), 테마별 그림만 받는다 */
const stage = (p, t) => p.evaluate(t => {
  const art = document.querySelector('.hero-'+t), st = art.querySelector('.hero-stage').getBoundingClientRect(), a = art.getBoundingClientRect();
  const ships = [...art.querySelectorAll('.ship')].map(i => ({src:i.currentSrc, w:i.getBoundingClientRect().width, op:getComputedStyle(i).opacity, anim:getComputedStyle(i).animationName}));
  return {go: art.classList.contains('go'), art:{w:a.width,h:a.height}, st:{l:st.left-a.left, t:st.top-a.top, w:st.width, h:st.height}, ships};
}, t);
export default [
 {name:'v35-bypass-left-column', fn: () => withPage({width:1440}, async p => {
   const r = await p.evaluate(() => { const q = s => document.querySelector('#v-home '+s).getBoundingClientRect();
     return {inMain: !!document.querySelector('#v-home .home-main > .bypass'), types:q('.types'), bp:q('.bypass'), news:q('.news')}; });
   assert(r.inMain, 'bypass not in left wrapper');
   assert(Math.abs(r.bp.x - r.types.x) < 1 && r.bp.y > r.types.bottom, 'bypass not under types: '+JSON.stringify(r));
   assert(r.bp.x < r.news.x, 'bypass not left of news');
 })},
 {name:'v35-bypass-last-on-mobile', fn: () => withPage(M, async p => {
   const r = await p.evaluate(() => ['.types','.fav','.news','.bshell','.bypass'].map(s => document.querySelector('#v-home '+s).getBoundingClientRect().top));
   for (let i=1;i<r.length;i++) assert(r[i] > r[i-1], 'order '+r.join(','));
 })},
 {name:'v35-ships-light', fn: () => withPage({theme:'light'}, async p => {
   await p.waitForFunction(() => document.querySelector('.hero-day').classList.contains('go'), null, {timeout:5000});
   await p.waitForTimeout(700);
   const r = await stage(p, 'day');
   assert(r.ships.length === 4 && r.ships.every(s => s.src.includes('hero-day-ship') && s.w > 50 && s.op === '1'), 'ships '+JSON.stringify(r.ships));
   assert(r.ships.every(s => s.anim.includes('ship-in') && s.anim.includes('ship-bob')), 'anim '+r.ships[0].anim);
   /* cover + 오른쪽 40%: 무대가 칸을 덮고 오른쪽에 붙는다 */
   assert(r.st.w >= r.art.w - 1 && r.st.h >= r.art.h - 1 && Math.abs(r.st.l + r.st.w - r.art.w) < 1, 'stage '+JSON.stringify(r));
   assert(Math.abs(r.st.w / r.st.h - 1376/614) < 0.01, 'ratio');
   const night = await p.evaluate(() => [...document.querySelectorAll('.hero-night img')].some(i => i.getAttribute('src')));
   assert(!night, 'night images loaded in light');
 })},
 {name:'v35-ships-dark-mobile', fn: () => withPage({...M, theme:'dark'}, async p => {
   await p.waitForFunction(() => document.querySelector('.hero-night').classList.contains('go'), null, {timeout:5000});
   const r = await stage(p, 'night');
   assert(r.art.h === 180, 'mobile art height '+r.art.h);
   assert(r.ships.length === 4 && r.ships.every(s => s.src.includes('hero-night-ship')), 'ships');
   assert(r.st.w >= r.art.w - 1 && r.st.h >= r.art.h - 1, 'stage covers '+JSON.stringify(r));
   const lead = await p.$eval('.hero-in', el => el.getBoundingClientRect().top);
   assert(lead >= 180, 'hero text overlaps art on mobile');
 })},
 {name:'v35-reduced-motion', fn: () => withPage({init:{fn: () => {}, arg:null}}, async p => {
   await p.emulateMedia({reducedMotion:'reduce'});
   await p.waitForTimeout(300);
   const r = await p.$$eval('.hero-day .ship', a => a.map(i => [getComputedStyle(i).animationName, getComputedStyle(i).opacity]));
   assert(r.every(([n, o]) => n === 'none' && o === '1'), 'reduced '+JSON.stringify(r));
 })},
 {name:'v36-bp-home', fn: async () => {
   for (const o of [{width:1440}, {width:390,height:844,theme:'dark'}]) await withPage(o, async p => {
     const r = await p.$eval('.bp-home', e => { const b = e.getBoundingClientRect(); return {l:b.left, bot:innerHeight-b.bottom, pos:getComputedStyle(e).position, lbl:e.getAttribute('aria-label')}; });
     assert(r.pos === 'fixed' && r.l === 12 && r.bot === 12 && r.lbl.includes('BYPASS'), JSON.stringify(r));
   });
 }},
 {name:'v37-bp-mark-no-overlap', fn: async () => {
   for (const w of [1440, 1000, 390]) await withPage({width:w, height:900}, async p => {
     const r = await p.evaluate(() => { const card = document.querySelector('#v-home .bypass'), m = card.querySelector('.bp-mark').getBoundingClientRect();
       const hit = [...card.querySelectorAll('p span, h2, .bp-tag, li, a')].filter(e => { const b = e.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(e); const t = rg.getBoundingClientRect();
         return t.right > m.left + 4 && t.left < m.right - 4 && t.bottom > m.top + 4 && t.top < m.bottom - 4; }).map(e => e.textContent.slice(0, 20));
       return {w: m.width, hit}; });
     assert(r.w > 40 && r.hit.length === 0, w+' '+JSON.stringify(r));
   });
 }},
 {name:'v35-version', fn: () => withPage({}, async p => {
   const t = await p.$eval('#ver-top', e => e.textContent.trim());
   assert(t === 'v. 3.8.0', t);
 })}
];
