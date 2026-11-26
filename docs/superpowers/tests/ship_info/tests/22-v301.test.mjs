import { withPage, assert } from '../lib.mjs';
const CMS = '#co-' + encodeURIComponent('씨엠에스마리타임(주)');
export default [
 {name:'star-keeps-type-wage-open', fn: () => withPage({hash:'#type-lng'}, async p => {
   await p.waitForSelector('#type-wage tbody tr.wrow', {timeout:4000});
   const b = await p.$('#type-wage tbody tr.wrow button'); await b.click();
   await p.click('#type-head button[data-star]'); await p.waitForTimeout(300);
   assert(await p.getAttribute('#type-wage tbody tr.wrow button', 'aria-expanded') === 'true', 'wage row collapsed');
   assert(await p.getAttribute('#type-head button[data-star]', 'aria-pressed') === 'true', 'star not on');
 })},
 {name:'star-keeps-ships-open', fn: () => withPage({hash:CMS}, async p => {
   await p.waitForSelector('#co-reg button[data-ships-more]', {timeout:4000});
   await p.click('#co-reg button[data-ships-more]');
   await p.click('#v-co button[data-star]'); await p.waitForTimeout(300);
   const vis = await p.$$eval('#co-ships tbody tr', trs => trs.filter(tr => !tr.hidden).length);
   assert(vis === 109, 'visible '+vis);
 })},
 {name:'crumb-from-reg-group', fn: () => withPage({hash:'#type-bulk?more=1'}, async p => {
   await p.waitForSelector('#reg-list tbody tr a', {timeout:4000});
   await p.click('#reg-list tbody tr a');
   await p.waitForSelector('#co-ships', {timeout:4000});
   const href = await p.$eval('#v-co .crumb a[data-back]', a => a.getAttribute('href'));
   assert(href.startsWith('#type-bulk') && href.includes('more=1'), href);
 })},
 {name:'fav-shown-when-offline', fn: () => withPage({init:{fn: () => { try{ localStorage.setItem('sasarok-fav-v1', JSON.stringify({types:[], cos:['씨엠에스마리타임(주)']})); }catch(e){} }}}, async p => {
   await p.route('**/data/koswec.json', r => r.abort());
   await p.evaluate(() => location.reload()); await p.waitForTimeout(800);
   assert((await p.$eval('#fav-body', e => e.textContent)).includes('씨엠에스마리타임(주)'), 'fav hidden');
 })},
 {name:'search-no-refetch-storm', fn: () => withPage({}, async p => {
   let n = 0;
   await p.route('**/data/koswec.json', r => { n++; r.abort(); });
   await p.click('#q-all');
   for (const ch of ['흥','아','마','린']) { await p.keyboard.type(ch); await p.waitForTimeout(150); }
   assert(n <= 1, 'fetched '+n);
 })},
 {name:'retry-moves-focus', fn: () => withPage({}, async p => {
   await p.route('**/data/wage.json', r => r.abort());
   await p.evaluate(() => location.hash = '#wage');
   await p.waitForSelector('#v-wage button[data-retry]', {timeout:4000});
   await p.unroute('**/data/wage.json');
   await p.focus('#v-wage button[data-retry]'); await p.keyboard.press('Enter');
   await p.waitForSelector('#wage-main', {timeout:4000});
   assert(await p.evaluate(() => document.getElementById('v-wage').contains(document.activeElement)), 'focus lost: '+await p.evaluate(() => document.activeElement.tagName));
 })},
 {name:'markers-not-read', fn: () => withPage({hash:'#type-cement'}, async p => {
   await p.waitForSelector('#reg-group .rg-btn', {timeout:4000});
   const c = await p.$eval('#reg-group .rg-btn', e => getComputedStyle(e, '::before').content);
   assert(c.includes('/'), 'marker has no alt text: '+c);
   const ok = await p.$eval('#reg-group .rg-btn', b => !!document.getElementById(b.getAttribute('aria-controls')));
   assert(ok, 'aria-controls target missing');
 })},
 {name:'home-type-counts', fn: () => withPage({}, async p => {
   const r = await p.evaluate(async () => { await uniReady();
     return {consts: TYPES.every(t => REG_ONLY_COUNT[t.id] === regOnlyFor(t.id).length) && UNI_TOTAL === UNI.length,
       cem: document.querySelector('#type-list li[data-type="cement"] .tc .mono').textContent,
       want: companiesOf('cement').length + regOnlyFor('cement').length,
       small: document.querySelector('#type-list li[data-type="cement"] .tc small').textContent,
       lead: document.querySelector('#hero-lead').textContent }; });
   assert(r.consts, 'REG_ONLY_COUNT/UNI_TOTAL out of date with koswec.json');
   assert(Number(r.cem) === r.want, r.cem+' vs '+r.want);
   assert(r.small.includes('등록만 131'), r.small);
   assert(r.lead.includes('385곳'), r.lead);
 })},
];
