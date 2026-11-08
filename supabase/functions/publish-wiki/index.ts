// BYPASS 위키·페이지 올리기 (Supabase Edge Function: publish-wiki)
//
// HTML 파일을 GitHub 저장소의 wiki/<주소이름>/index.html (위키) 또는 apps/<주소이름>/app.html (앱 등, 진도 저장 껍데기 포함) 로
// 대신 저장(커밋)합니다. 저장되면 Vercel 이 자동으로 배포합니다.
//
// 누가 올리나
//   - 운영진: HQ 에서 wiki·apps 어디든 (덮어쓰기 포함)
//   - 올리기 권한이 있는 회원 (supabase/023_member_uploads.sql 의 can_upload): 커뮤니티에서 apps 에만.
//     처음 쓰는 주소이거나 자기가 올린 페이지만 고칠 수 있다. 주인은 파일 안의 <meta name="bypass-owner"> 로 확인한다.
//     권한·한 시간 10번·한 사람 페이지 수는 데이터베이스 함수 note_page_publish 가 회원의 로그인으로 확인한다.
//
// 필요한 비밀 값 (Supabase 대시보드 → Edge Functions → Secrets)
//   GITHUB_TOKEN  : 이 저장소의 Contents 읽기·쓰기 권한만 가진 GitHub 토큰 (fine-grained)
//   GITHUB_REPO   : sojihwanso/bypass   (없으면 이 값을 씀)
//   GITHUB_BRANCH : main                (없으면 이 값을 씀)
// SUPABASE_URL 은 Supabase 가 자동으로 넣어 줍니다. 로그인 확인에 쓰는 공개 키는 사이트가 함께 보내는 apikey 를 쓰고,
// 없으면 SUPABASE_ANON_KEY 를 씁니다. (새 publishable 키를 쓰는 프로젝트에서도 동작하도록)
//
// 대시보드의 'Verify JWT'(JWT 검증)는 꺼도 됩니다. 이 함수가 /auth/v1/user 로 직접 로그인과 운영진 여부를 확인합니다.

const ALLOWED_ORIGINS = [
  'https://teambypass.vercel.app',
  'https://bypass-three.vercel.app',
];
// 브랜치 미리보기 주소(https://bypass-git-<브랜치>-oojoo1.vercel.app)에서도 시험할 수 있게
const PREVIEW_ORIGIN = /^https:\/\/bypass-git-[a-z0-9-]+-oojoo1\.vercel\.app$/;
const SLUG_RULE = /^[a-z0-9][a-z0-9-]{1,48}$/;   // 주소에 쓰일 영문 이름: navigation-101
const MAX_BYTES = 5_000_000;                      // 한 장 최대 약 5MB
const FOLDERS = ['wiki', 'apps'];                 // 올릴 수 있는 폴더 (vercel.json 에서 둘 다 sandbox 로 열림)

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function reply(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// UTF-8 문자열 → base64 (GitHub API 는 파일 내용을 base64 로 받는다)
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// 페이지 주인 표시: <meta name="bypass-owner" content="회원번호">
const OWNER_META = /<meta\s+name=["']bypass-owner["'][^>]*>\s*/gi;
export function ownerOf(html: string): string | null {
  const m = html.match(/<meta\s+name=["']bypass-owner["']\s+content=["']([0-9a-f-]{36})["']/i);
  return m ? m[1] : null;
}
// 올린 사람이 넣은 주인 표시는 지우고 진짜 주인을 <head> 바로 뒤(없으면 <html> 뒤, 그것도 없으면 맨 앞)에 넣는다
export function stampOwner(html: string, uid: string): string {
  const tag = `<meta name="bypass-owner" content="${uid}">`;
  const clean = html.replace(OWNER_META, '');
  const head = clean.match(/<head[^>]*>/i);
  if (head && head.index !== undefined) { const at = head.index + head[0].length; return clean.slice(0, at) + '\n' + tag + clean.slice(at); }
  const root = clean.match(/<html[^>]*>/i);
  if (root && root.index !== undefined) { const at = root.index + root[0].length; return clean.slice(0, at) + '\n' + tag + clean.slice(at); }
  return tag + '\n' + clean;
}
// ===== /apps/ 껍데기 =====
// /apps/<이름>/ 은 껍데기(index.html)가 열리고, 올린 HTML 은 같은 폴더 app.html 에 둔다.
// 껍데기(/assets/app-shell.js)가 app.html 을 칸막이 iframe 에 띄우고, 앱의 localStorage 를 받아
// 로그인한 사람은 계정(app_progress 표)에, 아니면 그 브라우저에 진도를 저장한다. (supabase/025_app_progress.sql)
// 여러 파일로 된 예전 앱은 예전 방식(index.html 에 그대로)으로 둔다.
const RAW_APPS = ['ecdis', 'cbttest'];
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
export const isShell = (html: string) => html.includes('/assets/app-shell.js');
export function makeShell(slug: string, html: string): string {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html.slice(0, 20000);
  const t = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = esc(unesc(t ? t[1] : slug).trim().slice(0, 100) || slug);
  // 링크 미리보기용 설명·og 태그만 옮겨 담는다 (새로 만들어서 — 다른 속성은 버린다)
  const metas: string[] = [];
  for (const m of head.matchAll(/<meta\s+[^>]*>/gi)) {
    const k = m[0].match(/\b(name|property)\s*=\s*["']([^"']+)["']/i);
    const c = m[0].match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (!k || !c) continue;
    const key = k[2].toLowerCase();
    if (!(key === 'description' || key.startsWith('og:') || key.startsWith('twitter:')) || !/^[a-z:_-]{1,40}$/.test(key)) continue;
    metas.push(`<meta ${k[1].toLowerCase()}="${key}" content="${esc(unesc(c[1]).slice(0, 300))}">`);
    if (metas.length >= 12) break;
  }
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
${metas.length ? metas.join('\n') + '\n' : ''}<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<style>
html,body{margin:0;height:100%;background:#fff}
iframe{position:fixed;inset:0;width:100%;height:100%;border:0;display:block}
.bp-chip{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2;max-width:calc(100% - 24px);padding:7px 12px;border-radius:99px;background:rgba(30,26,22,.88);color:#fff;font:600 12.5px/1.3 -apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.18);transition:opacity .5s,transform .5s}
.bp-chip.bp-out{opacity:0;transform:translateY(8px);pointer-events:none}
</style>
</head>
<body>
<!-- BYPASS 앱 껍데기: 실제 앱은 같은 폴더의 app.html 입니다. 진도 저장은 /assets/app-shell.js 가 맡습니다. -->
<script src="/assets/vendor/supabase-js-2.117.2.js"></script>
<script src="/assets/auth.js"></script>
<script src="/assets/app-shell.js" data-app="${slug}"></script>
</body>
</html>
`;
}

const NOTE_ERRORS: Record<string, [number, string]> = {
  'upload not allowed': [403, '아직 올리기 권한이 없습니다. 커뮤니티 › 내 정보에서 요건을 확인해 주세요.'],
  'too many publishes': [429, '한 시간에 10번까지 올릴 수 있습니다. 잠시 후 다시 올려 주세요.'],
  'too many pages': [403, '올릴 수 있는 페이지 수를 넘었습니다. 운영진에게 문의해 주세요.'],
  'bad slug': [400, '주소 이름은 영문 소문자·숫자·하이픈(-)으로 2~49자여야 합니다.'],
};

export async function handle(req: Request, env: (k: string) => string | undefined = (k) => Deno.env.get(k), http: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reply(req, 405, { error: 'POST 로만 올릴 수 있습니다.' });

  // 1) 누가 올리는지 확인: 로그인한 운영진만
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return reply(req, 401, { error: '로그인이 필요합니다.' });
  const who = await http(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: req.headers.get('apikey') || env('SUPABASE_ANON_KEY') || '', Authorization: auth },
  });
  if (!who.ok) return reply(req, 401, { error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' });
  const user = await who.json();
  const staff = user?.app_metadata?.bypass_role === 'staff';

  // 2) 올린 내용 확인
  let body: { slug?: string; title?: string; html?: string; folder?: string };
  try { body = await req.json(); } catch { return reply(req, 400, { error: '올린 내용을 읽지 못했습니다.' }); }
  const slug = (body.slug ?? '').trim().toLowerCase();
  const title = (body.title ?? '').trim().slice(0, 100) || slug;
  const html = body.html ?? '';
  const folder = body.folder ?? 'wiki';
  if (!FOLDERS.includes(folder)) return reply(req, 400, { error: '올릴 수 없는 폴더입니다.' });
  if (!staff && folder !== 'apps') return reply(req, 403, { error: '회원은 /apps/ 에만 올릴 수 있습니다.' });
  if (!SLUG_RULE.test(slug)) return reply(req, 400, { error: '주소 이름은 영문 소문자·숫자·하이픈(-)으로 2~49자여야 합니다. 예: navigation-101' });
  if (!/<html[\s>]/i.test(html)) return reply(req, 400, { error: 'HTML 파일이 아닌 것 같습니다. <html> 로 된 파일을 올려 주세요.' });
  if (new TextEncoder().encode(html).length > MAX_BYTES) return reply(req, 413, { error: '파일이 너무 큽니다. 5MB 이하로 올려 주세요.' });

  // 3) GitHub 에 저장 (있으면 고쳐 쓰기)
  const token = env('GITHUB_TOKEN');
  if (!token) return reply(req, 500, { error: '위키 올리기 설정이 아직 끝나지 않았습니다. (GITHUB_TOKEN 없음)' });
  const repo = env('GITHUB_REPO') || 'sojihwanso/bypass';
  const branch = env('GITHUB_BRANCH') || 'main';
  // 앱(/apps/)은 올린 HTML 을 app.html 에, 껍데기를 index.html 에 둔다 (위 makeShell 참고)
  const shelled = folder === 'apps' && !RAW_APPS.includes(slug);
  const dir = `${folder}/${slug}`;
  const path = shelled ? `${dir}/app.html` : `${dir}/index.html`;
  const gh = (file: string, url: string, init: RequestInit = {}) => http(`https://api.github.com/repos/${repo}/contents/${file}${url}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bypass-publish-wiki',
      ...(init.headers ?? {}),
    },
  });
  const look = async (file: string): Promise<{ sha?: string; text?: string; fail?: number }> => {
    const r = await gh(file, `?ref=${encodeURIComponent(branch)}`);
    if (r.status === 404) return {};
    if (!r.ok) return { fail: r.status };
    const meta = await r.json();
    let text: string | undefined;
    try { text = fromBase64(meta.content ?? ''); } catch { text = undefined; }
    return { sha: meta.sha, text };
  };

  let sha: string | undefined;
  let owner: string | null = null;
  const existing = await look(path);
  if (existing.fail) return reply(req, 502, { error: `GitHub 에 접속하지 못했습니다. (${existing.fail}) 토큰 권한을 확인해 주세요.` });
  sha = existing.sha;
  if (existing.text) owner = ownerOf(existing.text);
  // 껍데기를 쓰기 전에 올라간 예전 페이지: index.html 에 앱이 그대로 있다 → 그 주인을 이어받는다
  let index: { sha?: string; text?: string; fail?: number } = {};
  if (shelled) {
    index = await look(`${dir}/index.html`);
    if (index.fail) return reply(req, 502, { error: `GitHub 에 접속하지 못했습니다. (${index.fail}) 토큰 권한을 확인해 주세요.` });
    if (!sha && index.sha && index.text && !isShell(index.text)) owner = ownerOf(index.text);
  }
  const taken = Boolean(sha || (shelled && index.sha));   // 이미 누가 쓰는 주소인가

  let content = html;
  if (!staff) {
    // 회원: 남의 페이지(운영진이 올린 것 포함)는 덮어쓰지 않는다
    if (taken && owner !== user.id) return reply(req, 409, { error: '이미 다른 사람이 쓰는 주소입니다. 다른 주소 이름을 정해 주세요.' });
    // 권한·횟수·페이지 수 확인과 기록 (회원 본인의 로그인으로)
    const note = await http(`${env('SUPABASE_URL')}/rest/v1/rpc/note_page_publish`, {
      method: 'POST',
      headers: { apikey: req.headers.get('apikey') || env('SUPABASE_ANON_KEY') || '', Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug, p_title: title, p_new: !taken }),
    });
    if (!note.ok) {
      let msg = '';
      try { msg = (await note.json())?.message ?? ''; } catch { /* 빈 응답 */ }
      if (note.status === 404) return reply(req, 500, { error: '올리기 권한 설정이 아직 끝나지 않았습니다. (supabase/023_member_uploads.sql 필요)' });
      const known = NOTE_ERRORS[msg];
      return reply(req, known ? known[0] : 403, { error: known ? known[1] : '올리기 권한을 확인하지 못했습니다.' });
    }
    content = stampOwner(html, user.id);
  } else if (owner) {
    content = stampOwner(html, owner);   // 운영진이 회원 페이지를 고쳐도 주인은 그대로
  }

  const name = user?.user_metadata?.display_name || user?.user_metadata?.username || (staff ? '운영진' : '회원');
  const put = await gh(path, '', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `${folder === 'wiki' ? '위키' : '페이지'} ${taken ? '고침' : '올림'}: ${title} (/${folder}/${slug}/, ${name})`,
      content: toBase64(content),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!put.ok) {
    const detail = await put.text();
    return reply(req, 502, { error: `GitHub 에 저장하지 못했습니다. (${put.status})`, detail: detail.slice(0, 300) });
  }
  const saved = await put.json();
  // 껍데기(index.html): 없거나, 제목·설명이 바뀌었거나, 예전 방식 페이지면 새로 쓴다
  if (shelled) {
    const shell = makeShell(slug, content);
    if (index.text !== shell) {
      const sp = await gh(`${dir}/index.html`, '', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `페이지 껍데기: ${title} (/${folder}/${slug}/, 진도 저장)`,
          content: toBase64(shell),
          branch,
          ...(index.sha ? { sha: index.sha } : {}),
        }),
      });
      if (!sp.ok) {
        const detail = await sp.text();
        return reply(req, 502, { error: `파일은 올렸지만 페이지 껍데기를 저장하지 못했습니다. 다시 올려 주세요. (${sp.status})`, detail: detail.slice(0, 300) });
      }
    }
  }
  return reply(req, 200, {
    ok: true,
    updated: taken,
    url: `/${folder}/${slug}/`,
    commit: saved?.commit?.html_url ?? null,
  });
}

// 테스트할 때(BYPASS_TEST=1)는 서버를 띄우지 않는다
if (!Deno.env.get('BYPASS_TEST')) Deno.serve((req) => handle(req));
