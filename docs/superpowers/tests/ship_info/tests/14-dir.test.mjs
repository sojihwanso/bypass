import { withPage, assert } from '../lib.mjs';
const ready = p => p.waitForSelector('#dir-list li.firm', {timeout:4000});
const rowsOf = p => p.$$eval('#dir-list li.firm', lis => lis.map(li => ({n: li.querySelector('.fn').textContent.trim(), ships: Number(li.dataset.ships), biz: li.querySelector('.fb').textContent.trim(), text: li.textContent})));
export default [
 {name:'dir-default', fn: () => withPage({hash:'#dir'}, async p => {
   await ready(p);
   let rows = await rowsOf(p);
   assert(rows.length === 50, 'rows '+rows.length);
   assert(rows[0].n === '포스에스엠(주)' && rows[0].ships === 128, JSON.stringify(rows[0]));
   assert(rows.every((r, i) => i === 0 || rows[i-1].ships >= r.ships), 'not sorted by ships');
   assert((await p.$eval('#v-dir h1', e => e.textContent)).includes('371곳'), 'head count');
   await p.click('#dir-more');
   rows = await rowsOf(p);
   assert(rows.length === 100, 'after more '+rows.length);
 })},
 {name:'dir-type-link-filter', fn: () => withPage({hash:'#dir?type=LNG'}, async p => {
   await ready(p);
   const rows = await rowsOf(p);
   assert(rows.length > 0 && rows.length <= 26, 'rows '+rows.length);
   const ok = await p.evaluate(async names => { const k = await loadData('koswec'); const li = k.typeNames.indexOf('LNG');
     return names.every(n => k.firms.find(f => f.n === n).ships.some(s => s[3] === li)); }, rows.map(r => r.n));
   assert(ok, 'firm without LNG');
 })},
 {name:'dir-cement-link', fn: () => withPage({hash:'#dir?type=잡화,기타&biz=내항상선'}, async p => {
   await ready(p);
   const rows = await rowsOf(p);
   assert(rows.length > 0 && rows.every(r => r.biz === '내항상선'), JSON.stringify(rows.slice(0,3)));
 })},
 {name:'dir-ship-search', fn: () => withPage({hash:'#dir'}, async p => {
   await ready(p);
   await p.fill('#dir-q', '프리즘 다이버시티');
   await p.waitForTimeout(400);
   const rows = await rowsOf(p);
   assert(rows.length === 1 && rows[0].n === '케이엘엔지(주)', JSON.stringify(rows));
   assert(rows[0].text.includes('선박: 프리즘 다이버시티'), rows[0].text);
   assert((await p.evaluate(() => location.hash)).includes('q='), 'q not in url');
 })},
 {name:'dir-bad-query', fn: () => withPage({hash:'#dir?type=없는선종&r=%E0%A4&biz=zz&sort=zz'}, async (p, errors) => {
   await ready(p);
   assert((await rowsOf(p)).length === 50, 'filters not ignored');
   assert(errors.length === 0, errors.join('; '));
 })},
 {name:'dir-empty-reset', fn: () => withPage({hash:'#dir?q=절대없는이름zz'}, async p => {
   await p.waitForSelector('#dir-empty', {timeout:4000});
   assert((await p.$eval('#dir-empty', e => e.textContent)).includes('조건에 맞는 업체가 없습니다'), 'empty text');
   await p.click('#dir-empty button');
   await ready(p);
   assert((await rowsOf(p)).length === 50, 'reset');
 })},
 {name:'firm-hmm', fn: () => withPage({hash:'#firm-에이치엠엠'}, async p => {
   await p.waitForSelector('#firm-ships tbody tr', {timeout:4000});
   assert((await p.$$('#firm-ships tbody tr')).length === 65, 'ship rows');
   assert(await p.$eval('#v-firm a:text-is("선사록 선사 정보 보기")', a => a.getAttribute('href')) === '#co-HMM', 'co link');
   assert(!(await p.$eval('#v-firm', e => e.textContent)).includes('대표'), '대표 shown');
   assert(await p.title() === '에이치엠엠(주) | 선사록', await p.title());
 })},
 {name:'firm-missing', fn: () => withPage({hash:'#firm-없는회사'}, async (p, errors) => {
   await p.waitForSelector('#v-firm .cmp-empty', {timeout:4000});
   assert((await p.$eval('#v-firm', e => e.textContent)).includes('찾는 업체가 없습니다'), 'text');
   assert(await p.$('#v-firm a[href="#dir"]'), 'dir link');
   assert(errors.length === 0, errors.join('; '));
 })},
 {name:'firm-no-mobile', fn: () => withPage({hash:'#firm-소스코리아'}, async p => {
   await p.waitForSelector('#firm-ships tbody tr', {timeout:4000});
   assert(!/01[016789]-?\d{3,4}-?\d{4}/.test(await p.$eval('#v-firm', e => e.textContent)), 'mobile shown');
 })},
 {name:'dir-mobile-filters', fn: () => withPage({hash:'#dir', width:390, height:844}, async p => {
   await ready(p);
   assert(await p.isVisible('#dir-q'), 'search hidden on mobile');
   assert(!(await p.isVisible('#dir-biz')), 'filters should start folded');
   await p.click('#dir-ftoggle');
   assert(await p.isVisible('#dir-biz'), 'filters not shown after toggle');
   assert(await p.getAttribute('#dir-ftoggle', 'aria-expanded') === 'true', 'aria-expanded');
 })},
 {name:'dir-mobile-no-hscroll', fn: async () => {
   for (const theme of ['light','dark']) for (const hash of ['#dir', '#firm-에이치엠엠']) await withPage({hash, width:390, height:844, theme}, async p => {
     await p.waitForSelector(hash === '#dir' ? '#dir-list li.firm' : '#firm-ships tbody tr', {timeout:4000});
     const w = await p.evaluate(() => document.documentElement.scrollWidth);
     assert(w <= 390, theme+' '+hash+' scrollWidth '+w);
   });
 }},
];
