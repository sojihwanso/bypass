import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, SOURCES } from '../../../../../supabase/functions/ship-news/index.ts';

const ENV = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
const RSS = (n, i = 1) => `<rss><item><title>부산항 선박 소식 ${n} ${i}</title><link>https://ex.com/${n}/${i}</link><pubDate>2026-11-26 10:00:00</pubDate></item></rss>`;
function fakeDb({ lastFetch, failSource, lastOk, failUpsert, failMeta, emptySource } = {}) {
  const calls = { src: [], upsert: null, del: 0, meta: [], select: [] };
  const http = async (url, init = {}) => {
    const u = String(url), m = (init.method || 'GET').toUpperCase();
    if (u.startsWith('https://db.test/rest/v1/ship_news_meta')) {
      if (m === 'GET') return failMeta ? new Response('{"message":"relation does not exist"}', { status: 404 }) : new Response(JSON.stringify(lastFetch ? [{ last_fetch: lastFetch, last_ok: lastOk || null }] : []), { status: 200 });
      calls.meta.push(JSON.parse(init.body)); return new Response('', { status: 201 });
    }
    if (u.startsWith('https://db.test/rest/v1/ship_news')) {
      if (m === 'POST') { calls.upsert = JSON.parse(init.body); return new Response(failUpsert ? '{"message":"bad"}' : '', { status: failUpsert ? 400 : 201 }); }
      if (m === 'DELETE') { calls.del++; return new Response(null, { status: 204 }); }
      calls.select.push(u);
      return new Response(JSON.stringify([{ d: '2026-11-26', c: '항만', t: '부산항 소식', s: '쉬핑뉴스넷', u: 'https://ex.com/a', p: '', k: 'x', fetched_at: '2026-11-26T01:00:00Z' }]), { status: 200 });
    }
    calls.src.push(u);
    const src = SOURCES.find(s => s.url === u);
    if (failSource && src && src.name === failSource) return new Response('no', { status: 500 });
    if (emptySource && src && src.name === emptySource) return new Response('<html>consent</html>', { status: 200 });
    return new Response(RSS(src ? src.name : 'x'), { status: 200 });
  };
  return { http, calls };
}
const NOW = Date.parse('2026-11-26T12:00:00Z');
const req = (q = '', origin = 'https://teambypass.vercel.app') => new Request('https://fn.test/ship-news' + q, { headers: { origin } });

test('refresh-when-stale', async () => {
  const { http, calls } = fakeDb({ lastFetch: new Date(NOW - 25 * 3600e3).toISOString() });
  const r = await handle(req(), { env: k => ENV[k], http, now: () => NOW });
  assert.equal(r.status, 200);
  assert.equal(calls.src.length, SOURCES.length);
  assert.ok(calls.upsert && calls.upsert.length > 0, 'nothing saved');
  assert.ok(calls.meta.length >= 1 && calls.del >= 1);
  const j = await r.json();
  assert.ok(Array.isArray(j.items) && j.items.length === 1 && j.updated);
});
test('no-refresh-when-fresh', async () => {
  const { http, calls } = fakeDb({ lastFetch: new Date(NOW - 3600e3).toISOString() });
  await handle(req(), { env: k => ENV[k], http, now: () => NOW });
  assert.equal(calls.src.length, 0);
});
test('refresh-skips-failed-source', async () => {
  const { http, calls } = fakeDb({ failSource: '해양한국' });
  const r = await handle(req(), { env: k => ENV[k], http, now: () => NOW });
  assert.equal(r.status, 200);
  assert.ok(calls.upsert.length >= SOURCES.length - 1);
  assert.ok(calls.meta.some(m => String(m.last_error || '').includes('해양한국')), JSON.stringify(calls.meta));
});
test('since-param', async () => {
  const { http, calls } = fakeDb({ lastFetch: new Date(NOW - 3600e3).toISOString() });
  await handle(req('?since=2026-11-25T00:00:00.000Z'), { env: k => ENV[k], http, now: () => NOW });
  assert.ok(calls.select[0].includes('fetched_at=gt.2026-11-25T00%3A00%3A00.000Z') || calls.select[0].includes('fetched_at=gt.2026-11-25T00:00:00.000Z'), calls.select[0]);
  assert.ok(calls.select[0].includes('limit=300'));
  const { http: h2, calls: c2 } = fakeDb({ lastFetch: new Date(NOW - 3600e3).toISOString() });
  await handle(req('?since=garbage'), { env: k => ENV[k], http: h2, now: () => NOW });
  assert.ok(!c2.select[0].includes('fetched_at=gt') && c2.select[0].includes('limit=150'), c2.select[0]);
});
test('cors-options', async () => {
  const r = await handle(new Request('https://fn.test/ship-news', { method: 'OPTIONS', headers: { origin: 'https://teambypass.vercel.app' } }), { env: k => ENV[k], http: fakeDb().http, now: () => NOW });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://teambypass.vercel.app');
  assert.ok(r.headers.get('access-control-allow-methods').includes('GET'));
});
test('response-shape', async () => {
  const { http } = fakeDb({ lastFetch: new Date(NOW - 3600e3).toISOString() });
  const j = await (await handle(req(), { env: k => ENV[k], http, now: () => NOW })).json();
  assert.deepEqual(Object.keys(j.items[0]).sort(), ['c', 'd', 'p', 's', 't', 'u']);
});

test('updated-normalized-for-since', async () => {
  const { http } = fakeDb({ lastFetch: new Date(NOW - 3600e3).toISOString(), lastOk: '2026-11-26T03:00:00.482+00:00' });
  const j = await (await handle(req(), { env: k => ENV[k], http, now: () => NOW })).json();
  assert.equal(j.updated, '2026-11-26T03:00:00.482Z');
  const { http: h2, calls } = fakeDb({ lastFetch: new Date(NOW - 3600e3).toISOString() });
  await handle(req('?since=' + encodeURIComponent('2026-11-26T03:00:00.482+00:00')), { env: k => ENV[k], http: h2, now: () => NOW });
  assert.ok(calls.select[0].includes('fetched_at=gt.'), calls.select[0]);
});
test('upsert-failure-not-ok', async () => {
  const { http, calls } = fakeDb({ failUpsert: true });
  await handle(req(), { env: k => ENV[k], http, now: () => NOW });
  assert.ok(!calls.meta.some(m => m.last_ok), 'last_ok written despite failed save');
  assert.ok(calls.meta.some(m => String(m.last_error || '').includes('저장')), JSON.stringify(calls.meta));
});
test('meta-missing-no-collect', async () => {
  const { http, calls } = fakeDb({ failMeta: true });
  const r = await handle(req(), { env: k => ENV[k], http, now: () => NOW });
  assert.equal(r.status, 502);
  assert.equal(calls.src.length, 0, 'collected without a table');
});
test('zero-items-source-recorded', async () => {
  const { http, calls } = fakeDb({ emptySource: '해양한국' });
  await handle(req(), { env: k => ENV[k], http, now: () => NOW });
  assert.ok(calls.meta.some(m => String(m.last_error || '').includes('해양한국')), JSON.stringify(calls.meta));
});
