import { withPage, assert } from '../lib.mjs';
export default [
 {name:'term-fleet', fn: () => withPage({}, async p => {
   const n = await p.evaluate(() => (document.documentElement.innerHTML.match(/선대 규모/g) || []).length);
   assert(n === 0, '선대 규모 x'+n);
 })},
 {name:'term-compare', fn: async () => {
   await withPage({}, async p => {
     const labels = await p.$$eval('#type-list label.pk', ls => ls.map(l => l.textContent.trim()));
     assert(labels.length && labels.every(t => t === '비교에 담기'), 'home labels '+labels[0]);
   });
   await withPage({hash:'#type-lng'}, async p => {
     const t = await p.$eval('#type-head label.check', l => l.textContent.trim());
     assert(t === '비교에 담기', 'type head '+t);
     const th = await p.$eval('.reg thead th', e => e.textContent.trim());
     assert(th === '비교에 담기' || th === '담기', 'th '+th);
   });
 }},
 {name:'cadet-split', fn: () => withPage({hash:'#type-container'}, async p => {
   const r = await p.evaluate(() => {
     const all = document.getElementById('reg-body').innerHTML;
     const no = CO.find(c => c.job && cadetState(c.job) === 'no' && c.types.length);
     return { slash: /없음\/미정/.test(all), no: no && {n:no.n, t:no.types[0]} };
   });
   assert(!r.slash, '없음/미정 remains');
   assert(r.no, 'no company with cadetState no');
   await p.evaluate(t => location.hash = 'type-'+t, r.no.t); await p.waitForTimeout(200);
   const badge = await p.$eval(`#reg-body tr.row[data-co="${r.no.n}"] .jobs`, e => e.textContent);
   assert(badge.includes('실습생 없음'), r.no.n+' badge '+badge);
 })},
 {name:'legend-above', fn: () => withPage({hash:'#type-container'}, async p => {
   const r = await p.evaluate(() => [document.querySelector('#cap-legend').getBoundingClientRect().top, document.querySelector('#v-type .table-scroll').getBoundingClientRect().top]);
   assert(r[0] < r[1], 'legend '+r);
 })},
 {name:'th-help', fn: () => withPage({hash:'#type-container'}, async p => {
   const r = await p.evaluate(() => ['#th-cap','th[data-col="fleet"]','th[data-col="job"]'].map(s => document.querySelector(s).getAttribute('title') || ''));
   assert(r.every(x => x.length > 5), 'titles '+JSON.stringify(r));
 })}
];
