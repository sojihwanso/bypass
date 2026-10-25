/* BYPASS 페이지 문구: 설치 규정 · 업무 범위(금지 항목) · 문의 창구 · 최종 개정일
   - 메인(index.html)은 HTML에 적힌 문구를 먼저 보여 주고, HQ › 페이지 문구에서 고친 값(site_settings 'texts')이 오면 바꿔 끼운다.
   - HQ는 데이터베이스에 아직 값이 없으면 메인 HTML을 읽어(parse) 지금 문구에서 시작한다.
   모양:
   { statute: { enacted: '2026. 10. 19.', revised: '2026-11-02' | null,
                articles: [{ title: '제1조(목적)', body: '…', items: [{ term: '중복 입력', text: '…', example: '예: …' }] }] },
     scope:   { article: '이 국은 …', lead: '다음 안건은 접수하지 않습니다.', items: [{ text: '…', example: '(예: …)' }] },
     contact: { label: '카카오톡 1:1 오픈채팅 ‘문의 창구’', url: 'https://open.kakao.com/o/…' },
     revised: '2026-11-02' }   ← 바닥글 '최종 개정' (저장할 때 저절로) */
(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const dotDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${y}. ${m}. ${d}.`; };
  const URL_OK = (u) => /^https:\/\/[^\s"<>]+$/i.test(u || '');

  // 메인 HTML → 문구 (HQ 처음 값)
  function parse(doc) {
    const body = doc.querySelector('[data-statute]');
    const date = txt(doc.querySelector('[data-rule-date]')).match(/제정\s*([^,\]]+)/);
    const articles = body ? [...body.querySelectorAll(':scope > .article')].map((a) => {
      const title = txt(a.querySelector('.article-no'));
      const ps = [...a.querySelectorAll('p')];
      const items = [...a.querySelectorAll('.items > li')].map((li) => {
        const ex = li.querySelector('.example');
        const term = txt(li.querySelector('strong'));
        const clone = li.cloneNode(true);
        clone.querySelectorAll('strong, .example').forEach((x) => x.remove());
        return { term, text: txt(clone).replace(/^[:：]\s*/, ''), example: txt(ex) };
      });
      return { title, body: ps.map(txt).join('\n'), items };
    }) : [];
    const ban = doc.querySelector('[data-ban]');
    const art = ban && ban.querySelector('.ban-article p');
    let article = '';
    if (art) { const c = art.cloneNode(true); c.querySelectorAll('b').forEach((x) => x.remove()); article = txt(c); }
    const items = ban ? [...ban.querySelectorAll('.ban-list > li')].map((li) => {
      const ex = li.querySelector('.example');
      const c = li.cloneNode(true); c.querySelectorAll('.example, svg').forEach((x) => x.remove());
      return { text: txt(c), example: txt(ex) };
    }) : [];
    const a = doc.querySelector('[data-foot-contact]');
    let label = '';
    if (a) { const c = a.cloneNode(true); c.querySelectorAll('.sr-only').forEach((x) => x.remove()); label = txt(c); }
    return clean({
      statute: { enacted: date ? date[1].trim() : '', revised: null, articles },
      scope: { article, lead: txt(ban && ban.querySelector('.ban-lead')), items },
      contact: { label, url: a ? a.getAttribute('href') : '' },
      revised: null,
    });
  }

  // 받은 값이 이상해도 화면이 깨지지 않게 다듬는다
  function clean(v) {
    const o = v && typeof v === 'object' ? v : {};
    const st = o.statute && typeof o.statute === 'object' ? o.statute : {};
    const sc = o.scope && typeof o.scope === 'object' ? o.scope : {};
    const ct = o.contact && typeof o.contact === 'object' ? o.contact : {};
    const arr = (x) => (Array.isArray(x) ? x : []);
    return {
      statute: {
        enacted: str(st.enacted, 30),
        revised: ISO.test(st.revised || '') ? st.revised : null,
        articles: arr(st.articles).slice(0, 30).map((a) => ({
          title: str(a && a.title, 60), body: str(a && a.body, 600),
          items: arr(a && a.items).slice(0, 20).map((i) => ({ term: str(i && i.term, 40), text: str(i && i.text, 300), example: str(i && i.example, 200) })).filter((i) => i.term || i.text),
        })).filter((a) => a.title || a.body),
      },
      scope: {
        article: str(sc.article, 300), lead: str(sc.lead, 120),
        items: arr(sc.items).slice(0, 20).map((i) => ({ text: str(i && i.text, 200), example: str(i && i.example, 200) })).filter((i) => i.text),
      },
      contact: { label: str(ct.label, 80), url: URL_OK(ct.url) ? ct.url.trim() : '' },
      revised: ISO.test(o.revised || '') ? o.revised : null,
    };
  }

  const banIcon = () => { const s = document.createElementNS(SVG_NS, 'svg'); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS(SVG_NS, 'use'); u.setAttribute('href', '#ban'); s.append(u); return s; };
  const lines = (el, text) => { String(text).split('\n').forEach((l, i) => { if (i) el.append(document.createElement('br')); el.append(l); }); };
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // 문구 → 메인 화면 (빈 칸은 HTML 그대로 둔다)
  function apply(doc, value) {
    const t = clean(value);
    const body = doc.querySelector('[data-statute]');
    if (body && t.statute.articles.length) {
      body.querySelectorAll(':scope > .article').forEach((x) => x.remove());
      t.statute.articles.forEach((a) => {
        const div = mk('div', 'article');
        div.append(mk('span', 'article-no', a.title));
        if (a.items.length) {
          const wrap = mk('div');
          if (a.body) a.body.split('\n').forEach((p) => wrap.append(mk('p', null, p)));
          const ol = mk('ol', 'items');
          a.items.forEach((i) => {
            const li = mk('li'), sp = mk('span');
            if (i.term) sp.append(mk('strong', null, i.term), i.text ? `: ${i.text}` : '');
            else sp.append(i.text);
            if (i.example) sp.append(mk('span', 'example', i.example));
            li.append(sp); ol.append(li);
          });
          wrap.append(ol); div.append(wrap);
        } else {
          const p = mk('p'); lines(p, a.body); div.append(p);
        }
        body.append(div);
      });
    }
    const date = doc.querySelector('[data-rule-date]');
    if (date && t.statute.enacted) date.textContent = `[제정 ${t.statute.enacted}${t.statute.revised ? `, 개정 ${dotDate(t.statute.revised)}` : ''}]`;
    const ban = doc.querySelector('[data-ban]');
    if (ban) {
      const p = ban.querySelector('.ban-article p');
      if (p && t.scope.article) { const b = p.querySelector('b'); p.replaceChildren(); if (b) p.append(b); p.append(t.scope.article); }
      const lead = ban.querySelector('.ban-lead');
      if (lead && t.scope.lead) lead.textContent = t.scope.lead;
      const ul = ban.querySelector('.ban-list');
      if (ul && t.scope.items.length) {
        ul.replaceChildren(...t.scope.items.map((i) => {
          const li = mk('li'), sp = mk('span', null, i.text);
          if (i.example) { const ex = mk('span', 'example'); ex.append(document.createElement('br'), i.example); sp.append(' ', ex); }
          li.append(banIcon(), sp); return li;
        }));
      }
    }
    if (t.contact.url || t.contact.label) {
      const a = doc.querySelector('[data-foot-contact]');
      if (a) {
        if (t.contact.url) a.href = t.contact.url;
        if (t.contact.label) { const sr = a.querySelector('.sr-only'); a.replaceChildren(t.contact.label); if (sr) a.append(sr); }
      }
      if (t.contact.url) doc.querySelectorAll('[data-ask]').forEach((x) => { x.href = t.contact.url; });
    }
    const rev = doc.querySelector('[data-foot-revised]');
    if (rev && t.revised) rev.textContent = dotDate(t.revised);
    return t;
  }

  window.BYPASS_TEXTS = { parse, clean, apply, dotDate };
})();
