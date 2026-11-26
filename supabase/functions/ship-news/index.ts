// BYPASS 선사록 해운 소식 (Supabase Edge Function: ship-news)
//
// 선사록 › 해운 소식이 부르는 함수입니다. 해운 전문지 RSS와 구글 뉴스 검색 RSS에서 소식을 모아
// ship_news 표(supabase/038_ship_news.sql)에 담아 두고, 하루(24시간)에 한 번만 새로 모읍니다.
//   - 로그인 필요 없음(공개 소식). 대시보드의 'Verify JWT'는 끕니다.
//   - 기사 본문은 저장하지 않습니다. 제목·매체·날짜·원문 링크·짧은 요약만.
//   - 외부 라이브러리 없이 fetch만 씁니다. 대시보드 편집기에 이 파일 전체를 붙여 넣으면 됩니다.
//
// 필요한 비밀 값: 없음. SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어 줍니다.
//
// 부르는 법: GET → { updated: 'ISO 시각', items: [{d, c, t, s, u, p}] }  (최근 30일, 최신순, 최대 200건)

export type Raw = { t: string; u: string; d: string; s: string; p: string };
export type Item = Raw & { c: string; k: string };

const ALLOWED_ORIGINS = ['https://teambypass.vercel.app', 'https://bypass-three.vercel.app'];
const PREVIEW_ORIGIN = /^https:\/\/bypass-git-[a-z0-9-]+-oojoo1\.vercel\.app$/;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const REFRESH_MS = 24 * 3600 * 1000;
const KEEP_DAYS = 45, SEND_DAYS = 30, SEND_MAX = 200, TIMEOUT_MS = 8000;

const g = (q: string) => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:3d') + '&hl=ko&gl=KR&ceid=KR:ko';
export const SOURCES: { name: string; url: string; search: boolean; filter?: boolean }[] = [
  { name: '쉬핑뉴스넷', url: 'https://www.shippingnewsnet.com/rss/allArticle.xml', search: false },
  { name: '해양한국', url: 'https://www.monthlymaritimekorea.com/rss/allArticle.xml', search: false },
  { name: '한국해운신문', url: 'https://www.maritimepress.co.kr/rss/allArticle.xml', search: false },
  { name: '카고뉴스', url: 'https://www.cargonews.co.kr/rss/allArticle.xml', search: false, filter: true },  // 항공 화물 기사도 있어 해운 낱말로 거름
  ...['해운', '선사 선박', '컨테이너선 운임', '벌크선', '유조선 OR 탱커', 'LNG선',
      '조선소 수주', '선박 발주', '부산항', '항만 물동량',
      '머스크 OR MSC OR CMA CGM', '코스코 OR 하파그로이드 OR ONE 해운', '에버그린 OR 양밍 OR HMM',
      '선원 해기사', '해양사고'].map(q => ({ name: '구글 뉴스: ' + q, url: g(q), search: true })),
];

// ---------- 글자 정리 ----------
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const stripTags = (s: string) => s.replace(/<[^>]*>/g, ' ');
const clean = (s: string) => decode(stripTags(decode(s))).replace(/\s+/g, ' ').trim();
function tag(block: string, name: string): string {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
  if (!m) return '';
  const v = m[1].trim();
  const cd = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cd ? cd[1] : v;
}

// ---------- 날짜: 한국 시간 YYYY-MM-DD ----------
function kstDate(raw: string): string {
  const s = raw.trim();
  const local = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/); // 국내 전문지: 이미 한국 시간
  if (local) return local[1] + '-' + local[2] + '-' + local[3];
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return '';
  return new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function parseRss(xml: string, fallbackSource: string): Raw[] {
  const out: Raw[] = [];
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const b = m[0];
    let t = clean(tag(b, 'title'));
    const u = decode(tag(b, 'link')).trim();
    const d = kstDate(decode(tag(b, 'pubDate')));
    const src = clean(tag(b, 'source')) || fallbackSource;   // 전문지 author 칸은 기자 이름이라 쓰지 않음
    if (src && t.endsWith(' - ' + src)) t = t.slice(0, -(src.length + 3)).trim();
    let p = clean(tag(b, 'description'));
    if (src && p.endsWith(src)) p = p.slice(0, -src.length).trim();
    if (p === t || t.startsWith(p) || p.length < 10) p = '';
    if (p.length > 120) p = p.slice(0, 119).trimEnd() + '…';
    if (!t || !/^https?:\/\//.test(u) || !d) continue;
    out.push({ t: t.slice(0, 200), u, d, s: src.slice(0, 40), p });
  }
  return out;
}

// ---------- 고르기·분류 ----------
const MARITIME = ['해운', '선사', '선박', '선원', '해기사', '조선', '조선소', '항만', '항구', '부산항', '인천항', '광양항', '울산항', '평택항',
  '컨테이너', '벌크', '탱커', '유조선', 'LNG선', 'LPG선', '자동차운반선', '운반선', '화물선', '여객선', '어선', '예인선', '선대', '선복',
  '운임', 'SCFI', 'BDI', '물동량', '해양', '해상', '항로', '해협', '수에즈', '파나마운하', '호르무즈', '홍해', '머스크', 'MSC', 'CMA CGM', '코스코',
  '하파그로이드', '에버그린', '양밍', 'HMM', '팬오션', '해수부', '해양수산부', '선급', 'IMO', '발주', '수주'];
const AIR = /항공|공항|여객기|화물기|B7\d7|A3\d0/;
const SEA_STRONG = /선박|해운|선사|해상|항만|컨테이너선|조선/;
export function isMaritime(t: string): boolean {
  const s = t.replace(/해운대/g, '');
  if (AIR.test(s) && !SEA_STRONG.test(s)) return false;
  return MARITIME.some(w => s.includes(w));
}
const RULES: [string, RegExp][] = [
  ['사고', /사고|충돌|좌초|침몰|화재|폭발|실종|표류|기름 유출|해적|나포/],
  ['선원과 채용', /선원|해기사|채용|승선근무|실습생|구인|인력난/],
  ['조선', /조선소|조선사|조선업|수주|건조|진수|명명식|K-?조선|한화오션|HD현대중공업|삼성중공업|HD한국조선해양/],
  ['항만', /항만|부산항|인천항|광양항|울산항|평택항|물동량|터미널|부두|신항/],
  ['운임과 원자재', /운임|SCFI|BDI|CCFI|용선료|유가|원유|선박연료|벙커|철광석|석탄|곡물|원자재/],
  ['실적과 시황', /실적|영업이익|순이익|매출|분기|시황|전망|흑자|적자/],
  ['정책과 제도', /해양수산부|해수부|정부|법안|법 개정|개정안|시행령|특별법|입법|제도|규제|IMO|탄소|환경|정책|국회|예산/],
  ['선대와 발주', /발주|인도|신조|선대|선복|용선|매각|매입|친환경선|이중연료/],
  ['해외 해운사', /머스크|MSC|CMA ?CGM|코스코|COSCO|하파그로이드|하팍로이드|에버그린|양밍|ONE\b|오션 네트워크|짐라인|ZIM/],
];
export function classify(t: string, p: string): string {
  const s = t + ' ' + p;
  for (const [c, re] of RULES) if (re.test(s)) return c;
  return '기업 소식';
}
export function titleKey(t: string): string {
  return t.replace(/\[[^\]]*\]|\([^)]*\)|〈[^〉]*〉|<[^>]*>/g, '').replace(/[^0-9A-Za-z가-힣]/g, '').slice(0, 30);
}
/** filter: 해운 낱말로 거름(검색 결과·카고뉴스). cap: 최신순 최대 개수(검색어마다 10) */
export function pickItems(raws: Raw[], filter: boolean, cap = Infinity): Item[] {
  return raws.filter(r => !filter || isMaritime(r.t))
    .sort((a, b) => b.d.localeCompare(a.d)).slice(0, cap)
    .map(r => ({ ...r, c: classify(r.t, r.p), k: titleKey(r.t) }));
}
export function dedupe(items: Item[]): Item[] {
  const seenU = new Set<string>(), seenK = new Set<string>(), out: Item[] = [];
  for (const it of items) {
    if (seenU.has(it.u) || (it.k && seenK.has(it.k))) continue;
    seenU.add(it.u); if (it.k) seenK.add(it.k); out.push(it);
  }
  return out;
}

// ---------- 서버 ----------
type Env = (k: string) => string | undefined;
type Deps = { env: Env; http: typeof fetch; now: () => number };

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}
function reply(req: Request, status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', ...extra } });
}

async function getText(http: typeof fetch, url: string): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await http(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml' }, signal: ac.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(timer); }
}

/** 모든 수집처에서 받아 고르고 중복을 없앤 목록 + 실패한 수집처 이름 */
export async function collect(http: typeof fetch): Promise<{ items: Item[]; failed: string[] }> {
  const failed: string[] = [];
  const lists = await Promise.all(SOURCES.map(async (s) => {
    try {
      const raws = parseRss(await getText(http, s.url), s.search ? '구글 뉴스' : s.name);
      return pickItems(raws, s.search || !!s.filter, s.search ? 10 : Infinity);
    } catch { failed.push(s.name); return [] as Item[]; }
  }));
  // 전문지를 먼저 두어, 같은 기사면 전문지 쪽(원문 주소)이 남게
  return { items: dedupe(lists.flat()), failed };
}

export async function handle(req: Request, deps?: Partial<Deps>): Promise<Response> {
  const env: Env = deps?.env ?? ((k) => (typeof Deno !== 'undefined' ? Deno.env.get(k) : undefined));
  const http = deps?.http ?? fetch;
  const now = deps?.now ?? Date.now;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'GET') return reply(req, 405, { error: 'GET만 받습니다.' });

  const base = env('SUPABASE_URL') ?? '', key = env('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const rest = (path: string, init: RequestInit = {}) => http(`${base}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const putMeta = (row: Record<string, unknown>) => rest('ship_news_meta?on_conflict=id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, ...row }),
  });

  try {
    // 1) 24시간 지났으면 새로 모음 (먼저 last_fetch를 바꿔 동시에 여러 번 모으지 않게)
    let last = 0, lastOk = '';
    const mr = await rest('ship_news_meta?select=last_fetch,last_ok&id=eq.1');
    if (mr.ok) { const row = (await mr.json() as { last_fetch?: string; last_ok?: string }[])[0]; last = row?.last_fetch ? Date.parse(row.last_fetch) : 0; lastOk = row?.last_ok ?? ''; }
    if (!last || now() - last >= REFRESH_MS) {
      const startedAt = new Date(now()).toISOString();
      await putMeta({ last_fetch: startedAt });
      const { items, failed } = await collect(http);
      if (items.length) {
        await rest('ship_news?on_conflict=u', {
          method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(items.map(({ d, c, t, s, u, p, k }) => ({ d, c, t, s, u, p, k, fetched_at: startedAt }))),
        });
      }
      const cut = new Date(now() - KEEP_DAYS * 86400e3).toISOString().slice(0, 10);
      await rest('ship_news?d=lt.' + cut, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      lastOk = startedAt;
      await putMeta({ last_ok: startedAt, last_error: failed.length ? '받지 못한 곳: ' + failed.join(', ') : null });
    }

    // 2) 돌려줄 소식: since 뒤에 새로 들어온 것(최대 300) 또는 최신 150
    const sinceRaw = new URL(req.url).searchParams.get('since') ?? '';
    const since = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(sinceRaw) && Number.isFinite(Date.parse(sinceRaw)) ? sinceRaw : '';
    const q = 'ship_news?select=d,c,t,s,u,p&order=fetched_at.desc,d.desc' + (since ? '&fetched_at=gt.' + encodeURIComponent(since) + '&limit=300' : '&limit=150');
    const sr = await rest(q);
    const rows = sr.ok ? await sr.json() as Raw[] & { c: string }[] : [];
    const items = rows.map((r: any) => ({ d: r.d, c: r.c, t: r.t, s: r.s, u: r.u, p: r.p || '' }));
    return reply(req, 200, { updated: lastOk || new Date(now()).toISOString(), items }, { 'Cache-Control': 'public, max-age=600' });
  } catch (e) {
    if (typeof process !== 'undefined' && process.env.SHIP_NEWS_DEBUG) console.error(e);
    return reply(req, 502, { error: '소식을 불러오지 못했습니다.' });
  }
}

declare const Deno: any;
declare const process: any;
if (typeof Deno !== 'undefined' && !Deno.env.get('BYPASS_TEST')) Deno.serve((req: Request) => handle(req));
