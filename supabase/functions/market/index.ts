// BYPASS 미국 증시 시세 (Supabase Edge Function: market)
//
// 커뮤니티 홈 › 미국 증시 칸이 부르는 함수입니다. 브라우저는 증권 사이트에서 시세를 바로 못 가져오므로
// 이 함수가 Yahoo Finance 차트 API(키 필요 없음)에서 받아 와 돌려줍니다.
//   - 로그인한 회원만 부를 수 있습니다 (/auth/v1/user 로 확인).
//   - 받은 시세는 market_cache 표(supabase/028_market_watch.sql)에 몇 분 동안 담아 두고, 그 사이에는 Yahoo 에 다시 묻지 않습니다.
//   - 시세는 실시간이 아니라 몇 분 늦을 수 있습니다 (Yahoo 무료 시세 + 담아 두는 시간).
//
// 필요한 비밀 값: 없음. SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어 줍니다.
// 대시보드의 'Verify JWT'(JWT 검증)는 꺼도 됩니다. 로그인은 함수가 직접 확인합니다.
//
// 부르는 법 (POST, JSON)
//   { action: 'quotes', symbols: ['^GSPC', 'AAPL'] }   → 카드용: 현재가·전일 대비·오늘 그래프
//   { action: 'chart',  symbol: 'AAPL', range: '1mo' } → 큰 그래프: 1d 5d 1mo 6mo 1y 5y
//   { action: 'search', q: 'nvidia' }                  → 종목 찾기
//   { action: 'fng' }                                  → CNN 공포·탐욕 지수 (지금 값, 전일·1주·1달·1년 전, 1년 그래프)

const ALLOWED_ORIGINS = ['https://teambypass.vercel.app', 'https://bypass-three.vercel.app'];
const PREVIEW_ORIGIN = /^https:\/\/bypass-git-[a-z0-9-]+-oojoo1\.vercel\.app$/;
export const SYMBOL = /^[A-Z0-9.^=-]{1,15}$/;
const MAX_SYMBOLS = 12;
const MAX_POINTS = 200;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 기간별: Yahoo 의 range·interval(캔들 한 개의 길이), 담아 두는 시간(초)
export const RANGES: Record<string, { range: string; interval: string; ttl: number }> = {
  '1d': { range: '1d', interval: '5m', ttl: 120 },
  '5d': { range: '5d', interval: '30m', ttl: 600 },
  '1mo': { range: '1mo', interval: '1d', ttl: 1800 },     // 일봉
  '6mo': { range: '6mo', interval: '1d', ttl: 3600 },     // 일봉
  '1y': { range: '1y', interval: '1wk', ttl: 3600 },      // 주봉
  '5y': { range: '5y', interval: '1mo', ttl: 21600 },     // 월봉
};
// 지수·환율은 알아보기 쉬운 한글 이름으로
const NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500', '^IXIC': '나스닥', '^DJI': '다우존스', '^RUT': '러셀 2000', '^VIX': 'VIX 공포지수',
  '^NDX': '나스닥 100', '^SOX': '필라델피아 반도체', 'KRW=X': '원·달러 환율',
};

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function reply(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' } });
}

export type Series = {
  symbol: string; name: string; currency: string; exchange: string;
  price: number | null; prev: number | null; change: number | null; pct: number | null;
  time: number | null; state: 'open' | 'pre' | 'post' | 'closed'; tz: string;
  points: [number, number][];   // [유닉스 초, 종가] — 작은 그래프용
  ohlc: [number, number, number, number, number][];   // [유닉스 초, 시가, 고가, 저가, 종가] — 캔들
  range: string;
};

// 점이 너무 많으면 고르게 솎아 낸다 (처음·끝은 남김)
export function thin(points: [number, number][], max = MAX_POINTS): [number, number][] {
  if (points.length <= max) return points;
  const out: [number, number][] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

// Yahoo 차트 응답 → 우리 모양
// deno-lint-ignore no-explicit-any
export function parseChart(j: any, range: string, now = Date.now() / 1000): Series | null {
  const r = j?.chart?.result?.[0];
  if (!r || !r.meta) return null;
  const m = r.meta;
  const ts: number[] = r.timestamp ?? [];
  const q = r.indicators?.quote?.[0] ?? {};
  const cl: (number | null)[] = q.close ?? [];
  const op: (number | null)[] = q.open ?? [], hi: (number | null)[] = q.high ?? [], lo: (number | null)[] = q.low ?? [];
  const R4 = (x: number) => Math.round(x * 10000) / 10000;
  const num = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
  let points: [number, number][] = [];
  let ohlc: [number, number, number, number, number][] = [];
  ts.forEach((t, i) => {
    const c = cl[i]; if (!num(c)) return;
    points.push([t, R4(c)]);
    const o = num(op[i]) ? op[i] as number : c, h = num(hi[i]) ? hi[i] as number : Math.max(o, c), l = num(lo[i]) ? lo[i] as number : Math.min(o, c);
    ohlc.push([t, R4(o), R4(Math.max(h, o, c)), R4(Math.min(l, o, c)), R4(c)]);
  });
  // 하루 그래프인데 '그날' 이 아닌 점이 섞이면 마지막 거래일 것만 (5일로 다시 받은 경우)
  let dayBefore: number | null = null;   // 마지막 거래일 전날의 마지막 종가 (5일 치로 받은 경우)
  if (range === '1d' && points.length) {
    const off = Number(m.gmtoffset ?? 0);
    const day = (t: number) => Math.floor((t + off) / 86400);
    const last = day(points[points.length - 1][0]);
    const before = points.filter(([t]) => day(t) < last);
    if (before.length) dayBefore = before[before.length - 1][1];
    points = points.filter(([t]) => day(t) === last);
    ohlc = ohlc.filter(([t]) => day(t) === last);
  }
  const price = typeof m.regularMarketPrice === 'number' ? m.regularMarketPrice : points.length ? points[points.length - 1][1] : null;
  // 전일 종가: 하루 그래프면 previousClose, 아니면 그 기간 시작 직전 종가(없으면 첫 점)
  let prev: number | null = null;
  if (range === '1d') prev = dayBefore ?? (typeof m.previousClose === 'number' ? m.previousClose : typeof m.chartPreviousClose === 'number' ? m.chartPreviousClose : null);
  else prev = typeof m.chartPreviousClose === 'number' ? m.chartPreviousClose : points.length ? points[0][1] : null;
  const change = price != null && prev != null ? price - prev : null;
  const pct = change != null && prev ? (change / prev) * 100 : null;
  let state: Series['state'] = 'closed';
  const tp = m.currentTradingPeriod;
  const inside = (p: { start?: number; end?: number } | undefined) => !!p && typeof p.start === 'number' && typeof p.end === 'number' && now >= p.start && now < p.end;
  if (tp) state = inside(tp.regular) ? 'open' : inside(tp.pre) ? 'pre' : inside(tp.post) ? 'post' : 'closed';
  const symbol = String(m.symbol ?? '').toUpperCase();
  return {
    symbol,
    name: NAMES[symbol] ?? m.shortName ?? m.longName ?? symbol,
    currency: m.currency ?? 'USD',
    exchange: m.fullExchangeName ?? m.exchangeName ?? '',
    price, prev, change, pct,
    time: typeof m.regularMarketTime === 'number' ? m.regularMarketTime : points.length ? points[points.length - 1][0] : null,
    state, tz: m.exchangeTimezoneName ?? 'America/New_York',
    points: thin(points),
    ohlc: ohlc.slice(-MAX_POINTS),
    range,
  };
}

// ----- CNN 공포·탐욕 지수 -----
// CNN 웹페이지가 쓰는 데이터 주소. 공식 API 는 아니라서 응답 모양이 바뀌면 그래프의 마지막 값으로 대신 계산한다.
export const FNG_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata/';
export type Fng = {
  score: number; rating: string; time: number;
  prev: { close: number | null; week: number | null; month: number | null; year: number | null };
  points: [number, number][];   // [유닉스 초, 점수] 1년
};
// CNN 구간: 0–24 극단적 공포, 25–44 공포, 45–55 중립, 56–75 탐욕, 76–100 극단적 탐욕
export const fngRating = (v: number) => v < 25 ? 'extreme fear' : v < 45 ? 'fear' : v <= 55 ? 'neutral' : v <= 75 ? 'greed' : 'extreme greed';
// deno-lint-ignore no-explicit-any
export function parseFng(j: any): Fng | null {
  // deno-lint-ignore no-explicit-any
  const hist: any[] = j?.fear_and_greed_historical?.data ?? [];
  const pts: [number, number][] = hist
    .filter((d) => typeof d?.x === 'number' && typeof d?.y === 'number' && isFinite(d.y))
    .map((d) => [Math.round(d.x > 1e11 ? d.x / 1000 : d.x), Math.round(d.y * 10) / 10] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const f = j?.fear_and_greed ?? {};
  const num = (x: unknown) => (typeof x === 'number' && isFinite(x) ? Math.round(x * 10) / 10 : null);
  const last = pts.length ? pts[pts.length - 1] : null;
  const score = num(f.score) ?? (last ? last[1] : null);
  if (score == null) return null;
  const tParsed = typeof f.timestamp === 'string' ? Date.parse(f.timestamp) / 1000 : typeof f.timestamp === 'number' ? (f.timestamp > 1e11 ? f.timestamp / 1000 : f.timestamp) : NaN;
  const time = isFinite(tParsed) ? Math.round(tParsed) : last ? last[0] : Math.round(Date.now() / 1000);
  // 응답에 지난 값이 없으면 그래프에서 그 날짜 즈음 값을 찾는다
  const ago = (days: number) => { const t = time - days * 86400; let v: number | null = null; for (const [x, y] of pts) { if (x <= t) v = y; else break; } return v; };
  return {
    score,
    rating: typeof f.rating === 'string' && f.rating ? f.rating.toLowerCase() : fngRating(score),
    time,
    prev: { close: num(f.previous_close) ?? ago(1), week: num(f.previous_1_week) ?? ago(7), month: num(f.previous_1_month) ?? ago(30), year: num(f.previous_1_year) ?? ago(365) },
    points: thin(pts.filter(([x]) => x >= time - 366 * 86400)),
  };
}

type Env = (k: string) => string | undefined;

export function makeService(env: Env, http: typeof fetch) {
  const url = env('SUPABASE_URL') ?? '';
  const key = env('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const mem = new Map<string, { at: number; data: unknown }>();
  const db = { headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };

  async function cacheGet(keys: string[], ttl: number): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    const now = Date.now();
    const miss: string[] = [];
    for (const k of keys) { const h = mem.get(k); if (h && now - h.at < ttl * 1000) out[k] = h.data; else miss.push(k); }
    if (!miss.length || !url || !key) return out;
    try {
      const list = miss.map((k) => `"${k.replace(/"/g, '')}"`).join(',');
      const res = await http(`${url}/rest/v1/market_cache?select=key,data,fetched_at&key=in.(${encodeURIComponent(list)})`, db);
      if (res.ok) {
        for (const row of await res.json() as { key: string; data: unknown; fetched_at: string }[]) {
          const at = Date.parse(row.fetched_at);
          if (now - at < ttl * 1000) { out[row.key] = row.data; mem.set(row.key, { at, data: row.data }); }
        }
      }
    } catch { /* 임시 저장을 못 읽으면 Yahoo 에서 받는다 */ }
    return out;
  }
  async function cachePut(rows: { key: string; data: unknown }[]) {
    const at = Date.now();
    rows.forEach((r) => mem.set(r.key, { at, data: r.data }));
    if (!rows.length || !url || !key) return;
    try {
      await http(`${url}/rest/v1/market_cache?on_conflict=key`, {
        method: 'POST',
        headers: { ...db.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows.map((r) => ({ key: r.key, data: r.data, fetched_at: new Date(at).toISOString() }))),
      });
      if (Math.random() < 0.02) await http(`${url}/rest/v1/rpc/market_cache_prune`, { method: 'POST', headers: db.headers, body: '{}' });
    } catch { /* 저장 못 해도 이번 응답은 그대로 */ }
  }

  async function yahoo(path: string): Promise<unknown> {
    let last = '';
    for (const host of ['query1', 'query2']) {
      try {
        const res = await http(`https://${host}.finance.yahoo.com${path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
        if (res.ok) return await res.json();
        last = `HTTP ${res.status}`;
        if (res.status === 404) break;   // 없는 종목
      } catch (e) { last = String(e); }
    }
    throw new Error(last || 'yahoo');
  }

  async function series(sym: string, range: string): Promise<Series> {
    const R = RANGES[range];
    const j = await yahoo(`/v8/finance/chart/${encodeURIComponent(sym)}?range=${R.range}&interval=${R.interval}&includePrePost=false`);
    let s = parseChart(j, range);
    // 장 시작 전에는 '오늘' 점이 없을 수 있다 → 5일 치에서 마지막 거래일만
    if (range === '1d' && s && s.points.length < 2) {
      const j5 = await yahoo(`/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=15m&includePrePost=false`);
      const s5 = parseChart(j5, '1d');
      if (s5 && s5.points.length >= 2) s = { ...s5, state: s.state };
    }
    if (!s || s.price == null) throw new Error('no data');
    return s;
  }

  // 한꺼번에 너무 많이 묻지 않게 4개씩
  async function many<T, R>(items: T[], f: (x: T) => Promise<R>, n = 4): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await f(items[k]); } }));
    return out;
  }

  async function quotes(symbols: string[]) {
    const keys = symbols.map((s) => `v2:1d:${s}`);
    const hit = await cacheGet(keys, RANGES['1d'].ttl);
    const fresh: { key: string; data: unknown }[] = [];
    const errors: Record<string, string> = {};
    const list = await many(symbols, async (s) => {
      const k = `v2:1d:${s}`;
      if (hit[k]) return hit[k] as Series;
      try { const d = await series(s, '1d'); fresh.push({ key: k, data: d }); return d; }
      catch (e) { errors[s] = String((e as Error).message || e).includes('404') ? 'not found' : 'unavailable'; return null; }
    });
    await cachePut(fresh);
    return { quotes: list.filter(Boolean), errors };
  }

  async function chart(sym: string, range: string) {
    const k = `v2:${range}:${sym}`;
    const hit = await cacheGet([k], RANGES[range].ttl);
    if (hit[k]) return hit[k];
    const d = await series(sym, range);
    await cachePut([{ key: k, data: d }]);
    return d;
  }

  async function search(q: string) {
    const k = `s:${q.toLowerCase()}`;
    const hit = await cacheGet([k], 86400);
    if (hit[k]) return hit[k];
    // deno-lint-ignore no-explicit-any
    const j: any = await yahoo(`/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`);
    // deno-lint-ignore no-explicit-any
    const items = (j?.quotes ?? []).filter((x: any) => x?.symbol && SYMBOL.test(String(x.symbol).toUpperCase()) && ['EQUITY', 'ETF', 'INDEX', 'CURRENCY', 'MUTUALFUND', 'CRYPTOCURRENCY'].includes(x.quoteType))
      // deno-lint-ignore no-explicit-any
      .map((x: any) => ({ symbol: String(x.symbol).toUpperCase(), name: NAMES[String(x.symbol).toUpperCase()] ?? x.shortname ?? x.longname ?? x.symbol, exch: x.exchDisp ?? x.exchange ?? '', type: x.quoteType }));
    const data = { items };
    await cachePut([{ key: k, data }]);
    return data;
  }

  async function fng() {
    const k = 'v2:fng';
    const hit = await cacheGet([k], 1800);   // 30분
    if (hit[k]) return hit[k];
    const from = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
    let last = '';
    for (const url of [FNG_URL + from, FNG_URL.replace(/\/$/, '')]) {
      try {
        const res = await http(url, { headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', Referer: 'https://edition.cnn.com/', Origin: 'https://edition.cnn.com' } });
        if (!res.ok) { last = `HTTP ${res.status}`; continue; }
        const d = parseFng(await res.json());
        if (!d) { last = 'shape'; continue; }
        await cachePut([{ key: k, data: d }]);
        return d;
      } catch (e) { last = String(e); }
    }
    throw new Error(`fng ${last}`);
  }

  return { quotes, chart, search, fng };
}

let service: ReturnType<typeof makeService> | null = null;

export async function handle(req: Request, env: Env = (k) => Deno.env.get(k), http: typeof fetch = fetch, svc?: ReturnType<typeof makeService>): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reply(req, 405, { error: 'POST 로만 부를 수 있습니다.' });

  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return reply(req, 401, { error: '로그인이 필요합니다.' });
  const who = await http(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: req.headers.get('apikey') || env('SUPABASE_ANON_KEY') || '', Authorization: auth },
  });
  if (!who.ok) return reply(req, 401, { error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' });

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return reply(req, 400, { error: '요청을 읽지 못했습니다.' }); }
  const s = svc ?? (service ??= makeService(env, http));
  try {
    if (body.action === 'quotes') {
      const syms = [...new Set((Array.isArray(body.symbols) ? body.symbols : []).map((x: unknown) => String(x).trim().toUpperCase()))] as string[];
      if (!syms.length || syms.length > MAX_SYMBOLS || !syms.every((x) => SYMBOL.test(x))) return reply(req, 400, { error: `종목은 1~${MAX_SYMBOLS}개, 영문 기호로 보내 주세요.` });
      return reply(req, 200, await s.quotes(syms));
    }
    if (body.action === 'chart') {
      const sym = String(body.symbol ?? '').trim().toUpperCase();
      const range = String(body.range ?? '1d');
      if (!SYMBOL.test(sym) || !RANGES[range]) return reply(req, 400, { error: '종목이나 기간이 올바르지 않습니다.' });
      return reply(req, 200, await s.chart(sym, range));
    }
    if (body.action === 'fng') return reply(req, 200, await s.fng());
    if (body.action === 'search') {
      const q = String(body.q ?? '').trim().slice(0, 40);
      if (!q) return reply(req, 400, { error: '찾을 말을 입력해 주세요.' });
      return reply(req, 200, await s.search(q));
    }
    return reply(req, 400, { error: '알 수 없는 요청입니다.' });
  } catch (e) {
    const msg = String((e as Error).message || e);
    if (msg.includes('404')) return reply(req, 404, { error: '그런 종목을 찾지 못했습니다.' });
    return reply(req, 502, { error: '시세를 받아오지 못했습니다. 잠시 후 다시 해 주세요.' });
  }
}

if (!Deno.env.get('BYPASS_TEST')) Deno.serve((req) => handle(req));
