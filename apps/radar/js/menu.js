/* 메뉴 트리 데이터 — 매뉴얼 부록 1 MENU TREE 중 운용 항목(정비·설치·Dual radar·Wave·Doppler·어망 커서·AIS 송신 제외)
   항목: {id, ko, en, type:'enum'|'num'|'bool'|'action', opts?[{v,ko,en}], min?, max?, step?, path?, act?, help:{ko,en}} */
const E = (v, ko = String(v), en = ko) => ({ v, ko, en });
const OFF123 = [E(0, 'OFF'), E(1, '1'), E(2, '2'), E(3, '3')];
const it = (id, path, type, ko, en, hko, hen, ext = {}) => ({ id, path, type, ko, en, help: { ko: hko, en: hen }, ...ext });
const act = (id, ko, en, hko, hen) => ({ id, type: 'action', act: id, ko, en, help: { ko: hko, en: hen } });
const enumOf = (arr) => arr.map((v) => (typeof v === 'object' ? v : E(v)));

export const MENU = [
  { id: 'echo', ko: '영상(ECHO)', en: 'ECHO', items: [
    it('preset', 'ctrl.preset', 'enum', '맞춤 영상', 'CUSTOMIZED ECHO', '목적에 맞춘 영상 조정 묶음을 고릅니다. 근거리·원거리·거친 바다·항구 등.', 'Selects a preset of echo settings for the purpose: near, far, rough sea, harbor and so on.', { opts: enumOf(['CUSTOM1', 'CUSTOM2', 'CUSTOM3', 'NEAR', 'FAR', 'ROUGH SEA', 'SHIP', 'HARBOR', 'COAST']) }),
    it('band', 'ctrl.band', 'enum', '주파수 대역', 'BAND', 'X 밴드(3 cm)는 분해능이 좋고, S 밴드(10 cm)는 비·해면 반사에 강합니다. SART는 X 밴드에서만 응답합니다.', 'X-band (3 cm) gives finer resolution; S-band (10 cm) sees through rain and sea clutter better. SARTs answer X-band only.', { opts: enumOf(['X', 'S']) }),
    it('pulse', 'ctrl.pulse', 'enum', '펄스 길이', 'PULSE LENGTH', '짧은 펄스는 거리 분해능이 좋고, 긴 펄스는 멀리 있는 약한 물표를 잘 잡습니다. 거리 범위마다 고를 수 있는 펄스가 다릅니다.', 'Short pulses resolve targets in range; long pulses detect weak distant targets. Available pulses depend on the range scale.', { opts: enumOf(['S1', 'S2', 'M1', 'M2', 'M3', 'L']) }),
    it('tuneAuto', 'ctrl.tune.auto', 'bool', '자동 튜닝', 'AUTO TUNE', '수신기 동조를 자동으로 맞춥니다. 끄면 튜닝 막대로 직접 맞춥니다.', 'Tunes the receiver automatically. Turn off to tune by hand with the tuning bar.'),
    it('ir', 'ctrl.ir', 'enum', '간섭 제거(IR)', 'INT REJECTOR', '다른 선박 레이더가 만드는 점선 간섭을 지웁니다. 숫자가 클수록 강합니다.', 'Removes dotted interference from other radars. Higher numbers reject more.', { opts: OFF123 }),
    it('es', 'ctrl.es', 'enum', '영상 확대(ES)', 'ECHO STRETCH', '작은 물표를 거리 방향으로 늘려 잘 보이게 합니다. 클러터도 함께 커집니다.', 'Stretches small echoes in range so they stand out. Clutter grows as well.', { opts: OFF123 }),
    it('eav', 'ctrl.eav', 'enum', '영상 평균(EAV)', 'ECHO AVERAGE', '여러 스캔을 평균해 깜빡이는 해면 반사를 줄이고 꾸준한 물표를 남깁니다. 빠른 물표는 흐려질 수 있습니다.', 'Averages successive scans to suppress flickering sea clutter and keep steady targets. Fast targets may weaken.', { opts: OFF123 }),
    it('noiseRej', 'ctrl.noiseRej', 'bool', '잡음 제거', 'NOISE REJECTOR', '홀로 튀는 약한 점(수신 잡음)을 지웁니다.', 'Removes isolated weak speckles of receiver noise.'),
    it('secondRej', 'ctrl.secondRej', 'bool', '2차 소인 제거', '2ND ECHO REJ', '최대 탐지 거리 너머 물체가 가까이 거짓으로 나타나는 2차 소인 반사를 지웁니다.', 'Removes second-trace echoes from objects beyond the maximum unambiguous range.'),
    it('ace', 'ctrl.ace', 'bool', '자동 클러터 제거(ACE)', 'ACE', '이득·해면·강우 조정을 자동으로 맞춥니다.', 'Adjusts gain, sea and rain clutter automatically.'),
    it('stcCurve', 'ctrl.stcCurve', 'enum', 'STC 곡선', 'STC CURVE', '거리에 따라 해면 반사를 줄이는 곡선의 모양입니다.', 'Shape of the curve that suppresses sea clutter with range.', { opts: enumOf([2, 2.5, 3, 3.5, 4.2]) }),
    it('stcRange', 'ctrl.stcRange', 'num', 'STC 범위', 'STC RANGE', '해면 반사 억제가 미치는 거리입니다.', 'Range over which sea clutter suppression acts.', { min: 0, max: 10, step: 1 }),
    it('wiper', 'ctrl.wiper', 'enum', '와이퍼', 'WIPER', '약한 단계의 영상을 지워 화면을 깨끗하게 합니다.', 'Wipes the weakest echo levels for a cleaner picture.', { opts: [E(0, 'OFF'), E(1, '1'), E(2, '2')] }),
    it('sart', 'ctrl.sart', 'bool', 'SART 모드', 'SART', 'SART 신호(12개 점)를 보기 좋게 설정합니다.', 'Sets the picture for viewing SART responses (12 dots).'),
    it('pmMode', 'ctrl.pmMode', 'enum', '성능 감시(PM)', 'PERFORMANCE MONITOR', '송신기 출력과 수신기 감도가 정상인지 화면의 호(arc)로 확인합니다(매뉴얼 1.49). TX 상태에서만 켜지고, 켜면 거리 24 NM·GAIN 70·SEA/RAIN 0·긴 펄스 등으로 자동 설정되며 끄면 원래대로 돌아갑니다. 거리를 직접 바꾸면 꺼집니다. 정상이면 가장 안쪽 호가 8.0~19.8 NM 사이에 나타나고, 호가 하나도 없으면 10 dB 손실입니다. GRAPH ONLY는 그래프만 봅니다.', 'Checks transmitter power and receiver sensitivity with arcs on the screen (manual 1.49). Works only in TX; sets range 24 NM, GAIN 70, SEA/RAIN 0, long pulse and so on, and restores them when turned off. Changing the range by hand turns it off. Normally the innermost arcs appear between 8.0 and 19.8 NM; no arc means 10 dB loss. GRAPH ONLY shows the graph only.', { opts: [E('OFF', 'OFF'), E('ON', 'ON'), E('GRAPH', 'GRAPH ONLY')] }),
    it('pmArcs', 'ctrl.pmArcs', 'enum', 'PM 호 개수', 'PM ARC', '성능 감시 때 화면에 나오는 호의 개수입니다.', 'Number of performance-monitor arcs.', { opts: enumOf([2, 3, 5, 6]) }),
    it('pmLoss', 'ctrl.pmLoss', 'enum', 'PM 연습: 성능 저하 가정', 'PM PRACTICE: ASSUMED LOSS', '교육용 설정(실제 장비에는 없음). 송수신 성능이 떨어진 레이더를 가정해 PM 호와 모든 영상이 그만큼 약해집니다. 0 dB가 정상입니다.', 'Training only (not on real equipment). Simulates a degraded transmitter/receiver: PM arcs and all echoes weaken by this much. 0 dB is normal.', { opts: [E(0, '0 dB'), E(3, '3 dB'), E(6, '6 dB'), E(10, '10 dB')] }),
    it('persistence', 'disp.persistence', 'enum', '잔광', 'AFTERGLOW', '지나간 영상이 남아 있는 시간입니다(스캔 수).', 'How long echoes persist after the sweep (scans).', { opts: enumOf([1, 2, 3, 4]) }),
  ] },
  { id: 'marks', ko: '마크·항적(MARKS)', en: 'MARKS', items: [
    it('trailMode', 'disp.trails.mode', 'enum', '항적 모드', 'TRAIL MODE', '상대(REL): 자선 기준 움직임, 진(TRUE): 실제 움직임. 진 항적에서는 정지 물표에 꼬리가 없습니다.', 'REL: motion relative to own ship. TRUE: actual motion; stationary objects show no trail.', { opts: enumOf(['REL', 'TRUE']) }),
    it('trailTime', 'disp.trails.time', 'enum', '항적 시간', 'TRAIL TIME', '항적을 남기는 시간입니다(초).', 'How long trails remain (seconds).', { opts: [E(0, 'OFF'), E(15, '15s'), E(30, '30s'), E(60, '1min'), E(180, '3min'), E(360, '6min'), E(900, '15min'), E(1800, '30min')] }),
    it('trailGrad', 'disp.trails.grad', 'enum', '항적 단계', 'TRAIL GRADATION', '한 가지 밝기(SINGLE) 또는 오래될수록 흐리게(MULTI).', 'Single brightness or fading with age.', { opts: enumOf(['SINGLE', 'MULTI']) }),
    it('trailLevel', 'disp.trails.level', 'enum', '항적 레벨', 'TRAIL LEVEL', '항적으로 남길 영상의 최소 세기입니다.', 'Minimum echo strength that leaves a trail.', { opts: enumOf([1, 2, 3, 4]) }),
    it('suppressOS', 'disp.trails.suppressOS', 'bool', '자선 주변 억제', 'SUPPRESS AROUND OS', '자선 주변 해면 반사가 항적으로 남지 않게 합니다.', 'Keeps sea clutter around own ship from leaving trails.'),
    it('stern', 'disp.stern', 'bool', '선미 마크', 'STERN MARK', '선수선 반대쪽에 선미 표시를 그립니다.', 'Draws the stern mark opposite the heading line.'),
    it('osMark', 'disp.osMark', 'enum', '자선 심볼', 'OWN SHIP MARK', '자선을 작은 기호(MINIMIZED) 또는 실제 크기(SCALED)로 그립니다.', 'Own ship as a small mark or to scale.', { opts: enumOf(['MINIMIZED', 'SCALED']) }),
    it('grid', 'disp.grid', 'bool', '위경도 격자', 'L/L GRID', '위도·경도선을 겹쳐 그립니다.', 'Overlays latitude and longitude lines.'),
    it('mapOn', 'disp.map.on', 'bool', '레이더 맵', 'RADAR MAP', '해안선·부표·위험물 같은 지도 정보를 겹쳐 그립니다.', 'Overlays map data: coastline, buoys, dangers.'),
    it('mapCoast', 'disp.map.coast', 'bool', '맵: 해안선', 'MAP: COAST LINE', '레이더 맵의 해안선을 그립니다.', 'Draws the coastline of the radar map.'),
    it('mapMarks', 'disp.map.marks', 'bool', '맵: 마크', 'MAP: MARKS', '레이더 맵의 부표·위험물 마크를 그립니다.', 'Draws buoy and danger marks of the radar map.'),
    it('mapRoute', 'disp.map.route', 'bool', '맵: 항로', 'MAP: CHANNEL', '히든 시나리오에서 항로 경계(점선)와 변침점을 그립니다.', 'Draws the channel limits (dashed) and waypoints in the hidden scenario.'),
    it('route', 'disp.route', 'bool', '항로 표시', 'ROUTE', '항로(WPT)를 그립니다.', 'Draws the route and waypoints.'),
    it('colorSet', 'disp.colorSet', 'enum', '색 조합', 'COLOR SET', '화면 바탕과 영상 색의 조합입니다. 왼쪽 아래 밝기 단추를 길게 눌러도 바뀝니다.', 'Background and echo colour set. Long-press the brilliance button to cycle.', { opts: [E('C1', '검정·호박', 'BLACK/AMBER'), E('C2', '검정·노랑', 'BLACK/YELLOW'), E('C3', '남색·노랑', 'NAVY/YELLOW'), E('C4', '검정·초록', 'BLACK/GREEN'), E('C5', '짙은 청록·초록', 'TEAL/GREEN'), E('C6', '회청·노랑', 'SLATE/YELLOW')] }),
    it('iala', 'disp.iala', 'enum', 'PI 선 색(IALA)', 'PI COLOR (IALA)', 'PI 선의 좌우 색입니다(부표 좌우현 색과 같게). A: 왼쪽 빨강·오른쪽 초록 — 유럽·아프리카·중동·인도·중국·동남아·오세아니아 등 B 지역을 뺀 나라. B: 왼쪽 초록·오른쪽 빨강 — 한국·일본·필리핀·남북 아메리카.', 'PI line colours, matching the lateral buoy colours. A: red left, green right — Europe, Africa, the Middle East, India, China, South-East Asia, Oceania and every other country outside region B. B: green left, red right — Korea, Japan, the Philippines and the Americas.', { opts: [E('A', 'IALA A', 'IALA A'), E('B', 'IALA B (한국·일본·필리핀·아메리카)', 'IALA B (Korea, Japan, Philippines, Americas)')] }),
    it('wxOn', 'sim.weatherOn', 'toggle', '날씨 변화', 'WEATHER CHANGES', '무작위 날씨와 진행 중 날씨 변화, 바람에 밀림을 켜고 끕니다. 헤더 날씨 표시를 눌러도 됩니다.', 'Random weather, changes and wind drift on/off. Also the weather chip in the header.'),
    it('palette', 'disp.palette', 'enum', '화면 밝기 구성', 'BRILL / COLOR', '주간·박명·야간 화면 구성입니다. 밤에는 눈부시지 않게 어둡게 씁니다.', 'Day, dusk and night schemes. Use the dark scheme at night.', { opts: [E('day', '주간', 'DAY'), E('dusk', '박명', 'DUSK'), E('night', '야간', 'NIGHT')] }),
  ] },
  { id: 'nav', ko: '항해 도구(NAV TOOLS)', en: 'NAV TOOLS', items: [
    it('rings', 'disp.rings', 'bool', '거리환', 'RANGE RINGS', '일정 간격의 고정 거리환을 그립니다.', 'Shows fixed range rings.'),
    it('eblRef', 'disp.eblRef', 'enum', 'EBL 방위 기준', 'EBL REL/TRUE', '상대 방위(선수 기준) 또는 진방위로 표시합니다.', 'Relative (from heading) or true bearing.', { opts: enumOf(['REL', 'TRUE']) }),
    it('vrmUnit', 'disp.vrmUnit', 'enum', 'VRM 단위', 'VRM UNIT', '거리 단위입니다.', 'Range unit.', { opts: enumOf(['NM', 'km', 'SM', 'kyd']) }),
    it('vrmTTG', 'disp.vrmTTG', 'bool', 'VRM 도달 시간', 'VRM TTG', '자선이 VRM 거리까지 가는 데 걸리는 시간을 표시합니다.', 'Shows time for own ship to cover the VRM range.'),
    it('cursorBrg', 'disp.cursorBrg', 'enum', '커서 방위 기준', 'CURSOR BEARING', '커서 방위를 상대 또는 진방위로 표시합니다.', 'Cursor bearing relative or true.', { opts: enumOf(['REL', 'TRUE']) }),
    it('eblStab', 'disp.eblStab', 'enum', 'EBL 오프셋 기준', 'EBL OFFSET BASE', '오프셋 EBL 원점을 지리 고정(GND)·선수 고정(HDG)·북 고정(NORTH) 중 무엇으로 둘지 정합니다.', 'Fixes the offset EBL origin to ground, heading or north.', { opts: enumOf(['GND', 'HDG', 'NORTH']) }),
    it('piMax', 'disp.piMax', 'enum', 'PI선 개수', 'MAX PI LINES', '평행 지시선(PI)의 개수입니다.', 'Number of parallel index lines.', { opts: enumOf([1, 2, 3, 6]) }),
    it('piMode', 'disp.piMode', 'enum', 'PI선 모드', 'PI LINE MODE', '평행(PARALLEL) 또는 수직(PERPENDIC)으로 그립니다.', 'Parallel or perpendicular lines.', { opts: enumOf(['PARALLEL', 'PERPENDIC']) }),
  ] },
  { id: 'alerts', ko: '경보(ALERTS)', en: 'ALERTS', items: [
    it('watch', 'alert.watch', 'enum', '당직 경보', 'WATCH ALERT', '정해진 시간마다 당직자에게 확인을 요구합니다(분).', 'Asks the watch officer to respond at intervals (minutes).', { opts: [E(0, 'OFF'), E(6, '6min'), E(10, '10min'), E(12, '12min'), E(15, '15min'), E(20, '20min')] }),
    it('volume', 'alert.volume', 'enum', '경보음 크기', 'ALERT VOLUME', '경보음 크기입니다.', 'Alert sound volume.', { opts: enumOf(['OFF', 'LOW', 'MID', 'HIGH']) }),
    it('anchorOn', 'alert.anchorOn', 'bool', '닻 감시', 'ANCHOR WATCH', '투묘 위치에서 정한 거리 밖으로 벗어나면 경보를 울립니다.', 'Alerts when the ship drifts beyond the set distance from the anchor position.'),
    it('anchorR', 'alert.anchorR', 'num', '닻 감시 거리(NM)', 'ANCHOR WATCH RANGE', '닻 감시 반경입니다.', 'Anchor watch radius.', { min: 0.05, max: 9.99, step: 0.01 }),
  ] },
  { id: 'ttais', ko: 'TT·AIS', en: 'TT·AIS', items: [
    it('vector', 'tt.vector', 'enum', '벡터 모드', 'VECTOR', '진(TRUE) 벡터는 실제 침로·속력, 상대(REL) 벡터는 자선 기준 움직임으로 충돌 위험을 바로 봅니다.', 'TRUE shows actual course and speed; REL shows motion relative to own ship for collision risk.', { opts: enumOf(['TRUE', 'REL']) }),
    it('vecMin', 'tt.vecMin', 'enum', '벡터 시간(분)', 'VECTOR TIME', '벡터 길이가 나타내는 시간입니다.', 'Time represented by vector length.', { opts: enumOf([1, 2, 3, 6, 12, 15, 30]) }),
    it('pastPts', 'tt.pastPts', 'enum', '과거 위치 점 수', 'PAST POSN POINTS', '과거 위치 점의 개수입니다.', 'Number of past position dots.', { opts: enumOf([5, 10]) }),
    it('pastInt', 'tt.pastInt', 'enum', '과거 위치 간격', 'PAST POSN INTERVAL', '과거 위치 점 사이 시간(초)입니다.', 'Time between past position dots (s).', { opts: [E(30, '30s'), E(60, '1min'), E(120, '2min'), E(180, '3min'), E(360, '6min')] }),
    it('cpa', 'tt.cpa', 'num', 'CPA 한계(NM)', 'CPA LIMIT', '이 거리보다 가까이 지나갈 물표는 위험 물표로 경보합니다.', 'Targets passing closer than this are dangerous.', { min: 0.1, max: 9.9, step: 0.1 }),
    it('tcpa', 'tt.tcpa', 'num', 'TCPA 한계(분)', 'TCPA LIMIT', '이 시간 안에 최근접점에 이르는 물표만 경보합니다.', 'Only targets reaching CPA within this time alarm.', { min: 1, max: 99, step: 1 }),
    it('cpaOn', 'tt.cpaOn', 'bool', 'CPA/TCPA 경보', 'CPA/TCPA ALARM', 'CPA/TCPA 경보를 켜고 끕니다.', 'Turns the CPA/TCPA alarm on or off.'),
    it('ttSelect', 'tt.select', 'enum', '포착 개수 배분', 'TT SELECT', '수동·자동 포착 개수 배분입니다.', 'Split between manual and automatic acquisition.', { opts: enumOf(['MANUAL 100', 'MANUAL 75•AUTO 25', 'MANUAL 50•AUTO 50', 'MANUAL 25•AUTO 75', 'AUTO 100']) }),
    it('lostFilter', 'tt.lostFilter', 'bool', '분실 경보 거리 필터', 'LOST TGT FILTER', '먼 물표를 잃어도 경보하지 않게 합니다.', 'Suppresses lost-target alarms for distant targets.'),
    it('lostMaxRng', 'tt.lostMaxRng', 'num', '분실 필터 거리(NM)', 'LOST FILTER RANGE', '이 거리 밖 분실은 경보하지 않습니다.', 'No lost alarm beyond this range.', { min: 1, max: 99, step: 1 }),
    it('trialMode', 'tt.trialMode', 'enum', '시험 조선', 'TRIAL MANEUVER', '침로·속력을 바꾸면 각 물표의 CPA가 어떻게 되는지 미리 봅니다.', 'Previews the CPA of each target for a planned course and speed.', { opts: enumOf(['OFF', 'STATIC']) }),
    it('trialDelay', 'tt.trialDelay', 'num', '시험 조선 지연(분)', 'TRIAL DELAY', '조치를 시작하기까지 걸리는 시간입니다.', 'Delay before the manoeuvre starts.', { min: 0, max: 30, step: 0.5 }),
    it('symColor', 'tt.symColor', 'enum', '심볼 색', 'TT•AIS SYMBOL COLOR', 'TT·AIS 심볼 색입니다.', 'Symbol colour.', { opts: enumOf(['GRN', 'BLU', 'CYA', 'MAG', 'WHT']) }),
    it('aisDisp', 'ais.disp', 'bool', 'AIS 표시', 'AIS DISPLAY', 'AIS 물표를 표시합니다.', 'Shows AIS targets.'),
    it('aisMaxRngOn', 'ais.maxRngOn', 'bool', 'AIS 거리 필터', 'AIS MAX RANGE', '이 거리 밖 AIS 물표를 숨깁니다(위험 물표는 항상 표시).', 'Hides AIS targets beyond the range (dangerous ones always shown).'),
    it('aisMaxRng', 'ais.maxRng', 'num', 'AIS 거리(NM)', 'AIS RANGE', 'AIS 거리 필터 값입니다.', 'AIS range filter.', { min: 1, max: 99, step: 1 }),
    it('aisMinSpdOn', 'ais.minSpdOn', 'bool', 'AIS 속력 필터', 'AIS MIN SPEED', '느린 물표를 숨깁니다.', 'Hides slow targets.'),
    it('aisMinSpd', 'ais.minSpd', 'num', 'AIS 최소 속력(kn)', 'AIS MIN SPEED VALUE', 'AIS 속력 필터 값입니다.', 'AIS speed filter.', { min: 0, max: 9.9, step: 0.1 }),
    it('aisExceptB', 'ais.exceptB', 'bool', 'Class B 제외', 'EXCEPT CLASS B', '소형선 Class B AIS를 숨깁니다.', 'Hides Class B (small craft) AIS.'),
    it('aisCpaAuto', 'ais.cpaAutoOn', 'bool', 'CPA 자동 활성', 'CPA AUTO ACTIVATE', '정한 거리 안 AIS 물표를 자동으로 활성화합니다.', 'Activates AIS targets within the set range automatically.'),
    act('acqZone', '포착 구역 설정', 'SET ACQ ZONE', 'PPI에서 두 점을 눌러 자동 포착 구역을 정합니다.', 'Click two points on the PPI to set an acquisition zone.'),
    act('ttCancelAll', 'TT 전체 해제', 'TT ALL CANCEL', '추적 중인 물표를 모두 해제합니다.', 'Cancels all tracked targets.'),
    act('sleepAll', 'AIS 모두 휴면', 'SLEEP ALL TARGETS', '활성 AIS 물표를 모두 휴면으로 돌립니다.', 'Puts all activated AIS targets to sleep.'),
    act('aisMsgs', '받은 AIS 메시지', 'RECEIVED MSGS', '받은 안전 메시지 목록을 봅니다.', 'Shows received safety messages.'),
    act('ownData', '자선 AIS 정보', 'OWN SHIP DATA', '자선 AIS 정보(이름·호출부호·위치·침로·속력)를 봅니다.', 'Shows own ship AIS data.'),
  ] },
  { id: 'files', ko: '설정(FILES)', en: 'FILES', items: [
    act('save', '설정 저장', 'SAVE SETTINGS', '지금 설정을 이 브라우저에 저장합니다.', 'Saves the current settings in this browser.'),
    act('load', '설정 불러오기', 'LOAD SETTINGS', '저장한 설정을 불러옵니다.', 'Loads saved settings.'),
    act('reset', '기본값으로', 'DEFAULT', '모든 설정을 처음 값으로 되돌립니다.', 'Restores all settings to defaults.'),
    it('lang', 'ui.lang', 'enum', '언어', 'LANGUAGE', '메뉴·도움말 언어입니다. 장비 약어는 영어 그대로입니다.', 'Menu and help language. Equipment abbreviations stay in English.', { opts: [E('ko', '한국어', 'KOREAN'), E('en', 'English', 'ENGLISH')] }),
  ] },
];

export const allItems = () => MENU.flatMap((m) => m.items);
export function getPath(o, path) { return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o); }
const byPath = () => Object.fromEntries(allItems().filter((i) => i.path).map((i) => [i.path, i]));
export function setPath(o, path, v) {
  const item = byPath()[path];
  if (item) {
    if (item.type === 'enum' && !item.opts.some((x) => x.v === v)) return false;
    if (item.type === 'num') { v = Number(v); if (!isFinite(v)) return false; v = Math.min(item.max, Math.max(item.min, v)); }
    if (item.type === 'bool') v = !!v;
  }
  const ks = path.split('.'), last = ks.pop(), tgt = ks.reduce((a, k) => a[k], o);
  tgt[last] = v; return true;
}

/* 맞춤 영상(공장값) — 근거: 매뉴얼 1.28 Customized echo */
const base = { ir: 2, es: 0, eav: 0, noiseRej: false, sea: { auto: false, val: 30 }, rain: { auto: false, val: 0 }, gain: 65, ace: false };
export const PRESETS = Object.freeze({
  CUSTOM1: { ...base }, CUSTOM2: { ...base }, CUSTOM3: { ...base },
  NEAR: { ...base, eav: 1, sea: { auto: false, val: 40 }, rain: { auto: false, val: 20 }, gain: 60 },
  FAR: { ...base, es: 1, sea: { auto: false, val: 10 }, gain: 75 },
  'ROUGH SEA': { ...base, ir: 3, eav: 2, noiseRej: true, sea: { auto: true, val: 50 }, rain: { auto: true, val: 50 } },
  SHIP: { ...base, es: 1, gain: 68 },
  HARBOR: { ...base, eav: 1, sea: { auto: false, val: 50 }, rain: { auto: false, val: 30 }, gain: 55 },
  COAST: { ...base, eav: 1, rain: { auto: false, val: 10 } },
});
const saved = {};
const KEYS = Object.keys(base);
export function applyPreset(S, id) {
  const p = saved[id] || PRESETS[id]; if (!p) return false;
  for (const k of KEYS) S.ctrl[k] = structuredClone(p[k]);
  S.ctrl.preset = id; return true;
}
export function savePreset(S, id) { saved[id] = Object.fromEntries(KEYS.map((k) => [k, structuredClone(S.ctrl[k])])); }
export function restorePreset(id, which = 'factory') { if (which === 'factory') delete saved[id]; }
export const savedPresets = () => saved;
/* 저장된 맞춤 영상: 값이 빠졌거나 모양이 다르면 그 항목은 기본값으로(깨진 값 하나로 화면이 멈추지 않게) */
export function loadSavedPresets(obj) { if (obj && typeof obj === 'object') for (const k of Object.keys(PRESETS)) { const p = obj[k]; if (!p || typeof p !== 'object') continue; const fixed = {}; for (const key of KEYS) { const d = PRESETS[k][key], v = p[key]; fixed[key] = v === undefined || v === null || typeof v !== typeof d || (typeof d === 'object' && (typeof v.val !== 'number' || !isFinite(v.val))) ? structuredClone(d) : v; } saved[k] = fixed; } }
