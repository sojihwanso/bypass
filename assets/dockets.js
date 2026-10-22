/* BYPASS 처리 현황 안내판 그리기 (메인 · /dockets/ · HQ 미리보기가 함께 씀)
   - 안건 한 건(dockets 표의 한 줄)을 받아 메인과 똑같은 노변 안내판을 만든다.
   - 모양은 assets/dockets.css. 직인 그림은 이 파일 맨 아래 SEAL_DEFS (index.html 의 직인과 같은 그림).
   - 안건 모양: { id, no, no_note, title, status, old_way, new_way, reason, sample,
                 route: { title, url, status } | null }  ← route 는 연결한 지름길 (숨기면 null) */
(function () {
  const STATUS = {
    building: { name: '공사 중', badge: '공사 중', rows: ['기존 절차', '개선 계획'] },
    done:     { name: '완료',     badge: '개통',    rows: ['기존 절차', '개선 후'] },
    new:      { name: '신설 개통', badge: '신설 개통', rows: ['기존 절차', '개선 후'] },
    rejected: { name: '반려',     badge: '반려',    rows: ['접수 내용', '반려 사유'] }
  };
  const TILTS = [-11, 7, -4, 9, -7, 3];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function ensureDefs() {
    if (document.getElementById('done-seal')) return;
    const holder = document.createElement('div');
    holder.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' + SEAL_DEFS + '</defs></svg>';
    document.body.prepend(holder.firstChild);
  }

  const label = d => `제${d.no}호${d.no_note ? ` (${d.no_note})` : ''}`;
  const isExternal = url => /^https?:\/\//i.test(url || '');
  // 바로가기는 완료·신설 개통 안건에, 연결한 지름길이 개통되어 있을 때만
  const goOf = d => (d.status === 'done' || d.status === 'new') && d.route && d.route.status === 'open' && d.route.url ? d.route : null;

  function seal(kind, tilt) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', kind === 'new' ? 'open-seal' : 'done-seal');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', kind === 'new'
      ? '신설 개통 인장. 이 길은 원래 지도에 없었습니다.'
      : '도도새 처리 완료 직인. 이 업무 방식은 도도새와 함께 멸종했어야 합니다.');
    if (kind !== 'new' && tilt != null) svg.style.setProperty('--r', `${tilt}deg`);
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', kind === 'new' ? '#open-seal' : '#done-seal');
    svg.append(use);
    return svg;
  }

  /* 안내판 한 장 (.board-unit). opts.index: 직인 기울기를 바꾸는 순번, opts.idPrefix: 제목 id 앞글자 */
  function board(d, opts) {
    opts = opts || {};
    ensureDefs();
    const st = STATUS[d.status] || STATUS.building;
    const unit = el('div', 'board-unit');
    const art = el('article', `board board-${d.status in STATUS ? d.status : 'building'}`);
    const hid = `${opts.idPrefix || 'bd'}-${d.id != null ? d.id : 'new'}`;
    art.setAttribute('aria-labelledby', hid);
    const head = el('div', 'board-head');
    const h3 = el('h3', null, d.title || '안건 제목'); h3.id = hid;
    head.append(el('p', 'board-no', label(d)), h3);
    art.append(head, el('span', `badge badge-${d.status in STATUS ? d.status : 'building'}`, st.badge));
    if (d.sample) art.append(el('span', 'specimen', '견본'));
    const dl = el('dl');
    const second = d.status === 'rejected' ? d.reason : d.new_way;
    [[st.rows[0], d.old_way], [st.rows[1], second]].forEach(([dt, dd]) => {
      if (!dd) return;
      const row = el('div'); row.append(el('dt', null, dt), el('dd', null, dd)); dl.append(row);
    });
    if (dl.children.length) art.append(dl);
    const foot = el('div', 'board-foot');
    const go = goOf(d);
    if (go) {
      const a = el('a', 'board-go'); a.href = go.url;
      const ext = isExternal(go.url);
      if (ext) { a.target = '_blank'; a.rel = 'noopener'; }
      const t = el('span', 'go-text'); t.append(el('span', null, '지름길'), el('span', null, '바로가기'));
      a.append(t, el('span', 'sr-only', ` (${go.title || d.title}${ext ? ', 새 창' : ''})`), document.createTextNode(' '));
      const arrow = el('span', null, '→'); arrow.setAttribute('aria-hidden', 'true'); a.append(arrow);
      foot.append(a);
    }
    if (d.status === 'done') foot.append(seal('done', TILTS[(opts.index || 0) % TILTS.length]));
    if (d.status === 'new') foot.append(seal('new'));
    if (d.status === 'building') { const tape = el('div', 'board-tape'); tape.append(el('span', null, '개통 준비 중')); foot.append(tape); }
    art.append(foot);
    const legs = el('div', 'legs'); legs.setAttribute('aria-hidden', 'true');
    unit.append(art, legs);
    return unit;
  }

  // 견본 안건이 있으면 '제0-4호는 견본입니다.' 같은 안내 (없으면 빈 글자)
  function sampleNote(list) {
    const s = list.filter(d => d.sample).map(d => `제${d.no}호`);
    return s.length ? `${s.join('·')}는 견본입니다.` : '';
  }

  // 공개 페이지가 읽는 칸 (지름길은 숨기면 null 로 온다)
  const SELECT = 'id,no,no_note,title,status,old_way,new_way,reason,sample,sort,route:routes(title,url,status)';

  const SEAL_DEFS = `<symbol id="dodo-plain" viewBox="0 0 100 100">
<g fill="currentColor">
<ellipse cx="44" cy="60" rx="27" ry="23"/>
<path d="M51 45 C55 37 58 31 61 25 L72 30 C68 36 66 44 64 53 Z"/>
<circle cx="66" cy="26" r="10"/>
<path d="M72 20 C83 19 93 24 95 32 C96 38 91 41 88 37 C86 34 82 33 74 33 Z"/>
<path d="M19 52 C10 47 7 40 11 34 C14 43 20 46 23 46 Z"/>
<path d="M37 80 L35 92 L27 95 L41 95 L42 81 Z"/>
<path d="M51 80 L51 92 L44 95 L58 95 L56 81 Z"/>
</g>
<circle cx="68" cy="23.5" r="2" fill="#fff"/>
<path d="M32 55 C40 50 51 54 54 64" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
</symbol>
<path id="seal-top" d="M25 100 A75 75 0 0 1 175 100"/>
<path id="seal-bottom" d="M13 100 A87 87 0 0 0 187 100"/>
<filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise"/>
<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 2.15" result="speckle"/>
<feComposite in="SourceGraphic" in2="speckle" operator="in"/>
</filter>
<symbol id="done-seal" viewBox="0 0 200 200">
<g filter="url(#ink)">
<circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" stroke-width="5"/>
<circle cx="100" cy="100" r="64" fill="none" stroke="currentColor" stroke-width="2.5"/>
<text font-size="17.5" font-weight="900" letter-spacing="0.5" text-anchor="middle" fill="currentColor"><textPath href="#seal-top" startOffset="50%">이 업무 방식은 도도새와</textPath></text>
<text font-size="17.5" font-weight="900" letter-spacing="0.5" text-anchor="middle" fill="currentColor"><textPath href="#seal-bottom" startOffset="50%">함께 멸종했어야 합니다</textPath></text>
<text x="22" y="104" font-size="11" text-anchor="middle" fill="currentColor">★</text>
<text x="178" y="104" font-size="11" text-anchor="middle" fill="currentColor">★</text>
<use href="#dodo-plain" x="62" y="42" width="76" height="76"/>
<text x="100" y="150" text-anchor="middle" font-size="17" font-weight="900" letter-spacing="3" fill="currentColor">처리 완료</text>
</g>
</symbol>
<mask id="open-behind" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="200"><rect width="240" height="200" fill="#fff"/><path d="M4 70.5 H140 Q166 70.5 178 84" fill="none" stroke="#000" stroke-width="17.8"/><path d="M236 70.5 H222 Q206 70.5 198.5 86" fill="none" stroke="#000" stroke-width="17.8"/></mask><mask id="open-near" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="200"><path d="M4 70.5 H140 Q166 70.5 178 84" fill="none" stroke="#fff" stroke-width="17.8"/><path d="M236 70.5 H222 Q206 70.5 198.5 86" fill="none" stroke="#fff" stroke-width="17.8"/></mask><mask id="open-ros-hole"><rect width="240" height="200" fill="#fff"/><circle cx="104" cy="70" r="8.5" fill="#000"/></mask><symbol id="open-seal" viewBox="0 0 240 200"><g filter="url(#ink)" fill="#0F5A3A"><rect x="4" y="4" width="232" height="192" rx="18" fill="none" stroke="#0F5A3A" stroke-width="6"/>
<rect x="14" y="14" width="212" height="172" rx="11" fill="none" stroke="#0F5A3A" stroke-width="2.2"/>
<text x="104" y="40" text-anchor="middle" font-size="13.5" font-weight="900" letter-spacing="5">BYPASS</text><g mask="url(#open-ros-hole)">
<circle cx="119" cy="70" r="7"/><circle cx="116.1" cy="78.8" r="7"/><circle cx="108.6" cy="84.3" r="7"/><circle cx="99.4" cy="84.3" r="7"/><circle cx="91.9" cy="78.8" r="7"/>
<circle cx="89" cy="70" r="7"/><circle cx="91.9" cy="61.2" r="7"/><circle cx="99.4" cy="55.7" r="7"/><circle cx="108.6" cy="55.7" r="7"/><circle cx="116.1" cy="61.2" r="7"/>
<circle cx="104" cy="70" r="15"/></g>
<circle cx="104" cy="70" r="4.2"/>
<path d="M99 86 L92 110 L98 106 L101 112 L105 88 Z"/>
<path d="M109 86 L116 110 L110 106 L107 112 L103 88 Z"/><g mask="url(#open-behind)"><path d="M194.63 41.56 L198.31 98.73 L199.31 98.71 L200.22 41.43 Z"/></g><path d="M4 70.5 H140 Q166 70.5 178 84" fill="none" stroke="#0F5A3A" stroke-width="13"/><path d="M236 70.5 H222 Q206 70.5 198.5 86" fill="none" stroke="#0F5A3A" stroke-width="13"/><path d="M197.43 41.49 L196.21 28.11" fill="none" stroke="#0F5A3A" stroke-width="2.8" stroke-linecap="round"/><circle cx="195.70" cy="22.53" r="5.6" fill="none" stroke="#0F5A3A" stroke-width="2.8"/><path d="M197.43 41.49 L206.28 31.38" fill="none" stroke="#0F5A3A" stroke-width="2.8" stroke-linecap="round"/><circle cx="209.97" cy="27.17" r="5.6" fill="none" stroke="#0F5A3A" stroke-width="2.8"/><g mask="url(#open-near)" fill="#fff"><path d="M195.14 39.87 L164.16 87.31 L164.98 87.89 L199.71 43.12 Z" stroke="#fff" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round"/></g><path d="M195.14 39.87 L164.16 87.31 L164.98 87.89 L199.71 43.12 Z"/><circle cx="197.43" cy="41.49" r="2.3"/><text x="120" y="142" text-anchor="middle" font-size="33" font-weight="900" letter-spacing="2">신설 개통</text>
<text x="120" y="164" text-anchor="middle" font-size="13" font-weight="700">이 길은 원래 지도에</text>
<text x="120" y="180" text-anchor="middle" font-size="13" font-weight="700">없었습니다</text></g></symbol>`;

  window.BYPASS_DOCKETS = { STATUS, SELECT, label, board, sampleNote, ensureDefs };
})();
