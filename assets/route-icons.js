/* BYPASS 지름길 아이콘 (준공 현황 · HQ 공용)
   - icon     : 'auto'(이름 낱말로 고름) | 'upload'(직접 올린 그림) | 기본 그림 이름
   - tile     : 판 색 'auto' | 'line'(분류 색) | 'white' | 'yellow' | '#RRGGBB'
   - icon_full: 올린 그림이 판 전체를 채움
   그림 모양은 assets/bypass.css 의 .tile 이 정한다. */
(function () {
  const ICONS = {
    calendar: { name: '달력', d: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M7.5 14h2.5M13.5 14h3M7.5 17.2h2.5"/>' },
    cap: { name: '학사모', d: '<path d="M2 9.5 12 5l10 4.5L12 14z"/><path d="M6.5 11.8V16c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.2M22 9.5v5"/>' },
    bowl: { name: '밥그릇', d: '<path d="M3 11.5h18c0 5-4 8.5-9 8.5s-9-3.5-9-8.5z"/><path d="M8.5 3.5c-1 1.3 1 2.4 0 4M12 3.5c-1 1.3 1 2.4 0 4M15.5 3.5c-1 1.3 1 2.4 0 4"/>' },
    radar: { name: '레이더', d: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6.4-6.4"/><circle cx="15.3" cy="9.2" r="1.3" fill="currentColor" stroke="none"/>' },
    ship: { name: '배', d: '<path d="M3 14.5h18l-2.8 5.5H5.8z"/><path d="M6.5 14.5V10h11v4.5M12 10V3.5l5 3h-5"/>' },
    compass: { name: '나침반', d: '<circle cx="12" cy="12" r="9"/><path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z"/>' },
    tool: { name: '공구', d: '<path d="M14.6 6.4a4 4 0 0 0-5.1 5.1L4 17l3 3 5.5-5.5a4 4 0 0 0 5.1-5.1l-2.4 2.4-2.3-.4-.4-2.3z"/>' },
    bell: { name: '종', d: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>' },
    bus: { name: '버스', d: '<rect x="5" y="3.5" width="14" height="14" rx="2.5"/><path d="M5 10h14M8 17.5V20.5M16 17.5V20.5"/><circle cx="8.6" cy="13.8" r="1" fill="currentColor" stroke="none"/><circle cx="15.4" cy="13.8" r="1" fill="currentColor" stroke="none"/>' },
    pin: { name: '위치', d: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>' },
    doc: { name: '문서', d: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>' },
    book: { name: '책', d: '<path d="M4 5.5c2.6-1.5 5.4-1.5 8 0v14c-2.6-1.5-5.4-1.5-8 0z"/><path d="M20 5.5c-2.6-1.5-5.4-1.5-8 0v14c2.6-1.5 5.4-1.5 8 0z"/>' },
    chat: { name: '말풍선', d: '<path d="M4 5h16v11H10l-4 4v-4H4z"/><circle cx="9" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r="1" fill="currentColor" stroke="none"/>' },
    app: { name: '앱', d: '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>' }
  };

  // 이름(과목)에 든 낱말로 그림 고르기
  const GUESS = [
    [/시간표|수강|플래너/, 'calendar'],
    [/학점|졸업|이수/, 'cap'],
    [/학식|식단|급식|밥|꿀꿀/, 'bowl'],
    [/레이더|radar|arpa/i, 'radar'],
    [/충돌|colreg|선박|해운|항만|선원/i, 'ship'],
    [/항해|천문|나침|해도|gps|지문/i, 'compass'],
    [/기관|엔진|기계|정비/, 'tool'],
    [/공지|알림|알리미/, 'bell'],
    [/버스|셔틀|통학/, 'bus'],
    [/강의실|지도|위치|캠퍼스/, 'pin'],
    [/시험|족보|기출|문제/, 'doc']
  ];

  const INK = '#1C211E';
  const PRESET = { white: '#FFFFFF', yellow: '#FFB13B' };

  function guess(r) {
    const words = `${r.title || ''} ${r.subject || ''}`;
    for (const [re, key] of GUESS) if (re.test(words)) return key;
    return { wiki: 'book', channel: 'chat' }[r.type] || 'app';
  }

  /* 실제로 쓸 그림 이름. 'upload' 인데 주소가 없으면 자동으로 */
  function iconOf(r) {
    const icon = r.icon || 'auto';
    if (icon === 'upload') return r.icon_url ? 'upload' : guess(r);
    if (ICONS[icon]) return icon;
    return guess(r);
  }

  /* 판 색. 'auto' 는 종류별: 앱 = 분류 색, 위키 = 흰 판, 카톡 채널 = 노란 판 */
  function bgOf(r, lineColor) {
    const tile = r.tile || 'auto';
    const line = lineColor || '#0F5A3A';
    if (tile === 'line') return line;
    if (PRESET[tile]) return PRESET[tile];
    if (/^#[0-9a-f]{6}$/i.test(tile)) return tile;
    return { wiki: PRESET.white, channel: PRESET.yellow }[r.type] || line;
  }

  // 밝기 대비로 그림 색 고르기 (흰색 또는 먹색)
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  function fgOf(bg) {
    const L = luminance(bg);
    const onWhite = 1.05 / (L + 0.05);
    const onInk = (L + 0.05) / (luminance(INK) + 0.05);
    return onWhite >= onInk ? '#FFFFFF' : INK;
  }

  function svgOf(key) {
    const icon = ICONS[key] || ICONS.app;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon.d}</svg>`;
  }

  /* 아이콘 판 만들기. opts.size = 픽셀 크기 */
  function tile(r, lineColor, opts) {
    const o = opts || {};
    const t = document.createElement('span');
    const key = iconOf(r);
    const building = r.status === 'building';
    const full = key === 'upload' && !!r.icon_full;
    t.className = `tile${building ? ' is-building' : ''}${full ? ' is-full' : ''}`;
    if (o.size) t.style.setProperty('--tile-size', `${o.size}px`);
    const bg = bgOf(r, lineColor);
    t.style.setProperty('--tile-bg', bg);
    t.style.setProperty('--tile-fg', fgOf(bg));
    // 흰 판처럼 밝은 판은 먹색 테두리로 바탕과 구분
    if (luminance(bg) > 0.85) t.style.setProperty('--tile-ring-w', '3px');
    if (key === 'upload') {
      const img = document.createElement('img');
      img.alt = ''; img.decoding = 'async'; img.loading = 'lazy';
      // 파일이 사라졌으면 깨진 그림 대신 자동 그림
      img.onerror = () => { t.classList.remove('is-full'); t.innerHTML = svgOf(guess(r)); };
      img.src = r.icon_url;
      t.append(img);
    } else {
      t.innerHTML = svgOf(key);
    }
    return t;
  }

  window.BYPASS_ICONS = { ICONS, guess, iconOf, bgOf, fgOf, luminance, svgOf, tile, PRESET };
})();
