import { withPage, assert } from '../lib.mjs';
export default [
 {name:'version-2', fn: () => withPage({}, async p => {
   const r = await p.evaluate(() => [document.querySelector('#ver-top').textContent, document.querySelector('#ver-foot').textContent, VERSION, PATCH_NOTES[0].v]);
   assert(r[2].startsWith('3.') && r[0].includes(r[2]) && r[1].includes(r[2]) && r[3] === r[2], JSON.stringify(r));
 })},
 {name:'readme-sources', fn: () => withPage({}, async p => {
   const t = await p.$eval('#readme', e => e.textContent);
   assert(t.includes('한국선원통계연보') && t.includes('koswec.or.kr'), t.slice(0, 200));
 })},
 {name:'no-ai-tells', fn: async () => {
   const bad = /[!]|한눈에|완벽|해보세요|\p{Extended_Pictographic}/u;
   for (const [hash, sel] of [['#wage','#v-wage'], ['#dir','#v-dir'], ['#type-bulk','#type-wage'], ['#co-HMM','#co-reg'], ['#co-'+encodeURIComponent('씨엠에스마리타임(주)'),'#v-co .co-main'], ['#type-cement?more=1','#reg-group'], ['#co-HMM','#co-wage']]) await withPage({hash}, async p => {
     await p.waitForTimeout(800);
     const t = await p.$eval(sel, e => e.textContent);
     assert(t.length > 20, hash+' empty');
     const m = t.match(bad);
     assert(!m, hash+' has '+(m && m[0]));
   });
 }},
];
