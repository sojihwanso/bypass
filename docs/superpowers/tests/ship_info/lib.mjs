import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/turo/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core');
export const BASE = process.env.SASAROK_BASE || 'http://127.0.0.1:8765/apps/ship_info/index.html';
let browser;
export async function getBrowser(){ if(!browser) browser = await chromium.launch({ channel:'chrome', headless:true }); return browser; }
export async function closeBrowser(){ if(browser) await browser.close(); browser = null; }
/* opts: width,height,theme,hash,init(page) */
export async function withPage(opts, fn){
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport:{ width:opts.width||1440, height:opts.height||900 } });
  const theme = opts.theme || 'light';
  await ctx.addInitScript(t => { try{ localStorage.setItem('sasarok-theme-v1', t); }catch(e){} }, theme);
  if (opts.init) await ctx.addInitScript(opts.init.fn, opts.init.arg);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(BASE + (opts.hash || '#home'));
  await page.waitForTimeout(250);
  try { return await fn(page, errors); } finally { await ctx.close(); }
}
export function assert(cond, msg){ if(!cond) throw new Error(msg); }
/* WCAG contrast of two css colors (rgb/rgba strings) */
export function contrast(a, b){
  const p = s => s.match(/[\d.]+/g).slice(0,3).map(Number);
  const L = c => { const [r,g,bl] = p(c).map(v => { v/=255; return v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4; }); return 0.2126*r+0.7152*g+0.0722*bl; };
  const x = L(a), y = L(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
