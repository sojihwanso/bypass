import { withPage, assert } from '../lib.mjs';
export default [
 {name:'dir-chip-keeps-firmless-co', fn: () => withPage({hash:'#dir?type=컨테이너'}, async p => {
   await p.waitForSelector('#dir-list li.firm', {timeout:4000});
   const names = await p.$$eval('#dir-list li.firm .fn', as => as.map(a => a.textContent.trim()));
   for (const n of ['고려해운', '장금상선', '팬오션']) assert(names.includes(n), n+' missing');
 })},
 {name:'co-fail-does-not-overwrite', fn: () => withPage({}, async p => {
   await p.route('**/data/koswec.json', async r => { await new Promise(x => setTimeout(x, 1200)); await r.fulfill({status:500, body:''}); });
   await p.evaluate(h => location.hash = h, '#co-' + encodeURIComponent('씨엠에스마리타임(주)'));
   await p.waitForTimeout(200);
   await p.evaluate(() => location.hash = '#co-HMM');
   await p.waitForTimeout(1700);
   assert((await p.$eval('#v-co h1', e => e.textContent)).includes('HMM'), 'HMM page overwritten');
   assert(!(await p.$('#v-co .load-fail')), 'fail box shown on HMM');
 })},
 {name:'reg-group-search-open-can-close', fn: () => withPage({hash:'#type-bulk'}, async p => {
   await p.waitForSelector('#reg-group button[aria-expanded]', {timeout:4000});
   const n = await p.evaluate(() => regOnlyFor('bulk')[0].n);
   await p.evaluate(h => location.hash = h, '#type-bulk?q=' + encodeURIComponent(n.slice(0, 4)));
   await p.waitForSelector('#reg-list tbody tr', {timeout:4000});
   await p.click('#reg-group .rg-btn'); await p.waitForTimeout(200);
   assert(await p.getAttribute('#reg-group .rg-btn', 'aria-expanded') === 'false', 'did not close');
   assert(!(await p.isVisible('#reg-list tbody tr')), 'list still visible');
 })},
 {name:'firm-redirect-latest-wins', fn: () => withPage({}, async p => {
   await p.route('**/data/koswec.json', async r => { await new Promise(x => setTimeout(x, 800)); await r.continue(); });
   await p.evaluate(() => location.hash = '#firm-범진상운');
   await p.waitForTimeout(100);
   await p.evaluate(() => location.hash = '#firm-씨엠에스마리타임');
   await p.waitForTimeout(1500);
   assert(await p.evaluate(() => decodeURIComponent(location.hash)) === '#co-씨엠에스마리타임(주)', await p.evaluate(() => decodeURIComponent(location.hash)));
 })},
 {name:'co-bad-encoding', fn: () => withPage({hash:'#co-%E0%A4'}, async (p, errors) => {
   await p.waitForSelector('#v-co .cmp-empty', {timeout:4000});
   assert((await p.$eval('#v-co', e => e.textContent)).includes('찾는 선사가 없습니다'), 'text');
   assert(errors.length === 0, errors.join('; '));
 })},
 {name:'dir-title', fn: () => withPage({hash:'#dir'}, async p => {
   assert(await p.title() === '선사 목록 | 선사록', await p.title());
 })},
];
