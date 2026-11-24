/* 본 단원 기록. 저장소가 막혀 있으면(접근만 해도 오류가 나는 경우 포함) 메모리에만 둔다. */
const KEY = 'shs-seen-v1';
function defaultStorage() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } }
export function createProgress(storage) {
  if (storage === undefined) storage = defaultStorage();
  let seen = new Set();
  try { const raw = storage && storage.getItem(KEY); if (raw) seen = new Set(JSON.parse(raw)); } catch (e) { /* 저장소 사용 불가 */ }
  const save = () => { try { storage && storage.setItem(KEY, JSON.stringify([...seen])); } catch (e) { /* 무시 */ } };
  return { mark(id) { if (!seen.has(id)) { seen.add(id); save(); } }, has: id => seen.has(id), count: () => seen.size, list: () => [...seen] };
}
