/* 키보드: ECDIS 앱과 같은 조종 키 + 레이더 키(전용 키를 대신). 입력칸에서는 무시 */
export const KEYMAP = [
  { key: 'ArrowLeft', act: 'steerL', ko: '자동 조타: 설정 침로 −1° / 수동: 타 좌현 5°', en: 'Auto: set heading −1° / Hand: rudder 5° port' },
  { key: 'ArrowLeft', shift: true, act: 'steerL10', ko: '자동 조타: 설정 침로 −10°', en: 'Auto: set heading −10°' },
  { key: 'ArrowRight', act: 'steerR', ko: '자동 조타: 설정 침로 +1° / 수동: 타 우현 5°', en: 'Auto: set heading +1° / Hand: rudder 5° starboard' },
  { key: 'ArrowRight', shift: true, act: 'steerR10', ko: '자동 조타: 설정 침로 +10°', en: 'Auto: set heading +10°' },
  { key: '0', act: 'mid', ko: '타 중앙(Midships)', en: 'Midships' },
  { key: 'ArrowUp', act: 'teleUp', ko: '기관 한 단계 앞으로', en: 'Engine one step ahead' },
  { key: 'ArrowDown', act: 'teleDn', ko: '기관 한 단계 뒤로', en: 'Engine one step astern' },
  { key: ' ', act: 'pause', ko: '일시정지 / 계속', en: 'Pause / resume' },
  { key: 'a', act: 'ack', ko: '경보 확인(ACK)', en: 'Acknowledge alert' },
  { key: '+', act: 'rangeUp', ko: '거리 범위 늘리기', en: 'Range up' },
  { key: '-', act: 'rangeDn', ko: '거리 범위 줄이기', en: 'Range down' },
  { key: 'e', act: 'ebl1', ko: 'EBL1 켜기/끄기', en: 'EBL1 on/off' },
  { key: 'v', act: 'vrm1', ko: 'VRM1 켜기/끄기', en: 'VRM1 on/off' },
  { key: 'q', act: 'acqCursor', ko: '커서 위치 물표 포착(TT)', en: 'Acquire target at cursor' },
  { key: 'x', act: 'cancelCursor', ko: '커서 위치 물표 해제', en: 'Cancel target at cursor' },
  { key: 'o', act: 'off', ko: '중심 이동(Off-center)', en: 'Off-center' },
  { key: 'm', act: 'mode', ko: '방위 모드 바꾸기(HU→CU→NU)', en: 'Cycle presentation mode' },
  { key: 't', act: 'vecMode', ko: '진/상대 벡터 바꾸기', en: 'True/relative vector' },
  { key: 'h', act: 'hlHide', ko: '누르는 동안 선수선 숨기기', en: 'Hide heading line while held' },
  { key: 'c', act: 'conn', ko: 'Conning 창 보이기/숨기기', en: 'Show/hide conning' },
  { key: 'F1', act: 'f1', ko: '기능 키 1 (맞춤 영상)', en: 'Function key 1' },
  { key: 'F2', act: 'f2', ko: '기능 키 2', en: 'Function key 2' },
  { key: 'F3', act: 'f3', ko: '기능 키 3', en: 'Function key 3' },
  { key: 'F4', act: 'f4', ko: '기능 키 4', en: 'Function key 4' },
  { key: '[', act: 'slower', ko: '배속 한 단계 낮추기', en: 'Sim speed down' },
  { key: ']', act: 'faster', ko: '배속 한 단계 올리기', en: 'Sim speed up' },
  { key: 'Escape', act: 'esc', ko: '메뉴·창 닫기', en: 'Close menus' },
];
const typing = (el) => el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
export function initKeys(handlers) {
  const norm = (k) => (k.length === 1 ? k.toLowerCase() : k === '=' ? '+' : k);
  addEventListener('keydown', (e) => {
    if (typing(e.target) || typing(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'Escape' && document.querySelector('dialog[open]')) return; // 결과·안내·도움말 창이 떠 있으면 조종 키 무시
    const t = e.target; if (e.key === ' ' && t && t.closest && t.closest('button,[role=button],[role=menuitem],summary,a[href]')) return; // 단추 위 Space는 단추 누르기
    let k = norm(e.key); if (k === '=') k = '+';
    const m = KEYMAP.find((x) => x.key.toLowerCase() === k.toLowerCase() && !!x.shift === (e.shiftKey && x.key.startsWith('Arrow')));
    if (!m || !handlers[m.act]) return;
    e.preventDefault(); handlers[m.act](true, e);
  });
  addEventListener('keyup', (e) => { if (norm(e.key) === 'h' && handlers.hlHide) handlers.hlHide(false, e); });
}
