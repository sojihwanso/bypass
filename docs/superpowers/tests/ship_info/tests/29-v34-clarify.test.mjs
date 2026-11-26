import { withPage, assert } from '../lib.mjs';
const CMS = '#co-' + encodeURIComponent('씨엠에스마리타임(주)');
export default [
 {name:'firm-only-summary-line', fn: () => withPage({hash:CMS}, async p => {
   await p.waitForSelector('#v-co .co-head .reg-only');
   const t = await p.$eval('#v-co .co-head .reg-only', e => e.textContent);
   assert(t.includes('선사 자료 없음') && t.includes('비교'), t);
   const b = await p.$('#v-co button.cmp-off');
   assert(b && await b.isDisabled(), 'disabled compare button');
 })},
 {name:'board-link-marked', fn: () => withPage({hash:'#co-HMM'}, async p => {
   const t = await p.$eval('#v-co a[href="#board"]', a => a.closest('li').textContent);
   assert(t.includes('준비 중'), t);
 })},
 {name:'wage-same-value-note', fn: () => withPage({hash:'#wage'}, async p => {
   await p.waitForSelector('#wage-main');
   assert((await p.$eval('#v-wage', e => e.textContent)).includes('같은 값'), 'note missing');
 })},
 {name:'type-chip-full-names', fn: () => withPage({hash:'#type-product'}, async p => {
   const t = await p.$$eval('#type-switch a', as => as.map(a => a.textContent.trim()));
   assert(t.includes('석유제품선/케미컬선') && t.includes('시멘트선/연안선'), JSON.stringify(t));
 })},
 {name:'rank-hidden-without-size', fn: () => withPage({hash:'#co-HMM'}, async p => {
   const lines = await p.$$eval('.rankline', ls => ls.map(l => l.textContent));
   const prod = lines.find(l => l.includes('석유제품선'));
   assert(prod && !/\d+위/.test(prod) && prod.includes('규모 수치'), prod);
 })},
 {name:'basis-dates-explained', fn: () => withPage({}, async p => {
   const t = await p.$eval('.mast-meta', e => e.textContent);
   assert(t.includes('선사 자료 2026.11.24'), t);
 })},
 {name:'dir-intro-short', fn: () => withPage({hash:'#dir'}, async p => {
   await p.waitForSelector('#dir-list li.firm');
   const t = await p.$eval('#v-dir .dir-src', e => e.textContent);
   assert(t.length < 160, 'intro '+t.length+': '+t);
 })},
];
