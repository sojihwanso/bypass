import { withPage, assert } from '../lib.mjs';
export default [
 {name:'cap-weight', fn: () => withPage({hash:'#type-container'}, async p => {
   const r = await p.evaluate(() => {
     const caps = [...document.querySelectorAll('#reg-body .cap')];
     const pick = k => caps.find(c => c.querySelector('.ctag.'+k));
     const s = el => el && { w: Number(getComputedStyle(el).fontWeight), c: getComputedStyle(el).color };
     const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
     const tmp = document.createElement('span'); tmp.style.color = muted; document.body.append(tmp);
     return { p: s(pick('p')), e: s(pick('e')), muted: getComputedStyle(tmp).color };
   });
   assert(r.p && r.p.w >= 700, 'reported weight '+JSON.stringify(r.p));
   assert(r.e, 'no estimate row in container table');
   assert(r.e.w <= 500 && r.e.c === r.muted, 'estimate '+JSON.stringify(r.e)+' muted '+r.muted);
 })}
];
