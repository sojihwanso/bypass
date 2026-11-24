import { readdir } from 'node:fs/promises';
import { closeBrowser } from './lib.mjs';
const dir = new URL('./tests/', import.meta.url);
const only = process.argv[2];
let pass = 0, fail = 0;
const files = (await readdir(dir)).filter(f => f.endsWith('.test.mjs') && (!only || f.startsWith(only))).sort();
for (const f of files){
  const tests = (await import(new URL(f, dir))).default;
  for (const t of tests){
    try { await t.fn(); pass++; console.log('PASS', f, t.name); }
    catch(e){ fail++; console.log('FAIL', f, t.name, '-', e.message.split('\n')[0]); }
  }
}
await closeBrowser();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
