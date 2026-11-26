"""선사록 데이터 점검: python3 -I check_data.py <apps/ship_info/data 폴더>"""
import json, os, re, sys

d = sys.argv[1]
w = json.load(open(os.path.join(d, 'wage.json'), encoding='utf-8'))
k = json.load(open(os.path.join(d, 'koswec.json'), encoding='utf-8'))

# --- wage
assert len(w['ranks']) == 21 and w['ranks'][0][0] == 'total' and w['ranks'][2][0] == 'master'
assert w['overall']['vessels'] == 6687, w['overall']['vessels']
assert w['overall']['rows'][0] == [25188, 6549, 3455, 2461, 92, 541], w['overall']['rows'][0]
B = w['biz']
assert list(B) == ['ocean', 'coastal', 'deepsea', 'nearsea', 'fmerchant', 'ffish'], list(B)
assert B['ocean']['rows'][0] == [6583, 8848, 4382, 3012, None, 1454], B['ocean']['rows'][0]
assert B['ocean']['types']['LNG']['rows'][0] == [718, 10023, 4691, 3518, None, 1814]
assert B['ocean']['types']['LNG']['vessels'] == 64
assert B['ocean']['types']['자동차']['rows'][2] == [79, 15797, 7188, 5797, None, 2812]
assert B['deepsea']['rows'][2][1] == 25950
assert B['coastal']['types']['LNG']['vessels'] == 2
assert len(B['ocean']['types']) == 11, list(B['ocean']['types'])
assert len(B['coastal']['types']) == 12, list(B['coastal']['types'])
assert len(B['fmerchant']['types']) == 11, list(B['fmerchant']['types'])
assert B['fmerchant']['types']['기타'].get('note')

def rows_ok(rs):
    assert len(rs) == 21
    for r in rs:
        assert len(r) == 6 and all(v is None or type(v) is int for v in r), r
rows_ok(w['overall']['rows'])
for b in B.values():
    rows_ok(b['rows'])
    for t in b['types'].values():
        rows_ok(t['rows'])

# --- koswec
F = k['firms']
FISH = {'원양어선', '연근해어선', '해외취업어선'}
bn = k['bizNames']
assert len(F) == 371, len(F)
assert sum(len(f['ships']) for f in F) == 3248, sum(len(f['ships']) for f in F)
assert not [f for f in F if f['n'].startswith(('개인선주', '연근해어선'))]
assert not [f['n'] for f in F if all(bn[s[2]] in FISH for s in f['ships'])]
byn = {}
for f in F:
    byn.setdefault(f['n'], []).append(f)
assert '동원해사랑(주)' not in byn
assert len(byn['가나마린(주)'][0]['ships']) == 14
assert len(byn['태진해운(주)']) == 1 and len(byn['태진해운(주)'][0]['ships']) == 4
assert not [f for f in F if '양희정' in f['n'] or '양희정' in f['id']]
assert all(len(f['ships']) >= 3 for f in F)
assert len({f['id'] for f in F}) == len(F)
apps = [f['app'] for f in F if f['app']]
assert len(apps) == 39, len(apps)
assert {'HMM', 'K-LNG', '훼어선박', '고려에스엠'} <= set(apps)
assert '대표' not in json.dumps(F, ensure_ascii=False)
for f in F:
    for v in (f['tel'], f['fax']):
        assert v is None or not v.startswith('01'), (f['n'], v)
        assert v is None or re.fullmatch(r'0\d{1,3}-\d{3,4}-\d{4}|1\d{3}-\d{4}', v), ('전화 형식', f['n'], v)
    for s in f['ships']:
        assert len(s) == 6 and s[4] and s[5], (f['n'], s)
        assert s[1] is None or isinstance(s[1], (int, float))
assert len(byn['에이치엠엠(주)'][0]['ships']) == 65
print('ok: wage', len(B), 'biz /', 'koswec', len(F), 'firms', sum(len(f['ships']) for f in F), 'ships')
