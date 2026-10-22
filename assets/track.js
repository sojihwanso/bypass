/* BYPASS 방문·이용 기록 (HQ 통계용)
   - 공개 페이지를 열 때 한 줄, 지름길 '이용하기'를 누를 때 한 줄을 Supabase stats_events 표에 남긴다.
   - 남기는 것: 종류(view | go), 페이지 경로, 지름길 번호. 이름·아이디 같은 개인 정보는 남기지 않는다.
   - 미리보기 주소(…-git-…vercel.app)와 내 컴퓨터(localhost)에서는 남기지 않는다. */
(function () {
  const URL = 'https://itzdjdgjqcpmxdfssfel.supabase.co/rest/v1/stats_events';
  const KEY = 'sb_publishable_L2FP31VpA_dZfwqH4u6H0Q_UWJlCS6G';
  const host = location.hostname;
  const off = host === 'localhost' || /^127\./.test(host) || host.includes('-git-')
    || /bot|crawl|spider|preview|scrap|facebookexternalhit/i.test(navigator.userAgent);

  function send(row) {
    if (off) return;
    try {
      fetch(URL, {
        method: 'POST', keepalive: true,
        headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row)
      }).catch(() => {});
    } catch (e) { /* 기록 실패는 무시 */ }
  }

  const page = location.pathname.slice(0, 200);
  window.BYPASS_TRACK = {
    go(routeId) { send({ kind: 'go', page, route_id: /^\d+$/.test(String(routeId)) ? Number(routeId) : null }); }
  };
  send({ kind: 'view', page });
})();
