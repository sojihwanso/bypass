import { withPage, assert } from '../lib.mjs';
const FN = '**/functions/v1/ship-news*';
export default [
 {name:'search-no-result-honest', fn: () => withPage({}, async p => {
   await p.evaluate(() => uniReady());
   await p.fill('#q-all', 'zzzz없는회사'); await p.waitForTimeout(300);
   const first = await p.$eval('#sx-panel > *', e => e.textContent);
   assert(first.includes('일치하는 회사') && first.includes('없습니다'), 'first block: '+first);
   assert(await p.$('#sx-panel a[href^="#dir?q="]'), 'no directory link');
   const secs = await p.$$eval('#sx-panel .sx-sec', s => s.map(x => x.textContent));
   assert(!secs.includes('도움말') || secs.includes('관련 도움말'), JSON.stringify(secs));
 })},
 {name:'home-feed-status-ok', fn: () => withPage({}, async p => {
   await p.route(FN, r => r.fulfill({status:200, contentType:'application/json', body: JSON.stringify({updated:'2026-11-26T12:00:00.000Z', items:[]})}));
   await p.evaluate(() => { localStorage.setItem('sasarok-news-cache-v2', 'null'); location.reload(); });
   await p.waitForFunction(() => document.querySelector('#home-feed') && document.querySelector('#home-feed').textContent.includes('갱신'), null, {timeout:5000});
 })},
 {name:'home-feed-status-fail', fn: () => withPage({}, async p => {
   await p.route(FN, r => r.fulfill({status:500, body:''}));
   await p.evaluate(() => { localStorage.setItem('sasarok-news-cache-v2', 'null'); location.reload(); });
   await p.waitForFunction(() => document.querySelector('#home-feed') && document.querySelector('#home-feed').textContent.includes('불러오지 못'), null, {timeout:5000});
 })},
 {name:'news-empty-cats-disabled', fn: () => withPage({hash:'#news'}, async p => {
   await p.waitForSelector('#news-cats button');
   const r = await p.$$eval('#news-cats button', bs => bs.map(b => ({n: b.querySelector('small').textContent, d: b.disabled})));
   assert(r.some(x => x.n === '0'), 'no zero chip to test');
   assert(r.every(x => x.n !== '0' || x.d), JSON.stringify(r));
 })},
];
