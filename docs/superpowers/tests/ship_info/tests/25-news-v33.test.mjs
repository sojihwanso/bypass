import { withPage, assert } from '../lib.mjs';
const FN = '**/functions/v1/ship-news*';
const A = {d:'2026-11-26', c:'사고', t:"이란군 '호르무즈 해협서 LNG 운반선·유조선 기뢰 충돌로 화재'", s:'연합뉴스', u:'https://ex.com/a', p:''};
const B = {d:'2026-11-26', c:'사고', t:'이란군 "호르무즈서 LNG선·유조선 기뢰 충돌 화재"', s:'뉴시스', u:'https://ex.com/b', p:''};
const C = {d:'2026-11-25', c:'기업 소식', t:'HMM, 최원혁 대표이사 재선임', s:'해양한국', u:'https://ex.com/c', p:''};
const D = {d:'2026-11-26', c:'기업 소식', t:'HMM, 최원혁 대표이사 재선임..2028년 3월까지 임기 연장', s:'동아일보', u:'https://ex.com/d', p:''};
const E = {d:'2026-11-26', c:'항만', t:'부산항 신항 컨테이너 물동량 사상 최대', s:'부산일보', u:'https://ex.com/e', p:''};
const F2 = {d:'2026-11-26', c:'항만', t:'부산항만공사 사장 신년 기자회견', s:'국제신문', u:'https://ex.com/f', p:''};
const feed = items => JSON.stringify({updated: new Date().toISOString(), items});
async function boot(p, hash, items, seed){
  await p.route(FN, r => r.fulfill({status:200, contentType:'application/json', body: feed(items)}));
  await p.evaluate(([h, s]) => {
    localStorage.setItem('sasarok-news-cache-v2', 'null');
    localStorage.setItem('sasarok-news-visit-v1', s ? String(s) : '');
    location.hash = h; location.reload();
  }, [hash, seed || 0]);
  await p.waitForFunction(() => typeof NEWS_ALL !== 'undefined' && NEWS_ALL.some(n => n.u && n.u.startsWith('https://ex.com/')), null, {timeout:8000});
  await p.waitForTimeout(200);
}
export default [
 {name:'news-group-same-story', fn: () => withPage({}, async p => {
   await boot(p, '#news', [A, B, C, D, E, F2]);
   const groups = await p.$$eval('#news-full > li', ls => ls.map(l => l.textContent));
   const hormuz = groups.filter(g => g.includes('기뢰'));
   assert(hormuz.length === 1, 'hormuz groups '+hormuz.length);
   assert(hormuz[0].includes('같은 소식 1건 더'), hormuz[0]);
   assert(groups.filter(g => g.includes('최원혁')).length === 1, 'hmm not grouped');
   assert(groups.some(g => g.includes('신항 컨테이너 물동량')) && groups.some(g => g.includes('신년 기자회견')), 'unrelated grouped');
 })},
 {name:'news-group-expand', fn: () => withPage({}, async p => {
   await boot(p, '#news', [A, B]);
   const btn = await p.$('#news-full button[data-grp]');
   assert(btn && await btn.getAttribute('aria-expanded') === 'false', 'toggle');
   await btn.click();
   const t = await p.$eval('#news-full', e => e.textContent);
   assert(t.includes('뉴시스') && t.includes('연합뉴스'), 'other source not shown');
   assert(await btn.getAttribute('aria-expanded') === 'true', 'aria');
 })},
 {name:'news-new-marks', fn: () => withPage({}, async p => {
   await boot(p, '#home', [E], Date.now() - 86400000);
   const head = await p.$eval('#v-home .news .card-h', e => e.textContent);
   assert(head.includes('새 소식 1건'), head);
   await p.evaluate(() => location.hash = '#news'); await p.waitForTimeout(300);
   assert((await p.$$('#news-full .new')).length === 1, 'new mark');
 })},
 {name:'news-first-visit-no-marks', fn: () => withPage({}, async p => {
   await boot(p, '#home', [E], 0);
   const head = await p.$eval('#v-home .news .card-h', e => e.textContent);
   assert(!head.includes('새 소식'), head);
 })},
 {name:'news-visit-updates-keeps-marks', fn: () => withPage({}, async p => {
   await boot(p, '#news', [E], Date.now() - 86400000);
   const v = await p.evaluate(() => Number(localStorage.getItem('sasarok-news-visit-v1')));
   assert(Date.now() - v < 60000, 'visit not updated');
   assert((await p.$$('#news-full .new')).length === 1, 'marks should stay during this visit');
 })},
 {name:'news-group-not-generic-words', fn: () => withPage({}, async p => {
   const G = {d:'2026-11-26', c:'기업 소식', t:'인사/동방그룹 정기 임원인사 실시 (11/26)', s:'한국해운신문', u:'https://ex.com/g', p:''};
   const H = {d:'2026-11-26', c:'조선', t:'삼성重, 2027년도 정기 임원인사 실시', s:'쉬핑뉴스넷', u:'https://ex.com/h', p:''};
   const I = {d:'2026-11-26', c:'선원과 채용', t:"한국해대, 美 해사청과 '한미 해양 인재 양성' 협력 물꼬", s:'해양한국', u:'https://ex.com/i', p:''};
   const J = {d:'2026-11-26', c:'선원과 채용', t:'진도해양안전관-목포대, 해양안전인력 양성 협력', s:'한국해운신문', u:'https://ex.com/j', p:''};
   await boot(p, '#news', [G, H, I, J]);
   const groups = await p.$$eval('#news-full > li', ls => ls.map(l => l.textContent));
   assert(groups.filter(g => g.includes('임원인사')).length === 2, 'executive news grouped');
   assert(groups.filter(g => g.includes('양성')).length === 2, 'training news grouped');
 })},
];
