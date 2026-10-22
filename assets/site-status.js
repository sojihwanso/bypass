/* BYPASS 운영 상태 전광판 (메인 맨 위 줄과 HQ '사이트 상태' 미리보기가 함께 씀)
   설정은 Supabase site_settings 표의 'status' 한 줄: supabase/010_hq_phase2.sql
   - mode: 'normal'(평시) | 'recruiting'(모집 기간) | 'exam'(시험 기간)
   - 모집 기간이라도 시작일 전이나 마감일 뒤에는 저절로 평시로 보인다.
   - 문구 속 {시작}·{마감} 은 날짜(예: 11. 20.)로 바뀐다. */
(function () {
  const DEFAULT = {
    mode: 'normal',
    texts: {
      normal: '본 국은 현재 정상 운영 중입니다. 제보는 상시 접수합니다.',
      recruiting: '2026학년도 BYPASS 국원 공개 모집 중 (~ {마감})',
      exam: '시험 기간 중 본 국의 심의 업무가 일시 정지됩니다. 접수는 계속됩니다.'
    },
    recruit_start: null,
    recruit_end: null
  };
  const MODES = { normal: '평시', recruiting: '모집 기간', exam: '시험 기간' };
  const ISO = /^\d{4}-\d{2}-\d{2}$/;

  // 받은 값이 이상해도 화면이 깨지지 않게 기본값으로 메운다
  function clean(v) {
    const c = v && typeof v === 'object' ? v : {};
    const texts = c.texts && typeof c.texts === 'object' ? c.texts : {};
    const pick = k => (typeof texts[k] === 'string' && texts[k].trim()) ? texts[k].trim() : DEFAULT.texts[k];
    return {
      mode: MODES[c.mode] ? c.mode : 'normal',
      texts: { normal: pick('normal'), recruiting: pick('recruiting'), exam: pick('exam') },
      recruit_start: ISO.test(c.recruit_start || '') ? c.recruit_start : null,
      recruit_end: ISO.test(c.recruit_end || '') ? c.recruit_end : null
    };
  }
  function todayIso(now) {
    const n = now || new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }
  const md = iso => { const [, m, d] = iso.split('-').map(Number); return `${m}. ${d}.`; };
  // 실제로 보일 모드: 모집 기간 밖이면 평시
  function effective(c, now) {
    if (c.mode !== 'recruiting') return c.mode;
    const t = todayIso(now);
    if (c.recruit_start && t < c.recruit_start) return 'normal';
    if (c.recruit_end && t > c.recruit_end) return 'normal';
    return 'recruiting';
  }
  function fill(text, c) {
    return text
      .replace(/\{마감\}/g, c.recruit_end ? md(c.recruit_end) : '별도 공지 시')
      .replace(/\{시작\}/g, c.recruit_start ? md(c.recruit_start) : '지금');
  }
  // 모집 요강의 '모집 기간' 칸
  function period(c, mode) {
    if (mode !== 'recruiting' || (!c.recruit_start && !c.recruit_end)) return '언제나';
    return `${c.recruit_start ? md(c.recruit_start) : ''} ~ ${c.recruit_end ? md(c.recruit_end) : ''}`.trim();
  }
  function view(v, now) {
    const c = clean(v);
    const mode = effective(c, now);
    return { config: c, mode, text: fill(c.texts[mode], c), period: period(c, mode) };
  }

  window.BYPASS_STATUS = { DEFAULT, MODES, clean, effective, fill, view, md, todayIso };
})();
