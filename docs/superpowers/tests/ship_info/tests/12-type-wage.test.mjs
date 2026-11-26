import { withPage, assert } from '../lib.mjs';
const ready = p => p.waitForSelector('#type-wage tbody tr', {timeout:4000});
const rowsOf = p => p.$$eval('#type-wage tbody tr.wrow', trs => trs.map(tr => [...tr.cells].map(td => td.textContent.trim())));
export default [
 {name:'type-wage-lng', fn: () => withPage({hash:'#type-lng'}, async p => {
   await ready(p);
   const h = await p.$eval('#type-wage h2', e => e.textContent);
   assert(h.includes('LNG선 (LNG)'), 'title '+h);
   const rows = await rowsOf(p);
   const oc = rows.find(r => r[0].startsWith('외항선'));
   assert(oc && oc[1] === '1,002', 'ocean total '+JSON.stringify(oc));
   assert(await p.$('#type-wage a[href="#dir?type=LNG"]'), 'dir link');
 })},
 {name:'type-wage-product-two-stats', fn: () => withPage({hash:'#type-product'}, async p => {
   await ready(p);
   const rows = (await rowsOf(p)).filter(r => r[0].startsWith('외항선'));
   assert(rows.some(r => r[0].includes('유조')) && rows.some(r => r[0].includes('케미컬')), JSON.stringify(rows));
   assert((await p.$eval('#type-wage', e => e.textContent)).includes('원유운반선과 함께'), 'shared note');
 })},
 {name:'type-wage-cement-coastal-only', fn: () => withPage({hash:'#type-cement'}, async p => {
   await ready(p);
   const rows = await rowsOf(p);
   assert(rows.length > 0 && rows.every(r => r[0].startsWith('내항선')), JSON.stringify(rows));
   const href = await p.$eval('#type-wage a[href^="#dir"]', a => a.getAttribute('href'));
   assert(href.includes('biz='), href);
 })},
 {name:'type-wage-dash-not-zero', fn: () => withPage({hash:'#type-lng'}, async p => {
   await ready(p);
   const tr = await p.$('#type-wage tbody tr.wrow:has-text("내항선")');
   assert(tr, 'no coastal row');
   assert((await tr.textContent()).includes('표본 적음'), 'small sample');
   await (await tr.$('button')).click();
   const t = await p.$eval('#type-wage', e => e.textContent);
   assert(!/NaN|undefined|null/.test(t), 'bad text');
   assert(t.includes('-'), 'dash');
 })},
 {name:'type-wage-expand', fn: () => withPage({hash:'#type-lng'}, async p => {
   await ready(p);
   const btn = await p.$('#type-wage tbody tr.wrow:has-text("외항선") button');
   await btn.click();
   assert(await btn.getAttribute('aria-expanded') === 'true', 'aria-expanded');
   const det = await p.$$eval('#type-wage tr.wdet:not([hidden]) tbody tr', trs => trs.map(tr => [...tr.cells].map(td => td.textContent.trim())));
   assert(det.length === 21, 'rows '+det.length);
   const want = await p.evaluate(async () => (await loadData('wage')).biz.ocean.types.LNG.rows[2][1]);
   const master = det.find(r => r[0] === '선장');
   assert(master && master[2] === want.toLocaleString('ko-KR'), JSON.stringify(master)+' vs '+want);
 })},
 {name:'type-wage-above-pc', fn: () => withPage({hash:'#type-lng'}, async p => {
   await ready(p);
   const r = await p.evaluate(() => [document.querySelector('#type-wage').getBoundingClientRect().top, document.querySelector('#type-pc').getBoundingClientRect().top]);
   assert(r[0] < r[1], JSON.stringify(r));
 })},
];
