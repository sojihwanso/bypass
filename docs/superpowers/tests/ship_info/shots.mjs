/* usage: node shots.mjs <outdir> <hash> [hash...]  → <outdir>/<name>-<d|m>-<theme>.png */
import { getBrowser, closeBrowser, BASE } from './lib.mjs';
const [out, ...hashes] = process.argv.slice(2);
const b = await getBrowser();
for (const h of hashes) for (const [w,hh,tag] of [[1440,900,'d'],[390,844,'m']]) for (const th of ['light','dark']){
  const ctx = await b.newContext({ viewport:{width:w,height:hh}, deviceScaleFactor: tag==='m'?2:1 });
  await ctx.addInitScript(t => localStorage.setItem('sasarok-theme-v1', t), th);
  const p = await ctx.newPage(); await p.goto(BASE + h); await p.waitForTimeout(400);
  const name = h.replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'') || 'home';
  await p.screenshot({ path:`${out}/${name}-${tag}-${th}.png`, fullPage: process.env.FULL==='1' });
  await ctx.close();
}
await closeBrowser();
