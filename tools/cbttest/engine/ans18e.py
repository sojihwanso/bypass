"""2018 기관사 1~4급 정답표(이미지) OCR 결과에서 정답 추출 → answers18e.json {f'2018-{r}-{g}-{sub}': [25]}"""
import json, re, sys, os
O = json.load(open(sys.argv[1]))
SUBS = ['기관1', '기관2', '기관3', '직무일반', '영어']
out = {}; warn = []
for g in [1, 2, 3, 4]:
    L = O[f'ans-{g}.png']
    hdr = sorted(l['y'] for l in L if '과목' in l['t'])
    # merge header y within 30px
    hs = []
    for y in hdr:
        if not hs or y - hs[-1] > 60: hs.append(y)
    chars = []
    for l in L:
        s = re.sub(r'[^가나사아]', '', l['t'])
        if not s or l['x'] < 800: continue
        if re.search(r'[가-힣]', re.sub(r'[가나사아\s]', '', l['t'])): continue  # 다른 글자 섞인 줄(제목 등) 제외
        cy = l['y'] + l['h'] / 2
        for i, c in enumerate(s):
            chars.append((cy, l['x'] + l['w'] * (i + .5) / len(s), c))
    for bi, hy in enumerate(hs):
        ny = hs[bi + 1] if bi + 1 < len(hs) else 1e9
        cs = sorted([c for c in chars if hy + 30 < c[0] < ny - 30])
        rows = []
        for c in cs:
            if rows and c[0] - rows[-1][-1][0] < 35: rows[-1].append(c)
            else: rows.append([c])
        if len(rows) != 5: warn.append((g, bi + 1, 'rows', len(rows))); continue
        for si, row in enumerate(rows):
            a = [c[2] for c in sorted(row, key=lambda c: c[1])]
            if len(a) != 25: warn.append((g, bi + 1, SUBS[si], len(a))); continue
            out[f'2018-{bi + 1}-{g}-{SUBS[si]}'] = a
print(len(out), warn)
json.dump(out, open(os.path.dirname(os.path.abspath(__file__)) + '/answers18e.json', 'w'), ensure_ascii=False, indent=0)
