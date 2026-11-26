/* 화면 문구(한/EN). 장비 약어는 영어 그대로. 문자열에 큰따옴표 금지 */
import { S } from './state.js';
const D = {
  ko: {
    brand: '레이더 시뮬레이터', sub: 'RADAR SIMULATOR · TRAINING', help: '도움말', menu: '메뉴', close: '닫기', ok: '확인', cancel: '취소',
    q_tx: '송신', q_mode: '방위 모드', q_motion: '운동 모드', q_off: '중심 이동', q_preset: '맞춤 영상', q_trail: '항적', q_pi: 'PI선', q_az: '포착 구역',
    q_pause: '일시정지', q_speed: '배속', q_pal: '화면', q_menu: '메뉴', q_conn: 'Conning', q_shot: '캡처', q_scn: '시나리오',
    own: '자선', tgt: '물표 정보', ttais: 'TT · AIS', alert: '경보', noTgt: '물표를 눌러 고르세요', noAlert: '경보 없음',
    posn: '위치', time: '시각', elapsed: '경과', ack: '확인', silence: '소리 끄기', list: '목록', count: '개',
    cursor: '커서', stby: '대기', warm: '예열', tx: '송신 중', paused: '일시정지',
    vector: '벡터', past: '과거 위치', cpaLim: 'CPA 한계', aisFilt: 'AIS 필터', ttN: 'TT', aisN: 'AIS',
    cm_acq: 'TT 포착', cm_cancel: 'TT 해제', cm_data: '물표 데이터', cm_ebl: 'EBL1을 여기로', cm_vrm: 'VRM1을 여기로', cm_off: '여기를 중심으로',
    cm_offEbl: 'EBL1 원점을 여기로', cm_drop: 'Drop mark', cm_anchor: '닻 위치로', cm_ruler: '두 점 거리 재기', cm_act: 'AIS 활성/휴면', cm_ref: '기준 물표로', cm_center: '중심 복귀',
    pal_day: '주간', pal_dusk: '박명', pal_night: '야간', egg: '이스터에그', patch: '패치노트', eggMsg: '선교 당직, 오늘도 수고 많았어요. 레이더는 눈을 대신할 뿐, 견시를 대신하지는 않아요.',
    rotate: '가로 화면으로 돌려 주세요', rotateSub: '레이더 화면은 가로로 써야 넓게 보여요.', menuTitle: '메뉴', foot: '교육용 레이더 시뮬레이터 · 실제 항해에 쓰지 마세요',
  },
  en: {
    brand: 'Radar Simulator', sub: 'RADAR SIMULATOR · TRAINING', help: 'Help', menu: 'Menu', close: 'Close', ok: 'OK', cancel: 'Cancel',
    q_tx: 'Power', q_mode: 'Mode', q_motion: 'Motion', q_off: 'Off-center', q_preset: 'Echo preset', q_trail: 'Trails', q_pi: 'PI lines', q_az: 'Acq zone',
    q_pause: 'Pause', q_speed: 'Speed', q_pal: 'Display', q_menu: 'Menu', q_conn: 'Conning', q_shot: 'Capture', q_scn: 'Scenario',
    own: 'Own ship', tgt: 'Target data', ttais: 'TT · AIS', alert: 'Alerts', noTgt: 'Click a target to select it', noAlert: 'No alerts',
    posn: 'POSN', time: 'Time', elapsed: 'Elapsed', ack: 'ACK', silence: 'Silence', list: 'List', count: '',
    cursor: 'Cursor', stby: 'STBY', warm: 'Warm-up', tx: 'TX', paused: 'Paused',
    vector: 'Vector', past: 'Past posn', cpaLim: 'CPA limit', aisFilt: 'AIS filter', ttN: 'TT', aisN: 'AIS',
    cm_acq: 'Acquire TT', cm_cancel: 'Cancel TT', cm_data: 'Target data', cm_ebl: 'EBL1 here', cm_vrm: 'VRM1 here', cm_off: 'Off-center here',
    cm_offEbl: 'EBL1 origin here', cm_drop: 'Drop mark', cm_anchor: 'Anchor position', cm_ruler: 'Range between points', cm_act: 'AIS activate/sleep', cm_ref: 'Set reference target', cm_center: 'Re-center',
    pal_day: 'Day', pal_dusk: 'Dusk', pal_night: 'Night', egg: 'Easter egg', patch: 'Patch notes', eggMsg: 'Thanks for standing your watch. Radar extends your eyes, it never replaces a proper lookout.',
    rotate: 'Please rotate to landscape', rotateSub: 'The radar display needs a wide screen.', menuTitle: 'Menu', foot: 'Training radar simulator · not for navigation',
  },
};
export const lang = () => (S.ui.lang === 'en' ? 'en' : 'ko');
export const t = (k) => D[lang()][k] ?? D.ko[k] ?? k;
export const tl = (o) => (o ? o[lang()] ?? o.ko : '');
