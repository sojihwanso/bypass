/* 경보(BAM, IMO MSC.302(87)): 알람(A)·경고(W)·주의(C), 상태 4가지, 소리 끄기 30 s, 미확인 경고 5분 재알림, 기록 — ECDIS 앱과 같은 동작 */
const RANK = { A: 0, W: 1, C: 2 };
/* now: 실제 시간(초) — 소리 끄기·재알림은 배속과 상관없이 실제 시간 기준. simNow: 표시용 시뮬레이션 시각 */
export function createAlerts(now, simNow = now) {
  const m = new Map(), hist = [];
  const rec = (id, ev) => { hist.push({ t: now(), id, ev }); if (hist.length > 500) hist.shift(); };
  return {
    raise(id, pri, text) {
      let a = m.get(id);
      if (a && a.active) { a.text = text; return a; }
      if (a) { a.active = true; a.acked = false; a.t0 = now(); a.tSim = simNow(); a.lastAnn = now(); a.silenced = 0; }
      else { a = { id, pri, text, active: true, acked: false, t0: now(), tSim: simNow(), lastAnn: now(), silenced: 0 }; m.set(id, a); }
      rec(id, 'raise'); return a;
    },
    resolve(id) { const a = m.get(id); if (!a || !a.active) return; a.active = false; rec(id, 'resolve'); if (a.pri === 'C' || a.acked) m.delete(id); },
    ack(id) { const a = m.get(id); if (!a || a.pri === 'C') return; a.acked = true; rec(id, 'ack'); if (!a.active) m.delete(id); },
    ackAll() { for (const a of [...m.values()]) this.ack(a.id); },
    silence() { for (const a of m.values()) if (!a.acked) a.silenced = now() + 30; },
    sounding() {
      const t = now();
      for (const a of m.values()) {
        if (a.acked || a.pri === 'C' || t < a.silenced) continue;
        if (a.pri === 'A') return true;
        if (t - a.lastAnn < 5) return true;           // 경고: 처음 잠깐
        if (t - a.lastAnn >= 300) { a.lastAnn = t; return true; } // 5분 뒤 다시
      }
      return false;
    },
    has: (id) => m.has(id),
    list() { return [...m.values()].sort((a, b) => RANK[a.pri] - RANK[b.pri] || (a.acked - b.acked) || b.t0 - a.t0); },
    top() { return this.list()[0] || null; },
    log: () => hist,
    clear() { m.clear(); },
  };
}
