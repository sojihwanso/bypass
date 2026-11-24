/* 주소: #/<단원id> → 학습실, 그 밖은 첫 화면. 아직 열리지 않은 단원은 '준비 중'.
   opt.all: 만드는 중에 모든 단원을 열어 보는 미리보기(주소에 ?all) */
export const isOpen = u => u.stage === 1 || !!u.ready;
export function parseHash(hash, units, opt = {}) {
  const h = (hash || '').replace(/^#/, '');
  if (!h.startsWith('/')) return h ? { view: 'home', section: h } : { view: 'home' };
  const id = h.slice(1).split(/[?/]/)[0];
  const u = units.find(x => x.id === id);
  if (!u) return { view: 'home' };
  return opt.all || isOpen(u) ? { view: 'room', id } : { view: 'soon', id };
}
export const roomHref = id => '#/' + id;
