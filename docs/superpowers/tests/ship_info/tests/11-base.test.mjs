import { withPage, assert } from '../lib.mjs';
const go = async (p, h) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(300); };
export default [
 {name:'nav-has-wage-dir', fn: () => withPage({}, async p => {
   assert(await p.$('#navlinks a[href="#wage"]'), 'no #wage link');
   assert(await p.$('#navlinks a[href="#dir"]'), 'no #dir link');
 })},
 {name:'routes-open-views', fn: () => withPage({}, async (p, errors) => {
   await go(p, 'wage');
   assert(await p.isVisible('#v-wage'), '#v-wage hidden');
   assert(await p.title() === '임금 | 선사록', 'title '+await p.title());
   await go(p, 'dir');
   assert(await p.isVisible('#v-dir'), '#v-dir hidden');
   assert(!(await p.isVisible('#v-wage')), '#v-wage still visible');
   assert(errors.length === 0, errors.join('; '));
 })},
 {name:'load-fail-shows-retry', fn: () => withPage({}, async (p, errors) => {
   await p.route('**/data/wage.json', r => r.abort());
   await go(p, 'wage');
   await p.waitForSelector('.load-fail button[data-retry]', {timeout:3000});
   await p.unroute('**/data/wage.json');
   await p.click('.load-fail button[data-retry]');
   await p.waitForTimeout(500);
   assert(await p.$('#v-wage .load-fail') === null, 'load-fail still shown');
   assert(errors.length === 0, errors.join('; '));
 })},
 {name:'type-label-format', fn: () => withPage({}, async p => {
   const r = await p.evaluate(() => [typeLabel('bulk'), typeLabel('product'), man(10023), man(null)]);
   assert(JSON.stringify(r) === JSON.stringify(['벌크선 (잡화)','석유제품선/케미컬선 (유조·케미컬)','1,002','-']), JSON.stringify(r));
 })},
];
