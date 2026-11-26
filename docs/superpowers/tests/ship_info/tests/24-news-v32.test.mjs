import { withPage, assert } from '../lib.mjs';
const FN = '**/functions/v1/ship-news*';
const ITEMS = [
  {d:'2026-11-26', c:'기업 소식', t:'HMM, 최원혁 대표이사 재선임', s:'해양한국', u:'https://ex.com/h1', p:''},
  {d:'2026-11-25', c:'선대와 발주', t:'씨엠에스마리타임, 탱커 2척 관리 계약', s:'쉬핑뉴스넷', u:'https://ex.com/c1', p:''},
  {d:'2026-11-26', c:'실적과 시황', t:'머스크 3분기 실적 개선', s:'연합뉴스', u:'https://ex.com/m1', p:''},
  {d:'2026-11-26', c:'기업 소식', t:'세계 선박 시장 동향 - 뉴스 및 통계', s:'IndexBox', u:'https://news.google.com/rss/articles/IB1', p:''},
  {d:'2026-11-26', c:'기업 소식', t:'선박 여행 후기 : 네이버 블로그', s:'Naver Blog', u:'https://news.google.com/rss/articles/NB1', p:''},
  {d:'2026-11-26', c:'항만', t:'부산항 물동량 늘어 - 뉴스 및 통계', s:'해사신문', u:'https://ex.com/p1', p:''},
];
async function boot(p, hash){
  await p.route(FN, r => r.fulfill({status:200, contentType:'application/json', body: JSON.stringify({updated:'2026-11-26T03:00:00.000Z', items: ITEMS})}));
  await p.evaluate(h => { localStorage.removeItem('sasarok-news-cache-v2'); location.hash = h; location.reload(); }, hash);
  await p.waitForTimeout(1200);
}
export default [
 {name:'co-related-news', fn: () => withPage({}, async p => {
   await boot(p, '#co-HMM');
   await p.waitForSelector('#co-news li', {timeout:4000});
   const t = await p.$eval('#co-news', e => e.textContent);
   assert(t.includes('HMM, 최원혁 대표이사 재선임'), t.slice(0, 200));
   assert(!t.includes('머스크 3분기'), 'unrelated news');
   assert((await p.$$('#co-news li')).length <= 5, 'more than 5');
 })},
 {name:'firm-only-related-news', fn: () => withPage({}, async p => {
   await boot(p, '#co-' + encodeURIComponent('씨엠에스마리타임(주)'));
   await p.waitForSelector('#co-news li', {timeout:4000});
   assert((await p.$eval('#co-news', e => e.textContent)).includes('탱커 2척 관리 계약'), 'firm news');
 })},
 {name:'co-news-more-link', fn: () => withPage({}, async p => {
   await boot(p, '#co-HMM');
   await p.waitForSelector('#co-news a[data-news-q]', {timeout:4000});
   await p.click('#co-news a[data-news-q]'); await p.waitForTimeout(400);
   assert((await p.evaluate(() => location.hash)).startsWith('#news'), 'not news');
   assert((await p.$eval('#nf-q', e => e.textContent)).includes('HMM'), 'query not set');
 })},
 {name:'news-noise-filtered', fn: () => withPage({}, async p => {
   await boot(p, '#news');
   const t = await p.$eval('#news-full', e => e.textContent);
   assert(!t.includes('세계 선박 시장 동향') && !t.includes('네이버 블로그'), 'noise shown');
   assert(t.includes('부산항 물동량 늘어') && !t.includes('뉴스 및 통계'), 'suffix not cleaned');
 })},
 {name:'news-second-tag-foreign', fn: () => withPage({}, async p => {
   await boot(p, '#news');
   await p.click('#news-cats [data-cat="해외 해운사"]'); await p.waitForTimeout(200);
   const t = await p.$eval('#news-full', e => e.textContent);
   assert(t.includes('머스크 3분기 실적 개선'), 'not in foreign tab');
   await p.click('#news-cats [data-cat="실적과 시황"]'); await p.waitForTimeout(200);
   assert((await p.$eval('#news-full', e => e.textContent)).includes('머스크 3분기 실적 개선'), 'not in primary tab');
 })},
];
