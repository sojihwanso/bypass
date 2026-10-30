// BYPASS 위키·페이지 올리기 (Supabase Edge Function: publish-wiki)
//
// HTML 파일을 GitHub 저장소의 wiki/<주소이름>/index.html (위키) 또는 apps/<주소이름>/index.html (앱 등) 로
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
  const path = `${folder}/${slug}/index.html`;
  const gh = (url: string, init: RequestInit = {}) => http(`https://api.github.com/repos/${repo}/contents/${path}${url}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bypass-publish-wiki',
      ...(init.headers ?? {}),
    },
  });

  let sha: string | undefined;
  let owner: string | null = null;
  const existing = await gh(`?ref=${encodeURIComponent(branch)}`);
  if (existing.ok) {
    const meta = await existing.json();
    sha = meta.sha;
    try { owner = ownerOf(fromBase64(meta.content ?? '')); } catch { owner = null; }
  } else if (existing.status !== 404) return reply(req, 502, { error: `GitHub 에 접속하지 못했습니다. (${existing.status}) 토큰 권한을 확인해 주세요.` });

  let content = html;
  if (!staff) {
    // 회원: 남의 페이지(운영진이 올린 것 포함)는 덮어쓰지 않는다
    if (sha && owner !== user.id) return reply(req, 409, { error: '이미 다른 사람이 쓰는 주소입니다. 다른 주소 이름을 정해 주세요.' });
    // 권한·횟수·페이지 수 확인과 기록 (회원 본인의 로그인으로)
    const note = await http(`${env('SUPABASE_URL')}/rest/v1/rpc/note_page_publish`, {
      method: 'POST',
      headers: { apikey: req.headers.get('apikey') || env('SUPABASE_ANON_KEY') || '', Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug, p_title: title, p_new: !sha }),
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
  const put = await gh('', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `${folder === 'wiki' ? '위키' : '페이지'} ${sha ? '고침' : '올림'}: ${title} (/${folder}/${slug}/, ${name})`,
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
  return reply(req, 200, {
    ok: true,
    updated: Boolean(sha),
    url: `/${folder}/${slug}/`,
    commit: saved?.commit?.html_url ?? null,
  });
}

// 테스트할 때(BYPASS_TEST=1)는 서버를 띄우지 않는다
if (!Deno.env.get('BYPASS_TEST')) Deno.serve((req) => handle(req));
