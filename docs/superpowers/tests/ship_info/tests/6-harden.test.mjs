import { withPage, assert } from '../lib.mjs';
const T = '#type-container';
const count = p => p.$eval('#cmp-n', e => e.textContent.trim());
export default [
 {name:'cmp-persist', fn: () => withPage({hash:T}, async p => {
   const b = await p.$$('#reg-body input[data-pickco]'); await b[0].check(); await b[1].check();
   await p.reload(); await p.waitForTimeout(250);
   assert(await count(p) === '선사 2 / 선종 0', 'after reload '+(await count(p)));
 })},
 {name:'cmp-no-storage', fn: () => withPage({hash:T, init:{fn: () => { Storage.prototype.setItem = function(){ throw new Error('blocked'); }; }}}, async (p, errors) => {
   const b = await p.$$('#reg-body input[data-pickco]'); await b[0].check();
   assert(await count(p) === '선사 1 / 선종 0', 'count '+(await count(p)));
   assert(!errors.length, 'errors '+errors.join('|'));
 })},
 {name:'cmp-stale-name', fn: () => withPage({hash:'#compare', init:{fn: () => localStorage.setItem('sasarok-cmp-v1', JSON.stringify({co:['없는회사','HMM'], ty:['zzz']}))}}, async (p, errors) => {
   assert(await count(p) === '선사 1 / 선종 0', 'count '+(await count(p)));
   assert(await p.$$eval('#cmp-table th a', e => e.length) === 1, 'compare columns');
   assert(!errors.length, 'errors '+errors.join('|'));
 })},
 {name:'hash-roundtrip', fn: () => withPage({hash:T+'?kind=owner&cadet=1'}, async p => {
   assert(await p.$eval('#f-kind [data-v=owner]', b => b.getAttribute('aria-pressed')) === 'true', 'kind');
   assert(await p.$eval('#f-cadet', c => c.checked), 'cadet');
   const rows = await p.$$eval('#reg-body tr.row', e => e.length);
   const txt = await p.$eval('#r-count', e => e.textContent);
   assert(txt.endsWith(rows+'곳 표시'), 'count '+txt+' rows '+rows);
   await p.click('#f-routes .chip[data-r="미주"]');
   const h = await p.evaluate(() => decodeURIComponent(location.hash));
   assert(h.includes('r=미주') && h.includes('kind=owner'), 'hash '+h);
 })},
 {name:'keep-filters-across-types', fn: () => withPage({hash:T}, async p => {
   await p.check('#f-cadet'); await p.click('#f-routes .chip[data-r="미주"]');
   await p.evaluate(() => location.hash = 'type-lng'); await p.waitForTimeout(200);
   assert(await p.$eval('#f-cadet', c => c.checked), 'cadet lost');
   assert(await p.$$eval('#f-routes .chip[aria-pressed="true"]', e => e.length) === 0, 'routes kept');
 })},
 {name:'sort-name', fn: () => withPage({hash:T}, async p => {
   await p.click('.th-sort[data-sort="name"]');
   const names = await p.$$eval('#reg-body tr.row', e => e.map(r => r.dataset.co));
   const sorted = names.slice().sort((a,b) => a.localeCompare(b,'ko'));
   assert(JSON.stringify(names) === JSON.stringify(sorted), 'not sorted '+names.slice(0,4));
   assert(await p.$eval('.th-sort[data-sort="name"]', b => b.closest('th').getAttribute('aria-sort')) === 'ascending', 'aria-sort');
 })},
 {name:'pick-all', fn: () => withPage({hash:T}, async p => {
   await p.click('#f-pickall');
   assert(await count(p) === '선사 5 / 선종 0', 'count '+(await count(p)));
 })},
 {name:'empty-culprit', fn: () => withPage({hash:T+'?kind=owner&r=호주'}, async p => {
   const t = await p.$eval('#reg-body', e => e.textContent);
   assert(/곳이 보입니다/.test(t) && /(항로|회사 구분)/.test(t), 'text '+t);
 })},
 {name:'crumb-back', fn: () => withPage({hash:T+'?cadet=1'}, async p => {
   await p.click('#reg-body tr.row .cname a'); await p.waitForTimeout(200);
   const link = await p.$('#v-co .crumb a[data-back]');
   assert(link, 'no back crumb');
   assert((await link.textContent()).includes('컨테이너선'), 'crumb text');
   await link.click(); await p.waitForTimeout(200);
   assert(await p.evaluate(() => location.hash) === T+'?cadet=1', 'hash '+(await p.evaluate(() => location.hash)));
 })},
 {name:'cmp-live', fn: () => withPage({hash:T}, async p => {
   await p.check('#reg-body input[data-pickco="HMM"]');
   const t = await p.$eval('#cmp-live', e => e.textContent);
   assert(t.includes('HMM') && t.includes('비교에 담음'), 'live '+t);
 })},
 {name:'board-disabled', fn: () => withPage({hash:'#board'}, async p => {
   const r = await p.$eval('#p-send', b => [b.disabled, b.textContent]);
   assert(r[0] === true && r[1].includes('서버 연결 전'), 'send '+r);
 })}
];
