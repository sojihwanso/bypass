import { withPage, assert } from '../lib.mjs';
const FN = '**/functions/v1/ship-news*';
const ITEMS = [
  {d:'2026-11-26', c:'조선', t:'조선소 LNG선 수주 잇따라', s:'이데일리', u:'https://news.google.com/rss/articles/T1', p:''},
  {d:'2026-11-26', c:'항만', t:'부산항 물동량 사상 최대', s:'쉬핑뉴스넷', u:'https://www.shippingnewsnet.com/news/articleView.html?idxno=9', p:'요약 글'},
];
const body = items => JSON.stringify({updated:'2026-11-26T03:00:00.000Z', items});
async function open(p, hash, handler){
  let n = 0;
  await p.route(FN, r => { n++; return handler(r); });
  await p.evaluate(h => { location.hash = h; location.reload(); }, hash);
  await p.waitForTimeout(900);
  return () => n;
}
export default [
 {name:'feed-merges', fn: () => withPage({}, async (p, errors) => {
   await open(p, '#news', r => r.fulfill({status:200, contentType:'application/json', body: body(ITEMS)}));
   const t = await p.$eval('#v-news', e => e.textContent);
   assert(t.includes('조선소 LNG선 수주 잇따라') && t.includes('부산항 물동량 사상 최대'), 'items missing');
   assert(t.includes('자동 수집'), 'auto tag');
   assert(await p.$('#news-cats [data-cat="조선"]') && await p.$('#news-cats [data-cat="해외 해운사"]'), 'new cats');
   assert((await p.$eval('#feed-state', e => e.textContent)).includes('하루 한 번 자동으로'), 'status');
   assert(errors.length === 0, errors.join('; '));
 })},
 {name:'feed-cache-skips-fetch', fn: () => withPage({init:{fn: items => { try{ localStorage.setItem('sasarok-news-cache-v2', JSON.stringify({at: Date.now(), updated:'2026-11-26T03:00:00.000Z', items})); }catch(e){} }, arg: ITEMS}}, async p => {
   const count = await open(p, '#news', r => r.fulfill({status:200, contentType:'application/json', body: body([])}));
   assert(count() === 0, 'fetched '+count());
   assert((await p.$eval('#v-news', e => e.textContent)).includes('조선소 LNG선 수주 잇따라'), 'cached item');
 })},
 {name:'feed-cache-accumulates', fn: () => withPage({init:{fn: items => { try{ if (!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1'); localStorage.setItem('sasarok-news-cache-v2', JSON.stringify({at: 1, updated:'2026-11-25T03:00:00.000Z', items:[items[0]]})); } }catch(e){} }, arg: ITEMS}}, async p => {
   let url = '';
   await open(p, '#news', r => { url = r.request().url(); return r.fulfill({status:200, contentType:'application/json', body: body([ITEMS[1]])}); });
   assert(url.includes('since=2026-11-25T03'), 'since missing: '+url);
   const t = await p.$eval('#v-news', e => e.textContent);
   assert(t.includes('조선소 LNG선 수주 잇따라') && t.includes('부산항 물동량 사상 최대'), 'both');
   const c = await p.evaluate(() => JSON.parse(localStorage.getItem('sasarok-news-cache-v2')));
   assert(c.items.length === 2 && c.updated === '2026-11-26T03:00:00.000Z', JSON.stringify(c).slice(0, 200));
 })},
 {name:'feed-bad-shape', fn: () => withPage({}, async (p, errors) => {
   await open(p, '#news', r => r.fulfill({status:200, contentType:'application/json', body: JSON.stringify({items:'x'})}));
   const n = await p.$$eval('#news-full li', ls => ls.length).catch(() => -1);
   await open(p, '#news', r => r.fulfill({status:200, contentType:'application/json', body: JSON.stringify({items:[{d:'bad', t:'', u:'javascript:alert(1)'}, null, 5]})}));
   assert(errors.length === 0, errors.join('; '));
   assert(!(await p.$('#v-news a[href^="javascript:"]')), 'bad link rendered');
   assert((await p.$eval('#v-news', e => e.textContent)).includes('한앤컴퍼니'), 'curated items gone '+n);
 })},
 {name:'feed-fail-status', fn: () => withPage({}, async p => {
   await open(p, '#news', r => r.fulfill({status:500, body:''}));
   assert((await p.$eval('#feed-state', e => e.textContent)).includes('불러오지 못해'), 'fail text');
   await open(p, '#news', r => r.fulfill({status:404, body:''}));
   assert((await p.$eval('#feed-state', e => e.textContent)).includes('준비하고 있습니다'), '404 text');
 })},
 {name:'feed-since-offset-format', fn: () => withPage({init:{fn: () => { try{ if (!sessionStorage.getItem('s2')){ sessionStorage.setItem('s2','1'); localStorage.setItem('sasarok-news-cache-v2', JSON.stringify({at: 1, updated:'2026-11-25T03:00:00.482+00:00', items:[]})); } }catch(e){} }}}, async p => {
   let url = '';
   await open(p, '#news', r => { url = r.request().url(); return r.fulfill({status:200, contentType:'application/json', body: body([])}); });
   assert(url.includes('since='), 'since missing: '+url);
 })},
];
