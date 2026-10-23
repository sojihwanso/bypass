// BYPASS 위키 올리기 (Supabase Edge Function: publish-wiki)
//
// 운영진이 HQ(지름길 추가) 또는 공사장에서 HTML 파일을 올리면, 이 함수가 GitHub 저장소의
// wiki/<주소이름>/index.html (위키) 또는 apps/<주소이름>/index.html (앱 등) 로 대신 저장(커밋)합니다. 저장되면 Vercel 이 자동으로 배포합니다.
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
const SLUG_RULE = /^[a-z0-9][a-z0-9-]{1,48}$/;   // 주소에 쓰일 영문 이름: navigation-101
const MAX_BYTES = 1_500_000;                      // 한 장 최대 약 1.5MB
const FOLDERS = ['wiki', 'apps'];                 // 올릴 수 있는 폴더 (vercel.json 에서 둘 다 sandbox 로 열림)

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
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
  if (user?.app_metadata?.bypass_role !== 'staff') return reply(req, 403, { error: '운영진만 파일을 올릴 수 있습니다.' });

  // 2) 올린 내용 확인
  let body: { slug?: string; title?: string; html?: string; folder?: string };
  try { body = await req.json(); } catch { return reply(req, 400, { error: '올린 내용을 읽지 못했습니다.' }); }
  const slug = (body.slug ?? '').trim().toLowerCase();
  const title = (body.title ?? '').trim().slice(0, 100) || slug;
  const html = body.html ?? '';
  const folder = body.folder ?? 'wiki';
  if (!FOLDERS.includes(folder)) return reply(req, 400, { error: '올릴 수 없는 폴더입니다.' });
  if (!SLUG_RULE.test(slug)) return reply(req, 400, { error: '주소 이름은 영문 소문자·숫자·하이픈(-)으로 2~49자여야 합니다. 예: navigation-101' });
  if (!/<html[\s>]/i.test(html)) return reply(req, 400, { error: 'HTML 파일이 아닌 것 같습니다. <html> 로 된 파일을 올려 주세요.' });
  if (new TextEncoder().encode(html).length > MAX_BYTES) return reply(req, 413, { error: '파일이 너무 큽니다. 1.5MB 이하로 올려 주세요.' });

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
  const existing = await gh(`?ref=${encodeURIComponent(branch)}`);
  if (existing.ok) sha = (await existing.json()).sha;
  else if (existing.status !== 404) return reply(req, 502, { error: `GitHub 에 접속하지 못했습니다. (${existing.status}) 토큰 권한을 확인해 주세요.` });

  const name = user?.user_metadata?.display_name || user?.user_metadata?.username || '운영진';
  const put = await gh('', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `${folder === 'wiki' ? '위키' : '페이지'} ${sha ? '고침' : '올림'}: ${title} (/${folder}/${slug}/, ${name})`,
      content: toBase64(html),
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
