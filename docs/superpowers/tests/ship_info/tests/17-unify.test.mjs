import { withPage, assert } from '../lib.mjs';
export default [
 {name:'uni-count', fn: () => withPage({}, async p => {
   const r = await p.evaluate(async () => { await uniReady(); return {
     n: UNI.length, co: UNI.filter(u => u.co).length,
     hmm: UNI_BY['HMM'].firm && UNI_BY['HMM'].firm.n, hmmShips: UNI_BY['HMM'].ships,
     hg: [UNI_BY['현대글로비스'].mgr, UNI_BY['현대글로비스'].ships, UNI_BY['현대글로비스'].firm],
     first: UNI[53].n, firstShips: UNI[53].ships }; });
   assert(r.n === 385 && r.co === 53, JSON.stringify(r));
   assert(r.hmm === '에이치엠엠(주)' && r.hmmShips === 65, JSON.stringify(r));
   assert(r.hg[0] === '지마린서비스' && r.hg[1] === null && r.hg[2] === null, JSON.stringify(r.hg));
   assert(r.first === '씨엠에스마리타임(주)' && r.firstShips === 109, r.first);
 })},
 {name:'firm-only-types', fn: () => withPage({}, async p => {
   const r = await p.evaluate(async () => { await uniReady(); return {
     cement: regOnlyFor('cement').length, bulk: regOnlyFor('bulk').length, lng: regOnlyFor('lng').length,
     none: UNI.filter(u => !u.co && !u.types.length).length,
     order: regOnlyFor('cement').map(u => typeShipCount(u, 'cement')) }; });
   assert(r.cement === 131 && r.bulk === 63 && r.lng === 1 && r.none === 111, JSON.stringify(r));
   assert(r.order.every((v, i) => i === 0 || r.order[i-1] >= v), 'not sorted');
 })},
 {name:'fav-keeps-firm-only', fn: () => withPage({init:{fn: () => { try{ localStorage.setItem('sasarok-fav-v1', JSON.stringify({types:[], cos:['씨엠에스마리타임(주)']})); }catch(e){} }}}, async p => {
   assert(await p.evaluate(() => fav.cos.includes('씨엠에스마리타임(주)')), 'dropped');
   await p.waitForSelector('#fav-body a[href^="#co-"]', {timeout:4000});
   const t = await p.$eval('#fav-body', e => e.textContent);
   assert(t.includes('씨엠에스마리타임(주)'), t);
 })},
];
