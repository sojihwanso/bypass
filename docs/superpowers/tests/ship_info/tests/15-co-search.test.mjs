import { withPage, assert } from '../lib.mjs';
const regReady = p => p.waitForSelector('#co-reg:not([hidden]) h2', {timeout:4000});
export default [
 {name:'co-reg-panel-hmm', fn: () => withPage({hash:'#co-HMM'}, async p => {
   await regReady(p);
   const t = await p.$eval('#co-reg', e => e.textContent);
   assert(t.includes('65척'), t);
   assert(t.includes('기준이 다릅니다'), t);
 })},
 {name:'co-reg-managed', fn: () => withPage({hash:'#co-현대글로비스'}, async p => {
   await regReady(p);
   const t = await p.$eval('#co-reg', e => e.textContent);
   assert(t.includes('지마린서비스 이름으로 등록'), t);
   assert(!/\d+척/.test(t), 'count shown '+t);
 })},
 {name:'co-reg-hidden', fn: async () => {
   for (const n of ['팬오션', '동주해운']) await withPage({hash:'#co-'+n}, async p => {
     await p.waitForTimeout(600);
     assert(await p.$eval('#co-reg', e => e.hidden), n+' shown');
   });
 }},
 {name:'co-reg-count-39', fn: () => withPage({hash:'#home'}, async (p, errors) => {
   const apps = await p.evaluate(async () => (await loadData('koswec')).firms.filter(f => f.app).map(f => f.app));
   assert(apps.length === 39, 'apps '+apps.length);
   for (const a of apps){
     await p.evaluate(h => location.hash = h, '#co-'+encodeURIComponent(a));
     await p.waitForSelector('#co-reg:not([hidden]) h2', {timeout:3000}).catch(() => { throw new Error('no panel '+a); });
   }
   assert(errors.length === 0, errors.join('; '));
 })},
 {name:'search-firm', fn: () => withPage({hash:'#home'}, async p => {
   await p.fill('#q-all', '흥아마린');
   await p.waitForSelector('#sx-panel .sx-item[href^="#firm-"]', {timeout:4000});
 })},
 {name:'search-help-links', fn: () => withPage({hash:'#home'}, async p => {
   await p.fill('#q-all', '?');
   assert(await p.$('#sx-panel a.sx-item[href="#wage"]') && await p.$('#sx-panel a.sx-item[href="#dir"]'), 'help links');
 })},
 {name:'home-links', fn: () => withPage({hash:'#home'}, async p => {
   assert(await p.$('.types-more a[href="#wage"]'), 'wage');
   assert(await p.$('.types-more a[href="#dir"]'), 'dir');
 })},
];
