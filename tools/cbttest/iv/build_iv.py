"""면접 기출 데이터 빌드: parsed3.json -> interview.json
- 줄바꿈 이어붙이기, 문항/답변 파트 구조화, 키워드(IDF) 추출, 영어 정확일치 대상 표시
"""
import json, re, math, os, collections
P = os.path.dirname(os.path.abspath(__file__)) + '/'
raw = json.load(open(P + 'parsed3.json'))
SUBC = {'기관1':'e1','기관2':'e2','기관3':'e3','영어':'en','직무일반':'gen','법규':'law','상선전문':'mer','어선전문':'fish','운용':'op','항해':'nav'}
FIGS = set(f[:-6] for f in os.listdir(P + '../../../apps/cbttest/data/iv'))  # 'E1_e1_01'

QFIX = {
'E1_e1_04':'첨부한 보슈식 연료분사펌프 그림에서 다음 문항을 설명\n(1) ⓐ 래크의 역할\n(2) ⓑ 래크의 역할',
'E1_e1_14':'첨부한 디젤 주기관의 부하선도에서 다음 문항을 설명\n(1) Ⓐ점에서 운전 중인 경우에 증가시킬 수 있는 최대 RPM과 그 이유\n(2) Ⓑ점에서 운전 중인 경우에 증가시킬 수 있는 최대 RPM과 그 이유',
'E1_e2_06':'첨부한 셀프젝터 유 청정기의 기동특성 곡선에서 Ⓐ, Ⓑ, Ⓒ, Ⓓ가 어떠한 상태인지에 대해 설명',
'E1_e3_07':'첨부한 ATO 공기압식 포지셔너의 밸브개도와 출력공기압의 선도에서 점선은 현재값, 실선은 정상값인 경우에 대해 다음 문항을 설명\n(1) 보정을 위해 무엇을 조정해야 하는지에 대해 설명\n(2) 보정을 위한 조정방법',
'E1_e3_10':'첨부한 PID 제어기 사진에서 다음 문항을 설명\n(1) A의 설정값을 작게 조정했을 경우의 PID 제어기의 동작\n(2) B의 설정값을 크게 조정했을 경우의 PID 제어기의 동작',
'E2_e1_04':'첨부한 디젤기관의 부속장치 도면에서 다음 문항을 설명\n(1) 장치의 명칭\n(2) ①, ②, ③, ④ 부품의 명칭\n(3) ⑪의 역할',
'E2_e1_12':'첨부한 디젤 주기관의 성능곡선에서 연료소모율이 가장 낮은 상태로 운전 중 과급기의 회전수가 11,300[rpm], 소기압력이 1.5[kgf/cm2]인 경우에 대해 다음 문항을 설명\n(1) 현재 기관의 상태\n(2) 비정상적인 원인',
'E2_e1_13':'첨부한 Airguard식 유윤활식 선미관 장치 도면에서 Ⓐ, Ⓑ, Ⓒ, Ⓓ, Ⓔ에 작용하는 작동유체에 대해 설명',
'E2_e2_08':'첨부한 냉동장치의 유압보호스위치 도면과 사진에서 다음 문항을 설명\n(1) Ⓐ와 Ⓑ가 연결되는 위치\n(2) 스위치가 작동되는 과정',
'E2_e3_10':'첨부한 기관실 통풍용 팬 전동기 기동회로에서 사각형 ①내의 타이머 2의 역할에 대해 설명',
'E2_e1_08':'첨부한 디젤기관의 Operating data에서 다음 문항을 설명\n(1) 배기밸브를 닫는 유체의 종류 및 적정 압력\n(2) 배기밸브를 닫는 유체의 압력에 의한 자동감속 및 자동정지 조건',
'E2_e3_06':'첨부한 전동기 기동회로에서 다음 문항을 설명\n(1) 52의 명칭과 역할\n(2) 88의 명칭과 역할\n(3) 51의 명칭과 역할',
'E2_gen_07':'첨부된 표를 참조하여 부산항을 출항하여 LA항 입항시까지 필요한 최소 연료유 청구량에 대해 다음 문항을 설명\n(1) 계산과정\n(2) 청구량',
'E2_en_12':'PSCO가 기관장에게 다음과 같은 질문을 하였을 때 답변을 영어로 표현\n“How often do you hold security drills, training or exercises?”',
}
AFIX = {
 'N1_nav_13': [('A1(\n개), A2(\n5개), B(\n4개), C(\n3개), D(\n2개)', 'A1(★6개), A2(★5개), B(★4개), C(★3개), D(★2개)')],
}
EN_ALT = {'E1_en_02','E1_en_03','E1_en_04','E1_en_06','E2_en_06','E2_en_15'}

HANGUL = re.compile(r'[가-힣]')
NEWLINE_START = re.compile(r'^(\(\d+\)|[-–ㆍ·•※\xad]|[①-⑳]|[Ⓐ-Ⓩ]|[ⓐ-ⓩ]|\d+\)|[가-하]\.|Inspector\s*:|Master\s*:|C/E\s*:|Master\(|“|")')
NEXT_PARTICLE = tuple('을 를 은 는 의 에 로 와 과 도 만 고 며 면 서 여 하 한 할 함 했 해 되 된 될 됨 음 임 다 니 습 시 요 져 짐 지 게 써 야 어 아 였 았 었'.split())
PREV_FINAL = set('을 를 은 는 의 에 로 와 과 도 만 고 며 면 서 여 및 등 가 이 한 된 할 는 인 적 든 나 데 우 때 후 중 시 를 지'.split())
SHORT_WORDS = {'그','및','또는','각','이','저','두','세','한','등','즉','또','더','잘','안','못','각각','모든','다른','같은'}

def join_char(a_line, b_line):
    a, b = a_line[-1], b_line[0]
    if not HANGUL.match(a) or not HANGUL.match(b):
        if a in '(/' or b in ')/,.': return ''
        return ' '
    last_word = a_line.split()[-1] if a_line.split() else ''
    if last_word in SHORT_WORDS: return ' '
    if b_line.startswith(NEXT_PARTICLE) and not re.match(r'^(이유|이상|이하|이동|이용|이내|이외|이후|이전|이물|하역|하부|하중|하강|하는|시동|시간|시험|시스템|시작|시점|해수|해당|해상|해양|해도|되며|지시|지정|지역|고정|고장|고압|고온|로프|로터|면적|서로|여유|여러|도선|도면|만재|만약|다음|다른|다량|다만|니들|아래|어선|요구)', b_line):
        return ''
    if a in PREV_FINAL and len(last_word) >= 2: return ' '
    return ''

def logical_lines(text):
    out = []
    for l in text.split('\n'):
        l = l.strip()
        if not l: continue
        if l.startswith('과 목 명'): continue
        l = l.replace('\xad', '-').replace('（', '(').replace('）', ')')
        if not out or NEWLINE_START.match(l): out.append(l)
        else: out[-1] = out[-1] + join_char(out[-1], l) + l
    return out

def strip_labels(lines):
    # 그림 라벨 잔여(짧은 줄) 제거: 끝부분의 3자 이하 줄
    while lines and len(lines[-1]) <= 4 and not lines[-1].startswith('('): lines.pop()
    return lines

def parts_of_q(lines):
    stem, subs = [], []
    for l in lines:
        m = re.match(r'^\((\d+)\)\s*(.*)', l)
        if m: subs.append(m.group(2))
        elif subs: subs[-1] += ' ' + l
        else: stem.append(l)
    return ' '.join(stem) if False else '\n'.join(stem), subs

def is_bullet(l): return bool(re.match(r'^([-–ㆍ·•]|[①-⑳]|[Ⓐ-Ⓩ]|[ⓐ-ⓩ])', l))

def parts_of_a(lines, nsub):
    """답변을 파트로. (n) 머리줄 + 불릿 구조면 머리줄은 제목, 아니면 (n) 줄 자체가 답."""
    parts = []
    cur = None
    for l in lines:
        m = re.match(r'^\((\d+)\)\s*(.*)', l)
        if m:
            cur = {'h': m.group(2), 'items': []}
            parts.append(cur)
        else:
            if cur is None:
                cur = {'h': '', 'items': []}; parts.append(cur)
            if is_bullet(l) or not cur['items']:
                cur['items'].append(re.sub(r'^[-–ㆍ·•]\s*', '', l))
            else:
                cur['items'][-1] += ' ' + l
    for p in parts:
        if not p['items']:  # (n) 줄 자체가 답
            p['items'] = [p['h']]; p['h'] = ''
    return parts

def is_en(s):
    letters = re.findall(r'[A-Za-z가-힣]', s)
    if not letters: return False
    return sum(1 for c in letters if HANGUL.match(c)) / len(letters) < 0.08

# ---------- 키워드 ----------
PARTICLES = ['에서는','에서의','에서도','으로서','으로써','으로는','으로도','에게서','에게','에서','으로','로서','로써','로는','로도','과의','와의','에는','에도','부터','까지','마다','보다','처럼','이나','이며','이고','이다','이란','의','에','를','을','이','가','과','와','로','은','는','도','만','및','등']
NOUN_EVID = {'의','에서는','에서의','에서도','으로서','으로써','으로는','으로도','에게','에서','으로','로서','로써','로는','로도','과의','와의','에는','에도','부터','까지','마다','보다','처럼','이나','를','이','가','과','와','로','등','및','이며','이고','이다','이란'}
VERB_END = re.compile(r'(하여야|하여서|해야함|해야|하여|하고|하는|하며|하면|하지|하기|하게|하도록|했을|했던|한다|함으로|함|한|할|된다|되는|되어|되며|되면|되고|되기|되지|되도록|됨|된|될|시킴|시킨|시키는|시켜|있음|있는|있어|있고|있으며|없음|없는|없이|않음|않는|않고|않으며|않도록|으므로|므로|거나|하거나|으며|으면|으로써|도록|기도|지만)$')
NOUN_SUFFIX = re.compile(r'(기|관|치|브|프|압|력|도|량|율|률|수|선|판|등|계|기관|장치|밸브|펌프|온도|압력|유|수|물|기능|역할|현상|원인|조치|방법|증서|검사|규칙|법|협약|신호|형상물|등화|정의|종류|시험|훈련|구역|해역|구간|위치|시간|기간|거리|속력|속도|각|점|면|부|실|탱크|라인|회로|스위치|센서|램프|접점|코일|모터|전동기|발전기|변압기|차단기|계전기|접촉기|타이머|컨버터|청정기|조수기|보일러|과급기|냉각기|가열기|증발기|응축기|압축기)$')
def split_tok(r):
    """원형 토큰 -> (stem, evidence suffix or None)"""
    for s in PARTICLES:
        if len(r) > len(s) and r.endswith(s): return r[:-len(s)], s
    return r, ''
# ---------- build ----------
data = []
for x in raw:
    iid = ('N' if x['job'] == '항해' else 'E') + str(x['g']) + '_' + SUBC[x['sub']] + '_%02d' % x['n']
    a = x['a'].split('\n참고문헌')[0]
    for o, n in AFIX.get(iid, []): a = a.replace(o, n)
    if iid in QFIX: qlines = logical_lines(QFIX[iid].replace('\n(', '\n\n('))
    else:
        qlines = logical_lines(x['q'])
        if iid in FIGS: qlines = strip_labels(qlines)
    stem_q, subs = parts_of_q(qlines)
    alines = logical_lines(a)
    parts = parts_of_a(alines, len(subs))
    data.append({'id': iid, 'job': x['job'], 'g': x['g'], 'sub': x['sub'], 'n': x['n'], 'q': stem_q, 'qs': subs,
                 'fig': iid in FIGS, 'parts': parts})


POVR = {
 'E1_e2_14': [
   {'h':'원인','items':['시체스트 또는 Strainer 내부에 Air가 찼을 경우','Anode가 전부 소모되었을 경우','Anode 케이블이 단락되었을 경우','Power module이 손상되었을 경우','Display key pad가 손상되었을 경우']},
   {'h':'원인별 조치방법','items':['(Air가 찬 경우) Air vent를 개폐하여 Air를 제거','(Anode 소모) Panel 내부 단자대에서 Anode cable을 상호교환 점검하여 Anode 상태를 확인하고 소모된 Anode 신환','(케이블 단락) Anode 케이블 결선 상태 및 단락여부 확인 후 조치','(Power module 손상) Power module 신환','(Display key pad 손상) Display key pad 신환']}],
 'E2_e2_01': [
   {'h':'원인','items':['가열기의 가열능력이 부족한 경우','증발기내 진공도가 저하한 경우','급수량이 부족한 경우','응축기의 냉각능력이 부족한 경우','Distillate pump가 불량한 경우']},
   {'h':'원인별 조치방법','items':['(가열능력 부족) 주기관으로부터 재킷 냉각수 공급량을 증가','(진공도 저하) 추기용 이젝터 점검, Vacuum breaker 점검, 누설부 점검','(급수량 부족) 급수밸브를 적절히 조절','(냉각능력 부족) 냉각수량을 증가, 응축기 소제, 응축기내 공기 제거','(Distillate pump 불량) Distillate pump 점검']}],
 'E2_gen_10': [
   {'h':'유효기간이 있는 선급검사의 종류','items':['정기검사','중간검사','연차검사','입거검사','프로펠러축 및 선미관축 검사','보일러 검사','계속검사']},
   {'h':'검사종류별 검사주기','items':['정기검사: 매 5년','중간검사: 매 2.5년','연차검사: 매 1년','입거검사: 매 2.5년','프로펠러축 및 선미관축 검사: 매 5년','보일러 검사: 매 2.5년','계속검사: 매 5년']}],
}
for d in data:
    if d['id'] in POVR: d['parts'] = POVR[d['id']]

# ---------- 후처리 ----------
for d in data:
    for p in d['parts']:
        p['items'] = [re.sub(r'A1\(\s*6\s*개\), A2\(\s*5개\), B\(\s*4개\), C\(\s*3개\), D\(\s*2개\)', 'A1(★6개), A2(★5개), B(★4개), C(★3개), D(★2개)', it) for it in p['items']]
    # Inspector/Master 형식: 해석(한글) + 답변(영어) 두 파트로
    if d['sub'] == '영어' and len(d['parts']) == 1 and d['parts'][0]['items'][0].startswith('Inspector'):
        t = ' '.join(d['parts'][0]['items'])
        m = re.match(r'Inspector\s*:\s*(.*?)\s*Master\s*:\s*(.*)$', t)
        d['parts'] = [{'h': '검사관 질문 해석', 'items': [m.group(1)]}, {'h': '선장 답변 (영어)', 'items': [m.group(2)]}]
        d['qs'] = ['검사관 질문 해석', '선장 답변 (영어)']

# ---------- 키워드 ----------
STOP = set('''경우 위해 위하여 따라 따른 대한 관한 대해 것 수 때 다음 설명 그 이 저 각 모든 다른 해당 같은 이상 이하 이내 또는 또한 그리고 이를 이에 이때 만약 즉 때문 정도 사용 상태 방법 부분 내용 통해 의해 관련 실시 시행 확인 필요 가능 일부 전부 각각 기타 해당 본선 선박 경우에 대하여 의하여 통하여 이후 이전 동안 중 후 전 시 등 및 것을'''.split())
EN_STOP = set('the a an of to and or in on at for is are be by with as it this that from we our you your i if'.split())
# 1) 코퍼스에서 명사 증거 수집
noun_ev = collections.Counter(); seen_bare = collections.Counter()
def raw_tokens(s):
    s = re.sub(r'[“”"\'‘’`´]', '', s)
    return [r.strip('.') for r in re.split(r'[\s,·ㆍ/()\[\]{}<>:;!?~=+→⇒⇨–]+', s) if r.strip('.')]
for d in data:
    for p in d['parts']:
        for it in p['items']:
            for r in raw_tokens(it):
                if not HANGUL.search(r): continue
                st, suf = split_tok(r)
                if suf in NOUN_EVID: noun_ev[st] += 1
ALLTOK = collections.Counter(r for d in data for p in d['parts'] for it in p['items'] for r in raw_tokens(it))
def keep_whole(r, suf):
    if suf not in ('이','도','가','과','와','로','의','기'): return False
    if ALLTOK[r] >= 2: return True
    return any(t != r and t.startswith(r) and len(t) - len(r) <= 2 for t in ALLTOK)
def cand(it):
    out = []
    for r in raw_tokens(it):
        r = r.strip('-')
        if not r: continue
        if not HANGUL.search(r):
            t = r.lower()
            if re.fullmatch(r'[①-⑳Ⓐ-Ⓩⓐ-ⓩ]+', r): out.append(r); continue
            if t in EN_STOP or len(t) < 2 and not t.isdigit(): continue
            out.append(t); continue
        if VERB_END.search(r) and not NOUN_SUFFIX.search(split_tok(r)[0]):
            # 동사: 앞의 명사부(…하는 -> 명사) 살리기
            m = re.match(r'^(.{2,}?)(하여야|하여서|해야함|해야|하여|하고|하는|하며|하면|하지|하기|하게|하도록|했을|했던|한다|함으로|함|한|할|된다|되는|되어|되며|되면|되고|되기|되지|되도록|됨|된|될|시킴|시킨|시키는|시켜)$', r)
            if m and m.group(1) not in STOP: out.append(m.group(1))
            continue
        st, suf = split_tok(r)
        if keep_whole(r, suf): st, suf = r, ''
        if re.match(r'^제\d', st) or re.search(r'조제\d|호라목|[\u4e00-\u9fff]', st) or re.search(r'(려|받|겠다|더라|까지|때까지)$', st): continue  # 조문 번호 등
        if st in STOP or len(st) < 2 and not re.search(r'\d', st): continue
        if suf or noun_ev[st] or NOUN_SUFFIX.search(st) or re.search(r'\d', st) or not re.search(r'(어|아|고|며|게|지|서|면|니|다|요|라)$', st):
            out.append(st)
    res = []
    for t in out:
        if t not in res: res.append(t)
    return res
docs = [set(cand(it)) for d in data for p in d['parts'] for it in p['items']]
df = collections.Counter(t for dd in docs for t in dd); N = len(docs)
def idf(t): return math.log((N + 1) / (df[t] + 0.5))
def pick_kw(item):
    toks = cand(item)
    if not toks:
        toks = [t for t in (split_tok(r)[0] if len(split_tok(r)[0]) >= 2 else r for r in raw_tokens(item)) if t not in STOP][-2:]
    if not toks: return []
    k = max(1, min(5, math.ceil(len(toks) * 0.5)))
    sc = sorted(toks, key=lambda t: -(idf(t) + (1.0 if re.search(r'\d', t) else 0) + min(len(t), 6) * 0.15))
    keep = set(sc[:k])
    return [t for t in toks if t in keep]

for d in data:
    for i, p in enumerate(d['parts']):
        en = all(is_en(it) for it in p['items']) and d['sub'] == '영어'
        p['en'] = en
        if en: p['mode'] = 'alt' if d['id'] in EN_ALT else 'seq'
        else: p['kw'] = [pick_kw(it) for it in p['items']]
        qtxt = d['qs'][i] if i < len(d['qs']) else d['q']
        m = re.search(r'(\d+)\s*(가지|개)\s*이상', qtxt)
        if m: p['need'] = int(m.group(1))
json.dump(data, open(P + 'interview_auto.json', 'w'), ensure_ascii=False)
print(len(data), 'questions', sum(len(d['parts']) for d in data), 'parts')
print('part/sub mismatch:', [(d['id'], len(d['qs']), len(d['parts'])) for d in data if d['qs'] and len(d['qs']) != len(d['parts'])])
