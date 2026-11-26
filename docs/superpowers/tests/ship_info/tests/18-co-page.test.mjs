import { withPage, assert } from '../lib.mjs';
const CMS = '#co-' + encodeURIComponent('씨엠에스마리타임(주)');
export default [
 {name:'co-firm-only', fn: () => withPage({hash:CMS}, async (p, errors) => {
   await p.waitForSelector('#co-ships tbody tr', {timeout:4000});
   assert((await p.$eval('#v-co h1', e => e.textContent)).includes('씨엠에스마리타임(주)'), 'h1');
   assert((await p.$$('#co-ships tbody tr')).length === 109, 'ships');
   await p.waitForSelector('#co-wage tbody tr.wrow', {timeout:4000});
   assert(await p.$('#v-co .ctag.r'), 'reg tag');
   assert(!(await p.$('#v-co [data-cmpco]')), 'compare button on firm-only');
   assert(await p.$('#v-co button[data-star="cos"]'), 'star');
   assert(await p.title() === '씨엠에스마리타임(주) | 선사록', await p.title());
   assert(errors.length === 0, errors.join('; '));
 })},
 {name:'co-ships-folded', fn: () => withPage({hash:CMS}, async p => {
   await p.waitForSelector('#co-ships tbody tr', {timeout:4000});
   const vis = () => p.$$eval('#co-ships tbody tr', trs => trs.filter(tr => !tr.hidden).length);
   assert(await vis() === 10, 'visible '+0);
   await p.click('#co-reg button[data-ships-more]');
   assert(await vis() === 109, 'after more');
   assert(await p.getAttribute('#co-reg button[data-ships-more]', 'aria-expanded') === 'true', 'aria');
 })},
 {name:'co-firm-only-paren', fn: () => withPage({hash:'#co-' + encodeURIComponent('선진해양(유)')}, async p => {
   await p.waitForSelector('#co-ships tbody tr', {timeout:4000});
   await p.evaluate(() => location.hash = '#home'); await p.waitForTimeout(300);
   await p.goBack(); await p.waitForSelector('#co-ships tbody tr', {timeout:4000});
   assert((await p.$eval('#v-co h1', e => e.textContent)).includes('선진해양(유)'), 'back');
 })},
 {name:'co-hmm-merged', fn: () => withPage({hash:'#co-HMM'}, async p => {
   await p.waitForSelector('#co-ships tbody tr', {timeout:4000});
   assert((await p.$$('#co-ships tbody tr')).length === 65, 'ships');
   assert((await p.$eval('#co-reg p', e => e.textContent)).includes('기준이 다릅니다'), 'first line');
   await p.waitForSelector('#co-wage tbody tr.wrow', {timeout:4000});
   const w = await p.$eval('#co-wage', e => e.textContent);
   assert(/외항선 · 컨테이너|해외취업상선 · 컨테이너/.test(w), w.slice(0, 200));
   await p.waitForSelector('#co-contact:not([hidden])', {timeout:4000});
   assert((await p.$eval('#co-contact', e => e.textContent)).includes('02-464-1245'), 'contact');
 })},
 {name:'co-managed', fn: () => withPage({hash:'#co-현대글로비스'}, async p => {
   await p.waitForSelector('#co-reg:not([hidden])', {timeout:4000});
   assert((await p.$eval('#co-reg', e => e.textContent)).includes('지마린서비스 이름으로 등록'), 'mgr');
   assert(!(await p.$('#co-ships')), 'ships table shown');
   await p.waitForSelector('#co-wage tbody tr.wrow', {timeout:4000});
   assert((await p.$eval('#co-wage', e => e.textContent)).includes('자동차'), 'wage pctc');
 })},
 {name:'firm-redirect', fn: () => withPage({hash:'#firm-에이치엠엠'}, async p => {
   await p.waitForSelector('#co-ships tbody tr', {timeout:4000});
   assert(await p.evaluate(() => location.hash) === '#co-HMM', await p.evaluate(() => location.hash));
   await p.evaluate(() => location.hash = '#firm-씨엠에스마리타임');
   await p.waitForTimeout(500);
   assert(await p.evaluate(() => decodeURIComponent(location.hash)) === '#co-씨엠에스마리타임(주)', await p.evaluate(() => location.hash));
 })},
 {name:'co-firm-load-fail', fn: async () => {
   await withPage({}, async (p, errors) => {
     await p.route('**/data/koswec.json', r => r.abort());
     await p.evaluate(() => location.hash = '#co-HMM'); await p.waitForTimeout(700);
     assert((await p.$eval('#v-co', e => e.textContent)).includes('개요'), 'overview');
     assert(await p.$eval('#co-reg', e => e.hidden), 'co-reg shown');
     await p.evaluate(h => location.hash = h, '#co-' + encodeURIComponent('씨엠에스마리타임(주)'));
     await p.waitForSelector('#v-co .load-fail button[data-retry]', {timeout:4000});
     assert(errors.length === 0, errors.join('; '));
   });
 }},
 {name:'co-missing', fn: () => withPage({hash:'#co-없는회사'}, async (p, errors) => {
   await p.waitForSelector('#v-co .cmp-empty', {timeout:4000});
   assert((await p.$eval('#v-co', e => e.textContent)).includes('찾는 선사가 없습니다'), 'text');
   assert(errors.length === 0, errors.join('; '));
 })},
 {name:'co-mobile-no-hscroll', fn: async () => {
   for (const theme of ['light','dark']) for (const hash of ['#co-HMM', CMS]) await withPage({hash, width:390, height:844, theme}, async p => {
     await p.waitForSelector('#co-ships tbody tr', {timeout:4000});
     const w = await p.evaluate(() => document.documentElement.scrollWidth);
     assert(w <= 390, theme+' '+hash+' scrollWidth '+w);
   });
 }},
];
