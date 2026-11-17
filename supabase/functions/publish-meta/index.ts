// BYPASS 링크 미리보기 고치기 (Supabase Edge Function: publish-meta)
//
// 운영진이 HQ › 링크 미리보기에서 저장하면, 이 함수가 GitHub 저장소의 해당 페이지 HTML 에서
// 카톡·SNS 미리보기 태그(og:title, og:description, og:image, og:image:alt)만 바꿔 저장(커밋)합니다.
// 저장되면 Vercel 이 자동으로 배포합니다. 카톡 같은 앱은 스크립트를 실행하지 않고 HTML 글자만 읽기 때문입니다.
//
// 필요한 비밀 값은 publish-wiki 와 같습니다 (이미 넣었다면 다시 넣지 않아도 됨)
//   GITHUB_TOKEN  : 이 저장소의 Contents 읽기·쓰기 권한만 가진 GitHub 토큰
//   GITHUB_REPO   : sojihwanso/bypass   (없으면 이 값을 씀)
//   GITHUB_BRANCH : main                (없으면 이 값을 씀)
// 'Verify JWT'(JWT 검증)는 꺼도 됩니다. 이 함수가 /auth/v1/user 로 직접 로그인과 운영진 여부를 확인합니다.
//
// 결과물 썸네일 (action: 'sync_thumbs')
//   커뮤니티 결과물에 썸네일이 있고 그 주소가 사이트 안(/apps/·/tools/·/wiki/·/archive/ 아래)이면,
//   그 페이지의 링크 미리보기 그림을 썸네일로 바꿉니다. 썸네일을 빼거나 글을 지우면 공통 그림으로 돌아갑니다.
//   결과물을 저장·삭제할 때 커뮤니티가 부르므로 로그인한 회원이면 누구나 부를 수 있습니다. (DB 내용대로 맞추기만 함)

const ALLOWED_ORIGINS = [
  'https://teambypass.vercel.app',
  'https://bypass-three.vercel.app',
];
// 브랜치 미리보기 주소(https://bypass-git-<브랜치>-oojoo1.vercel.app)에서도 시험할 수 있게
const PREVIEW_ORIGIN = /^https:\/\/bypass-git-[a-z0-9-]+-oojoo1\.vercel\.app$/;

// 고칠 수 있는 페이지 (주소 → 저장소 파일). 이 밖의 파일은 건드리지 않는다
//  · 정해 둔 페이지 + /apps/·/tools/·/wiki/·/archive/ 아래 한 단계 폴더의 index.html
//  · HQ(/hq/)는 미리보기가 필요 없어 뺀다
export const PAGES: Record<string, string> = {
  '/': 'index.html',
  '/community/': 'community/index.html',
  '/login/': 'login/index.html',
  '/join/': 'join/index.html',
  '/dockets/': 'dockets/index.html',
  '/routes/': 'routes/index.html',
  '/site/': 'site/index.html',
};
const SUB = /^\/(apps|tools|wiki|archive)\/([a-z0-9][a-z0-9-]{0,48})\/$/;
export function fileOf(page: string): string | null {
  if (PAGES[page]) return PAGES[page];
  return SUB.test(page) ? `${page.slice(1)}index.html` : null;
}
export function pageOf(file: string): string | null {
  const hit = Object.entries(PAGES).find(([, f]) => f === file);
  if (hit) return hit[0];
  const m = file.match(/^(apps|tools|wiki|archive)\/([a-z0-9][a-z0-9-]{0,48})\/index\.html$/);
  return m ? `/${m[1]}/${m[2]}/` : null;
}
const SITE = 'https://teambypass.vercel.app';

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const ok = ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function reply(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' } });
}
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s : '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// 태그를 넣을 자리: </head> 앞. </head> 를 생략한 페이지면 <title>…</title> 뒤, 그것도 없으면 <head> 바로 뒤
export function headAt(html: string): number {
  const end = html.search(/<\/head>/i);
  if (end >= 0) return end;
  const t = html.match(/<title[^>]*>[^<]*<\/title>\s*/i);
  if (t && t.index !== undefined) return t.index + t[0].length;
  const h = html.match(/<head[^>]*>\s*/i);
  return h && h.index !== undefined ? h.index + h[0].length : -1;
}
// <meta property="og:title" content="…"> 의 content 만 바꾼다. 없으면 og 태그 묶음 끝(없으면 </head> 앞)에 넣는다
export function setMeta(html: string, prop: string, value: string): string {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta\\s+property="${esc}"\\s+content="[^"]*"\\s*\\/?>`, 'i');
  const tag = `<meta property="${prop}" content="${attr(value)}">`;
  if (re.test(html)) return html.replace(re, tag);
  const head = headAt(html);
  const before = head < 0 ? html : html.slice(0, head);
  const ogs = [...before.matchAll(/<meta\s+property="og:[^"]+"[^>]*>/gi)];
  if (ogs.length) {
    const last = ogs[ogs.length - 1];
    const at = (last.index ?? 0) + last[0].length;
    return html.slice(0, at) + '\n' + tag + html.slice(at);
  }
  if (head < 0) throw new Error('no head');
  return html.slice(0, head) + tag + '\n' + html.slice(head);
}
// <meta name="twitter:card" …> 처럼 name 으로 된 태그 (없을 때만 넣는다)
export function ensureName(html: string, name: string, value: string): string {
  if (new RegExp(`<meta\\s+name="${name.replace(/[.:]/g, '\\$&')}"`, 'i').test(html)) return html;
  const head = headAt(html);
  if (head < 0) throw new Error('no head');
  return html.slice(0, head) + `<meta name="${name}" content="${attr(value)}">\n` + html.slice(head);
}
const pageTitle = (html: string) => { const m = html.match(/<title[^>]*>([^<]*)<\/title>/i); return m ? m[1].trim() : ''; };
const nameMeta = (html: string, name: string) => { const m = html.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i')); return m ? m[1] : ''; };
// 모든 페이지 공통 그림: 그림·그림 설명은 바꾸고, 제목·설명 등은 없을 때만 페이지 제목·설명으로 채운다
//   dims=false 이면 그림 크기 태그를 뺀다 (회원이 올린 썸네일은 1200×630 이 아니라서, 틀린 크기를 알려 주지 않게)
export function applyShare(html: string, page: string, image: string, alt: string, dims = true): string {
  let next = html;
  const fill = (prop: string, value: string) => { if (value && readMeta(next, prop) === null) next = setMeta(next, prop, value); };
  fill('og:type', 'website');
  fill('og:site_name', 'BYPASS');
  fill('og:locale', 'ko_KR');
  fill('og:url', SITE + page);
  const t = pageTitle(next).replace(/&amp;/g, '&');
  fill('og:title', t ? (/BYPASS/.test(t) ? t : `${t} | BYPASS`) : 'BYPASS');
  fill('og:description', nameMeta(next, 'description').replace(/&amp;/g, '&') || 'BYPASS 크루가 만든 것. 누구나, 무엇이든.');
  next = setMeta(next, 'og:image', image);
  if (dims) {
    next = setMeta(next, 'og:image:width', '1200');
    next = setMeta(next, 'og:image:height', '630');
  } else {
    next = next.replace(/[ \t]*<meta\s+property="og:image:(width|height)"\s+content="[^"]*"\s*\/?>\n?/gi, '');
  }
  if (alt) next = setMeta(next, 'og:image:alt', alt);
  next = ensureName(next, 'twitter:card', 'summary_large_image');
  return next;
}
// 결과물 주소 → 미리보기를 붙일 페이지 (/apps/이름/ 꼴). 사이트 밖 주소면 null
export function pageOfUrl(u: unknown): string | null {
  if (typeof u !== 'string' || !u) return null;
  let path = u.trim();
  const m = path.match(/^https:\/\/(teambypass|bypass-three)\.vercel\.app(\/.*)?$/i);
  if (m) path = m[2] || '/';
  if (!path.startsWith('/')) return null;
  path = path.replace(/[?#].*$/, '').replace(/index\.html$/i, '');
  if (!path.endsWith('/')) path += '/';
  return SUB.test(path) ? path : null;
}
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export function readMeta(html: string, prop: string): string | null {
  const m = html.match(new RegExp(`<meta\\s+property="${prop.replace(/[.:]/g, '\\$&')}"\\s+content="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

export async function handle(req: Request, env: (k: string) => string | undefined = (k) => Deno.env.get(k), http: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reply(req, 405, { error: 'POST 로만 고칠 수 있습니다.' });

  // 1) 운영진만
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return reply(req, 401, { error: '로그인이 필요합니다.' });
  const who = await http(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: req.headers.get('apikey') || env('SUPABASE_ANON_KEY') || '', Authorization: auth },
  });
  if (!who.ok) return reply(req, 401, { error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' });
  const user = await who.json();

  // 2) 고칠 내용 확인
  let body: { action?: string; page?: string; title?: string; description?: string; image?: string; image_alt?: string };
  try { body = await req.json(); } catch { return reply(req, 400, { error: '보낸 내용을 읽지 못했습니다.' }); }
  if (body.action !== 'sync_thumbs' && user?.app_metadata?.bypass_role !== 'staff') return reply(req, 403, { error: '운영진만 고칠 수 있습니다.' });
  const token = env('GITHUB_TOKEN');
  if (!token) return reply(req, 500, { error: '링크 미리보기 설정이 아직 끝나지 않았습니다. (GITHUB_TOKEN 없음)' });
  const repo = env('GITHUB_REPO') || 'sojihwanso/bypass';
  const branch = env('GITHUB_BRANCH') || 'main';
  const api = (url: string, init: RequestInit = {}, accept = 'application/vnd.github+json') => http(`https://api.github.com/repos/${repo}${url}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'bypass-publish-meta', ...(init.headers ?? {}) },
  });
  // 저장소에서 미리보기를 붙일 수 있는 페이지 전부
  const listPages = async (): Promise<{ page: string; file: string }[] | null> => {
    const r = await api(`/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (!r.ok) return null;
    const j = await r.json();
    return (j.tree ?? []).filter((x: { type: string }) => x.type === 'blob')
      .map((x: { path: string }) => ({ file: x.path, page: pageOf(x.path) }))
      .filter((x: { page: string | null }) => x.page) as { page: string; file: string }[];
  };
  // 여러 파일을 한 번의 커밋으로 (배포도 한 번)
  const commitAll = async (head: string, files: { path: string; text: string }[], message: string): Promise<Response | string> => {
    const changes: { path: string; mode: string; type: string; sha: string }[] = [];
    for (const f of files) {
      const b = await api('/git/blobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: toBase64(f.text), encoding: 'base64' }) });
      if (!b.ok) return reply(req, 502, { error: `GitHub 에 저장하지 못했습니다. (${b.status})` });
      changes.push({ path: f.path, mode: '100644', type: 'blob', sha: (await b.json()).sha });
    }
    const base = await api(`/git/commits/${head}`);
    if (!base.ok) return reply(req, 502, { error: `GitHub 에서 커밋을 읽지 못했습니다. (${base.status})` });
    const tree = await api('/git/trees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base_tree: (await base.json()).tree.sha, tree: changes }) });
    if (!tree.ok) return reply(req, 502, { error: `GitHub 에 저장하지 못했습니다. (${tree.status})` });
    const commit = await api('/git/commits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, tree: (await tree.json()).sha, parents: [head] }) });
    if (!commit.ok) return reply(req, 502, { error: `GitHub 에 저장하지 못했습니다. (${commit.status})` });
    const c = await commit.json();
    const move = await api(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sha: c.sha }) });
    if (!move.ok) return reply(req, move.status === 422 ? 409 : 502, { error: move.status === 422 ? '그사이 저장소가 바뀌었습니다. 다시 저장해 주세요.' : `GitHub 에 저장하지 못했습니다. (${move.status})` });
    return String(c.html_url ?? '');
  };
  const headSha = async (): Promise<string | null> => {
    const ref = await api(`/git/ref/heads/${encodeURIComponent(branch)}`);
    return ref.ok ? (await ref.json())?.object?.sha ?? null : null;
  };
  const thumbBase = `${env('SUPABASE_URL')}/storage/v1/object/public/post-thumbs/`;
  const isThumb = (u: string | null) => !!u && u.startsWith(thumbBase) && /^[A-Za-z0-9._\/-]+$/.test(u.slice(thumbBase.length));

  // 결과물 썸네일을 그 페이지의 링크 미리보기 그림으로
  if (body.action === 'sync_thumbs') {
    const key = env('SUPABASE_ANON_KEY') || req.headers.get('apikey') || '';
    const pr = await http(`${env('SUPABASE_URL')}/rest/v1/posts?kind=eq.showcase&hidden=eq.false&url=not.is.null&select=url,thumb_url,title,created_at&order=created_at.desc&limit=2000`,
      { headers: { apikey: key, Authorization: auth } });
    if (!pr.ok) return reply(req, 502, { error: '결과물 목록을 읽지 못했습니다.' });
    const want = new Map<string, { image: string; alt: string }>();
    for (const r of await pr.json() as { url: string; thumb_url: string | null; title: string }[]) {
      const page = pageOfUrl(r.url);
      if (page && !want.has(page) && r.thumb_url && isThumb(r.thumb_url)) want.set(page, { image: r.thumb_url, alt: clean(r.title, 120) });
    }
    let common: { image: string; alt: string } | null = null;
    try {
      const sr = await http(`${env('SUPABASE_URL')}/rest/v1/site_settings?key=eq.share&select=value`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      const v = sr.ok ? (await sr.json())?.[0]?.value : null;
      if (v && typeof v.image === 'string' && v.image) common = { image: v.image, alt: clean(v.alt, 120) };
    } catch { /* 공통 그림 없음 → 되돌리지 않음 */ }
    const pages = await listPages();
    const head = await headSha();
    if (!pages || !head) return reply(req, 502, { error: 'GitHub 에서 페이지 목록을 읽지 못했습니다. 토큰 권한을 확인해 주세요.' });
    const files: { path: string; text: string }[] = [];
    for (const p of pages) {
      if (!SUB.test(p.page)) continue;
      const r = await api(`/contents/${p.file}?ref=${encodeURIComponent(head)}`, {}, 'application/vnd.github.raw');
      if (!r.ok) continue;
      const html = await r.text();
      const cur = readMeta(html, 'og:image');
      const w = want.get(p.page);
      let next = html;
      try {
        if (w) next = applyShare(html, p.page, w.image, w.alt, false);
        else if (cur && isThumb(unesc(cur)) && common) next = applyShare(html, p.page, common.image, common.alt, true);
      } catch { continue; }
      if (next !== html) files.push({ path: p.file, text: next });
    }
    if (!files.length) return reply(req, 200, { ok: true, changed: false, thumbs: want.size });
    const out = await commitAll(head, files, `링크 미리보기 그림: 결과물 썸네일 ${files.length}곳 맞춤`);
    if (out instanceof Response) return out;
    return reply(req, 200, { ok: true, changed: true, count: files.length, thumbs: want.size, commit: out || null });
  }

  if (body.action === 'list') {
    const pages = await listPages();
    if (!pages) return reply(req, 502, { error: 'GitHub 에서 페이지 목록을 읽지 못했습니다. 토큰 권한을 확인해 주세요.' });
    return reply(req, 200, { ok: true, pages: pages.map((p) => p.page).sort() });
  }
  const alt = clean(body.image_alt, 120);
  let image = clean(body.image, 1000);
  if (image.startsWith('/assets/')) image = SITE + image;
  const storage = `${env('SUPABASE_URL')}/storage/v1/object/public/share-images/`;
  const imageOk = !image || /^https:\/\/teambypass\.vercel\.app\/assets\/[A-Za-z0-9._\/-]+$/.test(image)
    || (image.startsWith(storage) && /^[A-Za-z0-9._\/-]+$/.test(image.slice(storage.length)));
  if (!imageOk) return reply(req, 400, { error: '그림은 HQ 에서 올린 그림이나 사이트의 /assets/ 그림만 쓸 수 있습니다.' });
  const name = user?.user_metadata?.display_name || user?.user_metadata?.username || '운영진';

  // 2-1) 모든 페이지에 같은 그림 — 한 번의 커밋으로 (배포도 한 번)
  if (body.action === 'apply_all') {
    if (!image) return reply(req, 400, { error: '그림을 골라 주세요.' });
    const pages = await listPages();
    if (!pages) return reply(req, 502, { error: 'GitHub 에서 페이지 목록을 읽지 못했습니다. 토큰 권한을 확인해 주세요.' });
    const head = await headSha();
    if (!head) return reply(req, 502, { error: 'GitHub 에서 브랜치를 읽지 못했습니다.' });
    const files: { path: string; text: string }[] = [];
    const skipped: string[] = [];
    let kept = 0;
    for (const p of pages) {
      // 1MB 넘는 파일도 읽히게 원문 그대로 받는다
      const r = await api(`/contents/${p.file}?ref=${encodeURIComponent(head)}`, {}, 'application/vnd.github.raw');
      if (!r.ok) { skipped.push(p.page); continue; }
      const html = await r.text();
      // 결과물 썸네일을 쓰는 페이지는 그 그림을 그대로 둔다
      const cur = readMeta(html, 'og:image');
      if (cur && isThumb(unesc(cur))) { kept++; continue; }
      let next: string;
      try { next = applyShare(html, p.page, image, alt); } catch { skipped.push(p.page); continue; }
      if (next !== html) files.push({ path: p.file, text: next });
    }
    if (!files.length) return reply(req, 200, { ok: true, changed: false, pages: pages.length, kept, skipped });
    const out = await commitAll(head, files, `링크 미리보기 그림: 모든 페이지 ${files.length}곳 (${name})`);
    if (out instanceof Response) return out;
    return reply(req, 200, { ok: true, changed: true, count: files.length, pages: pages.length, kept, skipped, commit: out || null });
  }

  // 2-2) 한 페이지
  const page = body.page ?? '';
  const file = fileOf(page);
  if (!file) return reply(req, 400, { error: '고칠 수 없는 페이지입니다.' });
  const title = clean(body.title, 90);
  const description = clean(body.description, 200);
  if (!title) return reply(req, 400, { error: '제목을 입력해 주세요.' });
  if (!description) return reply(req, 400, { error: '설명을 입력해 주세요.' });

  // 3) GitHub 에서 지금 HTML 을 읽어 태그만 바꾸고 저장
  const gh = (url: string, init: RequestInit = {}) => api(`/contents/${file}${url}`, init);
  const cur = await gh(`?ref=${encodeURIComponent(branch)}`);
  if (!cur.ok) return reply(req, 502, { error: `GitHub 에서 페이지를 읽지 못했습니다. (${cur.status}) 토큰 권한을 확인해 주세요.` });
  const meta = await cur.json();
  let html: string;
  try {
    if (meta.content) html = fromBase64(meta.content);
    else {   // 1MB 가 넘으면 내용이 비어 온다 → 원문으로 다시
      const raw = await api(`/contents/${file}?ref=${encodeURIComponent(branch)}`, {}, 'application/vnd.github.raw');
      if (!raw.ok) throw new Error('raw');
      html = await raw.text();
    }
  } catch { return reply(req, 502, { error: '페이지 내용을 읽지 못했습니다.' }); }

  let next = html;
  try {
    next = setMeta(next, 'og:title', title);
    next = setMeta(next, 'og:description', description);
    if (image) {
      next = setMeta(next, 'og:image', image);
      if (alt) next = setMeta(next, 'og:image:alt', alt);
    }
    next = ensureName(next, 'twitter:card', 'summary_large_image');
  } catch { return reply(req, 500, { error: '페이지에서 미리보기 태그 자리를 찾지 못했습니다.' }); }
  if (next === html) return reply(req, 200, { ok: true, changed: false });

  const put = await gh('', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `링크 미리보기 고침: ${page} (${name})`, content: toBase64(next), branch, sha: meta.sha }),
  });
  if (!put.ok) {
    if (put.status === 409) return reply(req, 409, { error: '그사이 페이지가 바뀌었습니다. 다시 저장해 주세요.' });
    return reply(req, 502, { error: `GitHub 에 저장하지 못했습니다. (${put.status})` });
  }
  const saved = await put.json();
  return reply(req, 200, { ok: true, changed: true, commit: saved?.commit?.html_url ?? null });
}

if (!Deno.env.get('BYPASS_TEST')) Deno.serve((req) => handle(req));
