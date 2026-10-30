/* BYPASS 회원 메뉴 (고정)
   로그인한 회원이 준공 현황·처리 현황 같은 공개 페이지에 와도, 커뮤니티와 같은 메뉴를 화면 위에 붙여 둔다.
   - 로그인하지 않았으면 아무것도 하지 않는다 (공개 페이지 그대로)
   - Supabase 라이브러리를 불러오지 않고 브라우저에 저장된 로그인 기록만 읽는다 (표시용. 권한은 서버가 따로 확인)
   - 페이지의 다른 sticky 요소(예: .finder)는 메뉴 높이만큼 아래에 붙도록 --mnav-h 를 쓴다
   쓰는 법: <script src="/assets/member-nav.js" data-current="routes" defer></script> */
(function () {
  let s = null;
  try { s = JSON.parse(localStorage.getItem('sb-itzdjdgjqcpmxdfssfel-auth-token') || 'null'); } catch (e) { return; }
  if (!s || !s.refresh_token || !s.user) return;
  const me = document.currentScript;
  const current = (me && me.dataset.current) || '';
  const meta = s.user.user_metadata || {};
  const name = meta.display_name || meta.username || '회원';
  const role = (s.user.app_metadata || {}).bypass_role;
  const crew = role === 'member' || role === 'staff';
  const ini = /^[A-Za-z0-9]/.test(name) ? name[0].toUpperCase() : name.slice(0, 1);

  const css = `
  .mnav { position: sticky; top: 0; z-index: 40; background: rgba(255,255,255,.95); backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px); border-bottom: 1px solid #E6E8EB; font-family: 'Noto Sans KR', system-ui, sans-serif; color: #15171A; }
  .mnav * { box-sizing: border-box; }
  .mnav-in { max-width: 1240px; margin: 0 auto; padding: 0 24px; height: 56px; display: flex; align-items: center; gap: 14px; }
  .mnav-brand { display: flex; align-items: center; gap: 8px; flex: none; color: inherit; text-decoration: none; font-weight: 700; font-size: 15px; }
  .mnav-tabs { display: flex; gap: 2px; flex: 1 1 auto; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .mnav-tabs::-webkit-scrollbar { display: none; }
  .mnav-tabs a { flex: none; padding: 7px 12px; border-radius: 999px; font-size: 14px; font-weight: 500; color: #3F444C; text-decoration: none; white-space: nowrap; }
  .mnav-tabs a:hover { background: #F1F2F4; color: #15171A; }
  .mnav-tabs a[aria-current="page"] { background: #15171A; color: #fff; font-weight: 700; }
  .mnav-tabs .mnav-sep { flex: none; width: 1px; height: 18px; background: #E6E8EB; margin: 9px 4px; }
  .mnav-me { flex: none; width: 36px; height: 36px; border-radius: 999px; background: #DDEBE3; color: #0F5A3A; font-weight: 800; display: grid; place-items: center; text-decoration: none; font-size: 14px; }
  .mnav a:focus-visible { outline: 2px solid #E8590C; outline-offset: 2px; }
  @media (max-width: 640px) { .mnav-in { padding: 0 12px; gap: 8px; } .mnav-brand span { display: none; } }
  body.has-mnav .finder { top: 56px !important; }
  body.has-mnav { scroll-padding-top: 120px; }`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const tabs = [
    ['home', '/community/', '홈'], ['showcase', '/community/#showcase', '결과물'], ['board', '/community/#board', '게시판'],
    crew ? ['meeting', '/community/#meeting', '회의실'] : null, ['me', '/community/#me', '내 정보'],
    'sep', ['routes', '/routes/', '준공 현황'], ['dockets', '/dockets/', '처리 현황'],
  ].filter(Boolean);
  const nav = document.createElement('nav');
  nav.className = 'mnav'; nav.setAttribute('aria-label', '회원 메뉴');
  const inner = document.createElement('div'); inner.className = 'mnav-in';
  const brand = document.createElement('a'); brand.className = 'mnav-brand'; brand.href = '/community/'; brand.setAttribute('aria-label', 'BYPASS 커뮤니티 홈');
  brand.innerHTML = '<svg width="24" height="24" viewBox="0 0 30 30" aria-hidden="true"><rect x="5" y="5" width="20" height="20" rx="4" transform="rotate(45 15 15)" fill="#E8590C"/><path d="M10 17.5h5.5l2-5h3" fill="none" stroke="#15171A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>커뮤니티</span>';
  const list = document.createElement('div'); list.className = 'mnav-tabs';
  tabs.forEach((t) => {
    if (t === 'sep') { const sp = document.createElement('span'); sp.className = 'mnav-sep'; sp.setAttribute('aria-hidden', 'true'); list.appendChild(sp); return; }
    const a = document.createElement('a'); a.href = t[1]; a.textContent = t[2];
    if (t[0] === current) a.setAttribute('aria-current', 'page');
    list.appendChild(a);
  });
  const av = document.createElement('a'); av.className = 'mnav-me'; av.href = '/community/#me'; av.textContent = ini; av.setAttribute('aria-label', `${name} · 내 정보`);
  inner.append(brand, list, av); nav.appendChild(inner);
  const mount = () => {
    const skip = document.querySelector('body > a.skip');
    if (skip) skip.after(nav); else document.body.prepend(nav);
    document.body.classList.add('has-mnav');
    const curA = list.querySelector('[aria-current]'); if (curA) list.scrollLeft = Math.max(0, curA.offsetLeft - 40);
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
