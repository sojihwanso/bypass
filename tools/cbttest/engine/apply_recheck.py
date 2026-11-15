"""오후 요청 2·3번 결과를 해설에 반영: work/recheck/r*.json, work/deckexp/d*.json → exp/out/zz_overrides.json (exp_merge에서 가장 나중에 적용)
- confirmed: 깨끗한 해설(표시 없음)
- uncertain: 해설 + ' (정답표 기준) ※ 확실하지 않음: …'
- 이전에 '※ 확실하지 않음'만 붙인 31문항에도 '(정답표 기준)'을 함께 붙여 형식을 맞춘다"""
import json, glob, os, re
H = os.path.dirname(os.path.abspath(__file__)); OUT = H + '/../exp/out'
NOTE = '※ 확실하지 않음: 출제 당시 기준과 현행 규정·실제 내용이 달라 정답표와 다를 수 있습니다.'
def unc(t):
    t = re.sub(r'\s*\(정답표 기준\)', '', t.strip()); t = t.replace(' ' + NOTE, '').replace(NOTE, '').strip()
    if not t.endswith(('.', '다')): t += '.'
    return t + ' (정답표 기준) ' + NOTE
def clean(t):
    return re.sub(r'\s*\(정답표 기준\)', '', t.replace(NOTE, '')).strip()
ov = {}; c = {'confirmed': 0, 'uncertain': 0, 'new': 0, 'new_unc': 0, 'retag31': 0}
for f in sorted(glob.glob(H + '/work/recheck/r*.json')):
    for k, v in json.load(open(f)).items():
        if not v.get('exp'): continue
        if v.get('verdict') == 'confirmed': ov[k] = clean(v['exp']); c['confirmed'] += 1
        else: ov[k] = unc(v['exp']); c['uncertain'] += 1
for f in sorted(glob.glob(H + '/work/deckexp/d*.json')):
    for k, v in json.load(open(f)).items():
        if not v.get('exp'): continue
        if v.get('uncertain'): ov[k] = unc(v['exp']); c['new_unc'] += 1
        else: ov[k] = clean(v['exp']); c['new'] += 1
for f in sorted(glob.glob(H + '/work/websearch/w*.json')) + sorted(glob.glob(H + '/work/websearch/x*.json')):  # 웹 검증 결과가 recheck·deckexp보다 우선 (계산 규칙만 그 뒤), x*는 한도 소진분 재검증
    for k, v in json.load(open(f)).items():
        if not v.get('exp'): continue
        if re.search(r'검색\s*한도|한도\s*(?:\(세션|소진)|미검색', v.get('src', '')): continue  # 검색 한도 때문에 근거 없이 채운 문항은 이전 판정 유지
        ov[k] = clean(v['exp']) if v.get('verdict') == 'confirmed' else unc(v['exp'])
if os.path.exists(H + '/work/calcfix.json'):  # 계산 문항 규칙(정답표대로 확실, 공식은 조사한 그대로)
    for k, v in json.load(open(H + '/work/calcfix.json')).items():
        if v.get('exp'): ov[k] = clean(v['exp']) if v.get('verdict') == 'confirmed' else unc(v['exp'])
V = json.load(open(H + '/verify_2026-11-08.json'))
cur = {}
for f in sorted(glob.glob(OUT + '/*.json')):
    if os.path.basename(f).startswith('zz_'): continue
    cur.update(json.load(open(f)))
for k, v in V.items():
    if v['verdict'] == 'key_doubt' and k not in ov and k in cur: ov[k] = unc(cur[k]); c['retag31'] += 1
json.dump(dict(sorted(ov.items())), open(OUT + '/zz_overrides.json', 'w'), ensure_ascii=False, indent=0)
print(c, 'total', len(ov))
