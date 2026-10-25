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

const ALLOWED_ORIGINS = [
  'https://teambypass.vercel.app',
  'https://bypass-three.vercel.app',
];
// 브랜치 미리보기 주소(https://bypass-git-<브랜치>-oojoo1.vercel.app)에서도 시험할 수 있게
const PREVIEW_ORIGIN = /^https:\/\/bypass-git-[a-z0-9-]+-oojoo1\.vercel\.app$/;

// 고칠 수 있는 페이지 (주소 → 저장소 파일). 이 밖의 파일은 건드리지 않는다
export const PAGES: Record<string, string> = {
  '/': 'index.html',
  '/routes/': 'routes/index.html',
  '/dockets/': 'dockets/index.html',
  '/tools/alfa-to-zulu/': 'tools/alfa-to-zulu/index.html',
};
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

// <meta property="og:title" content="…"> 의 content 만 바꾼다. 없으면 og 태그 묶음 끝(없으면 </head> 앞)에 넣는다
export function setMeta(html: string, prop: string, value: string): string {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta\\s+property="${esc}"\\s+content="[^"]*"\\s*\\/?>`, 'i');
  const tag = `<meta property="${prop}" content="${attr(value)}">`;
  if (re.test(html)) return html.replace(re, tag);
  const head = html.search(/<\/head>/i);
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
  if (user?.app_metadata?.bypass_role !== 'staff') return reply(req, 403, { error: '운영진만 고칠 수 있습니다.' });

  // 2) 고칠 내용 확인
  let body: { page?: string; title?: string; description?: string; image?: string; image_alt?: string };
  try { body = await req.json(); } catch { return reply(req, 400, { error: '보낸 내용을 읽지 못했습니다.' }); }
  const page = body.page ?? '';
  const file = PAGES[page];
  if (!file) return reply(req, 400, { error: '고칠 수 없는 페이지입니다.' });
  const title = clean(body.title, 90);
  const description = clean(body.description, 200);
  const alt = clean(body.image_alt, 120);
  let image = clean(body.image, 1000);
  if (!title) return reply(req, 400, { error: '제목을 입력해 주세요.' });
  if (!description) return reply(req, 400, { error: '설명을 입력해 주세요.' });
  if (image.startsWith('/assets/')) image = SITE + image;
  const storage = `${env('SUPABASE_URL')}/storage/v1/object/public/share-images/`;
  const imageOk = !image || /^https:\/\/teambypass\.vercel\.app\/assets\/[A-Za-z0-9._\/-]+$/.test(image)
    || (image.startsWith(storage) && /^[A-Za-z0-9._\/-]+$/.test(image.slice(storage.length)));
  if (!imageOk) return reply(req, 400, { error: '그림은 HQ 에서 올린 그림이나 사이트의 /assets/ 그림만 쓸 수 있습니다.' });

  // 3) GitHub 에서 지금 HTML 을 읽어 태그만 바꾸고 저장
  const token = env('GITHUB_TOKEN');
  if (!token) return reply(req, 500, { error: '링크 미리보기 설정이 아직 끝나지 않았습니다. (GITHUB_TOKEN 없음)' });
  const repo = env('GITHUB_REPO') || 'sojihwanso/bypass';
  const branch = env('GITHUB_BRANCH') || 'main';
  const gh = (url: string, init: RequestInit = {}) => http(`https://api.github.com/repos/${repo}/contents/${file}${url}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'bypass-publish-meta', ...(init.headers ?? {}) },
  });
  const cur = await gh(`?ref=${encodeURIComponent(branch)}`);
  if (!cur.ok) return reply(req, 502, { error: `GitHub 에서 페이지를 읽지 못했습니다. (${cur.status}) 토큰 권한을 확인해 주세요.` });
  const meta = await cur.json();
  let html: string;
  try { html = fromBase64(meta.content ?? ''); } catch { return reply(req, 502, { error: '페이지 내용을 읽지 못했습니다.' }); }

  let next = html;
  try {
    next = setMeta(next, 'og:title', title);
    next = setMeta(next, 'og:description', description);
    if (image) {
      next = setMeta(next, 'og:image', image);
      if (alt) next = setMeta(next, 'og:image:alt', alt);
    }
  } catch { return reply(req, 500, { error: '페이지에서 미리보기 태그 자리를 찾지 못했습니다.' }); }
  if (next === html) return reply(req, 200, { ok: true, changed: false });

  const name = user?.user_metadata?.display_name || user?.user_metadata?.username || '운영진';
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
