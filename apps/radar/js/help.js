/* 도움말: 화면 구성 · 메뉴별 기능(MENU에서 자동) · 키보드(KEYMAP에서 자동) · 약어 · 시나리오 안내 · 근거 */
import { MENU } from './menu.js';
import { KEYMAP } from './keys.js';
import { SCENARIOS } from './scenarios.js';
import { tl, lang } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TABS = [['screen', '화면 구성', 'Screen'], ['menu', '메뉴별 기능', 'Menu items'], ['keys', '키보드·마우스', 'Keyboard & mouse'], ['abbr', '약어', 'Abbreviations'], ['scn', '시나리오', 'Scenarios'], ['src', '근거·알아 둘 점', 'Sources & notes']];
const KO_SCREEN = `<h4>화면 세 구역</h4><ul>
<li><b>왼쪽 빠른 조작 막대</b>: 송신(TX/STBY), 방위 모드(HU·CU·NU), 운동 모드(RM·TM), 중심 이동, 맞춤 영상, 항적, PI선, 포착 구역, 일시정지, 배속, 시나리오, 화면 밝기(주간·박명·야간), Conning, 캡처, 메뉴.</li>
<li><b>가운데 레이더 화면(PPI)</b>: 자선이 중심(또는 중심 이동한 곳)에 있고, 바깥 원에 진방위 눈금이 있어요. 흰 선이 선수선, 자선에서 나온 선이 자선 벡터예요.
<br>왼쪽 위: 거리 범위(휠·+/−로 바꾸기)와 거리환 간격, 방위·운동 모드, 밴드, 펄스 길이, 송신 상태.
<br>오른쪽 위: <b>GAIN·SEA·RAIN·TUNE</b> 막대(마우스 휠로 조정, SEA·RAIN·TUNE 이름을 누르면 자동/수동 전환)와 커서 위치(방위·거리·위경도·도달 시간).
<br>아래 왼쪽: EBL1·EBL2(누르면 켜기, 값 위에서 휠로 돌리기). 아래 오른쪽: VRM1·VRM2.</li>
<li><b>오른쪽 정보창</b>: 자선(선수방위·속력·위치), 도움말, 고른 물표 두 개의 정보(BRG·RNG·COG·SOG·CPA·TCPA·BCR·BCT), TT·AIS 설정 요약, 경보(확인·소리 끄기·목록).</li></ul>
<h4>레이더 켜기</h4><p>시나리오는 대기(STBY)로 시작해요. 송신 단추를 누르면 예열(실제 장비는 약 90초, 시뮬레이터는 5초) 뒤 송신(TX)이 되고 영상이 나와요.</p>
<h4>영상 조정 순서</h4><ol><li>거리 범위를 고르고 펄스 길이를 확인해요(짧은 거리 = 짧은 펄스).</li><li>TUNE이 AUTO인지 봐요. 수동이면 영상이 가장 진해지는 곳에 맞춰요.</li><li>GAIN은 화면에 아주 옅은 잡음 점이 살짝 보일 때까지 올려요.</li><li>SEA로 자선 주변 해면 반사를 줄이되, 작은 물표까지 지우지 않게 조금씩 올려요.</li><li>비가 있으면 RAIN을 올려 비 반사를 줄여요. 비 속 물표의 앞 가장자리가 남아요.</li></ol>
<h4>물표 추적(TT)과 AIS</h4><ul><li>물표 위에서 오른쪽 클릭(또는 길게 누르기) → <b>TT 포착</b>. 처음 약 1분은 점선 원(포착 중)으로 벡터가 안정되지 않아요. 그 뒤 실선 원과 벡터가 나와요.</li><li>물표를 왼쪽 클릭하면 오른쪽 정보창에 데이터가 나와요. AIS 삼각형을 누르면 활성화돼요.</li><li>CPA·TCPA 한계 안으로 들어오는 물표는 빨갛게 깜빡이고 알람이 울려요. TT와 AIS가 같은 배로 연관되기 전에는 같은 배에 알람이 두 번 울릴 수 있어요(실제 장비도 같아요).</li><li>Trial maneuver: 메뉴 TT·AIS → 시험 조선을 STATIC으로 켜면 화면 아래 상자의 침로·속력·지연을 휠로 바꿔 각 물표의 예상 CPA를 미리 볼 수 있어요. 위험해지는 물표는 빨갛게 바뀌어요.</li></ul>`;
const EN_SCREEN = `<h4>Three areas</h4><ul><li><b>Left quick bar</b>: TX/STBY, presentation (HU/CU/NU), motion (RM/TM), off-center, echo presets, trails, PI lines, acquisition zone, pause, speed, scenarios, display scheme, conning, capture, menu.</li>
<li><b>Centre PPI</b>: own ship at the centre (or off-centre), true bearing scale outside. Top-left: range and rings, modes, band, pulse, TX state. Top-right: GAIN/SEA/RAIN/TUNE bars (mouse wheel; click a name to toggle auto) and cursor readout. Bottom: EBL and VRM boxes.</li>
<li><b>Right panel</b>: own ship data, help, two selected targets, TT/AIS summary, alerts.</li></ul>
<h4>Switching on</h4><p>Scenarios start in STANDBY. Press TX: after warm-up (about 90 s on real sets, 5 s here) the radar transmits.</p>
<h4>Tuning the picture</h4><ol><li>Choose range, check pulse.</li><li>Keep TUNE on AUTO or peak it by hand.</li><li>Raise GAIN until faint speckle just appears.</li><li>Reduce sea clutter with SEA gradually, keeping small targets.</li><li>Use RAIN in precipitation.</li></ol>
<h4>TT and AIS</h4><ul><li>Right-click a target → Acquire. For about a minute the symbol is dashed while the vector settles.</li><li>Click a target to show its data; click an AIS triangle to activate it.</li><li>Targets inside the CPA/TCPA limits flash red and sound the alarm. Before TT and AIS are associated, one ship can raise two alarms, as on real equipment.</li><li>Trial manoeuvre: Menu → TT·AIS → TRIAL MANEUVER = STATIC; adjust course, speed and delay with the wheel in the box below the PPI.</li></ul>`;
const ABBR = [['ARPA', 'Automatic Radar Plotting Aid · 자동 레이더 플로팅 장치'], ['TT', 'Target Tracking · 물표 추적'], ['AIS', 'Automatic Identification System · 선박 자동 식별 장치'], ['CPA / TCPA', 'Closest Point of Approach / Time to CPA · 최근접 거리 / 그때까지 시간'], ['BCR / BCT', 'Bow Crossing Range / Time · 선수 횡단 거리 / 시간'], ['EBL', 'Electronic Bearing Line · 전자 방위선'], ['VRM', 'Variable Range Marker · 가변 거리환'], ['PI', 'Parallel Index · 평행 지시선'], ['HU / CU / NU', 'Head up / Course up / North up · 선수 위 / 침로 위 / 북쪽 위'], ['RM / TM', 'Relative / True Motion · 상대 운동 / 진운동'], ['STC / FTC', 'Sensitivity / Fast Time Constant · SEA(해면) / RAIN(우설) 억제'], ['IR', 'Interference Rejector · 간섭 제거'], ['ES / EAV', 'Echo Stretch / Echo Average · 영상 확대 / 영상 평균'], ['ACE', 'Automatic Clutter Elimination · 자동 클러터 제거'], ['SART', 'Search And Rescue Transponder · 수색 구조용 레이더 트랜스폰더(12점)'], ['RACON', 'Radar Beacon · 레이더 비컨(모스 부호)'], ['STW / SOG / COG', 'Speed Through Water / Speed & Course Over Ground'], ['ROT', 'Rate of Turn · 선회율'], ['CCRP', 'Consistent Common Reference Point · 공통 기준점'], ['BAM', 'Bridge Alert Management · 선교 경보 관리(알람·경고·주의)'], ['COLREG', '국제해상충돌예방규칙']];
const KO_SRC = `<h4>근거</h4><ul><li>홍태호, 『Radar Navigation』 강의 자료 1~6장(레이더의 원리, 레이더 장치의 작동 원리, 물표의 탐지, 플로팅, ARPA, 지문항해학과 레이더의 활용, 선박조종 시뮬레이션 체험).</li><li>FAR-2xx8 사용 설명서를 참고한 교육용 시뮬레이터입니다. 제조사 장비의 화면·버튼 디자인을 옮기지 않았고, 기능·동작·용어만 참고했어요.</li><li>COLREG 1972 제7·8·13~17·19조, IMO MSC.192(79) 레이더 성능 기준, IMO MSC.302(87) BAM.</li></ul>
<h4>실제 장비와 다른 점</h4><ul><li>예열 시간 5초(실제 약 90초), 배속을 쓰면 물표가 더 빨리 움직여요.</li><li>정비·설치 메뉴, Dual radar, Wave·Doppler, 어망 커서, AIS 메시지 보내기는 없어요.</li><li>해안선은 실제 데이터지만 높이는 모두 100 m로 가정했어요. 조류는 시나리오에 넣지 않았어요.</li><li>시나리오의 상대선은 피하지 않도록 만들었어요. 실제 바다에서는 상대도 움직일 수 있어요.</li><li>교육용입니다. 실제 항해에 쓰지 마세요.</li></ul>`;
const EN_SRC = `<h4>Sources</h4><ul><li>T. Hong, Radar Navigation lecture notes, chapters 1-6.</li><li>An educational simulator referring to the FAR-2xx8 operator's manual for functions and terms only; the manufacturer's screen and button design is not reproduced.</li><li>COLREG 1972 Rules 7, 8, 13-17, 19; IMO MSC.192(79); IMO MSC.302(87).</li></ul><h4>Differences from real equipment</h4><ul><li>5 s warm-up (about 90 s on real sets).</li><li>No maintenance/installation menus, dual radar, wave/Doppler, net cursor or AIS transmit.</li><li>Real coastline, uniform 100 m height; no tidal stream in scenarios.</li><li>Scenario ships never give way.</li><li>Training use only; not for navigation.</li></ul>`;

export function initHelp() {
  let dlg = null;
  function open(tab = 'screen') {
    const en = lang() === 'en';
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'helpDlg'; document.getElementById('app').append(dlg); dlg.addEventListener('click', (e) => { const b = e.target.closest('[data-htab]'); if (b) render(b.dataset.htab); if (e.target.closest('[data-hclose]')) dlg.close(); }); }
    dlg.innerHTML = `<div class="dlg-h"><span>${en ? 'Help' : '도움말'}</span><button class="btn" type="button" data-hclose="1">${en ? 'Close' : '닫기'}</button></div><div class="htabs">${TABS.map(([k, ko, e]) => `<button type="button" data-htab="${k}">${en ? e : ko}</button>`).join('')}</div><div class="dlg-b hbody"></div>`;
    render(tab); if (!dlg.open) dlg.showModal();
  }
  function render(tab) {
    const en = lang() === 'en', b = dlg.querySelector('.hbody');
    for (const x of dlg.querySelectorAll('[data-htab]')) x.classList.toggle('on', x.dataset.htab === tab);
    if (tab === 'screen') b.innerHTML = en ? EN_SCREEN : KO_SCREEN;
    if (tab === 'menu') b.innerHTML = MENU.map((m) => `<h4>${esc(tl(m))}</h4><dl class="hdl">${m.items.map((i) => `<dt>${esc(tl(i))}</dt><dd>${esc(tl(i.help))}</dd>`).join('')}</dl>`).join('');
    if (tab === 'keys') b.innerHTML = `<table class="tbl hkeys">${KEYMAP.map((k) => `<tr><td><kbd>${k.shift ? 'Shift + ' : ''}${k.key === ' ' ? 'Space' : esc(k.key)}</kbd></td><td>${esc(en ? k.en : k.ko)}</td></tr>`).join('')}</table>
      <h4>${en ? 'Mouse and touch' : '마우스·터치'}</h4><ul><li>${en ? 'Left click: select a target or button. Double-click on the PPI: acquire (manual TT).' : '왼쪽 클릭: 물표·단추 고르기. PPI 두 번 클릭: 수동 포착.'}</li><li>${en ? 'Right click (long press on touch): cursor menu — acquire, cancel, target data, EBL/VRM here, offset EBL, range between points, off-center, drop mark, anchor position.' : '오른쪽 클릭(터치는 길게 누르기): 커서 메뉴 — 포착·해제·물표 데이터·EBL/VRM을 여기로·오프셋 EBL·두 점 거리·중심 이동·Drop mark·닻 위치.'}</li><li>${en ? 'Mouse wheel over a box (GAIN, SEA, RAIN, TUNE, RANGE, EBL, VRM, TRIAL): change its value. On touch, drag up or down on the box.' : '상자 위에서 마우스 휠(GAIN·SEA·RAIN·TUNE·RANGE·EBL·VRM·TRIAL): 값 바꾸기. 터치는 상자 위에서 위아래로 끌기.'}</li><li>${en ? 'Conning window: drag the title bar to move, the minus button to hide. Keyboard steering still works while hidden.' : 'Conning 창: 제목줄을 끌어 옮기고, − 단추로 숨겨요. 숨겨도 키보드 조종은 돼요.'}</li></ul>`;
    if (tab === 'abbr') b.innerHTML = `<table class="tbl">${ABBR.map(([a, d]) => `<tr><th scope="row">${a}</th><td>${esc(d)}</td></tr>`).join('')}</table>`;
    if (tab === 'scn') b.innerHTML = `<p>${en ? 'Pass: every ship passes at 0.3 NM or more, with no collision or grounding. Action timing (TCPA) is recorded but not graded.' : '합격: 모든 상대선과 0.3 NM 이상 떨어져 지나가고 충돌·좌초가 없으면 돼요. 조치 시점(TCPA)은 기록만 해요.'}</p>${SCENARIOS.map((s) => `<h4>${s.id} · ${esc(tl(s))} <small>COLREG ${s.rule}</small></h4><p>${esc(tl(s.brief))}</p>`).join('')}`;
    if (tab === 'src') b.innerHTML = en ? EN_SRC : KO_SRC;
    b.scrollTop = 0;
  }
  window.RadarHelp = open;
  return { open };
}
