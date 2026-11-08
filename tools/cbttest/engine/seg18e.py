"""2018 기관사 스캔 문제지: 쪽 OCR(ocrpage) 결과로 문항 시작 위치를 찾아 문항별 이미지로 자른다.
사용: python3 seg18e.py <pages폴더> <ocr all.json> <출력폴더(CBT_BUILD)>
출력: <출력>/qs18e.json (y,r,g,s,sn,n,full,ocr) + <출력>/img/E18-*.webp"""
import json, re, sys, os, glob
from PIL import Image
PG, OCRF, OUT = sys.argv[1:4]
os.makedirs(f'{OUT}/img', exist_ok=True)
O = json.load(open(OCRF))
SUBS = ['기관1', '기관2', '기관3', '직무일반', '영어']
QRE = re.compile(r'^\s*(\d{1,2})\s*[.,]\s*\S')
recs, log = [], []
for g in [1, 2, 3, 4]:
    files = sorted(f for f in O if f.startswith(f'g{g}-'))
    rnd = 0; si = 0; expect = 1; cur = None
    for f in files:
        im = Image.open(f'{PG}/{f}'); W, H = im.size; mid = W / 2
        L = [l for l in O[f] if l['t'].strip()]
        hdr = [l for l in L if l['y'] < H * 0.13 and re.search(r'정기|해기사\s*시험|직\s*종|수험번호|성\s*명', l['t'])]
        m = next((re.search(r'제\s*(\d)\s*회', l['t']) for l in hdr if re.search(r'제\s*\d\s*회', l['t'])), None)
        top = H * 0.035
        if hdr:
            top = max(l['y'] + l['h'] for l in hdr) + 12
        if m and int(m.group(1)) != rnd:
            rnd = int(m.group(1)); si = 0; expect = 1; cur = None
        body = [l for l in L if l['y'] >= top - 5 and l['y'] < H * 0.975]
        for col in (0, 1):
            cl = sorted([l for l in body if ((l['x'] + l['w'] / 2) < mid) == (col == 0)], key=lambda l: l['y'])
            if not cl: continue
            x0 = W * 0.03 if col == 0 else mid + 4
            x1 = mid - 4 if col == 0 else W * 0.975
            lm = min(l['x'] for l in cl)
            ctop = cl[0]['y'] - 10
            cbot = max(l['y'] + l['h'] for l in cl) + 14
            starts = []
            for l in cl:
                t = l['t']
                ms = re.search(r'제\s*(\d)\s*과\s*목', t)
                if ms:
                    starts.append(('subj', l['y'], int(ms.group(1)))); expect = 1; continue
                mq = QRE.match(t)
                if mq and l['x'] - lm < W * 0.05 and int(mq.group(1)) == expect:
                    starts.append(('q', l['y'], expect)); expect += 1
                    if expect > 25: pass
            # segments
            ycur = ctop
            for kind, y, v in starts:
                if cur is not None and y - 8 > ycur + 20:
                    cur['seg'].append((f, x0, ycur, x1, y - 8))
                if kind == 'subj':
                    si = v; cur = None; ycur = y + 30
                    # skip header line height
                    hl = next(l for l in cl if l['y'] == y); ycur = y + hl['h'] + 10
                    # questions after this header start at 1
                    continue
                cur = {'y': 2018, 'r': rnd, 'g': g, 's': si, 'sn': SUBS[si - 1] if 1 <= si <= 5 else '?', 'n': v, 'seg': []}
                recs.append(cur); ycur = y - 8
            if cur is not None and cbot > ycur + 20:
                cur['seg'].append((f, x0, ycur, x1, cbot))
# 문항 번호가 subj 이전에 증가되는 문제 보정: subj 헤더 뒤 expect=1 로 재설정되므로 OK
# crop
from collections import Counter
cnt = Counter((r['g'], r['r'], r['sn']) for r in recs)
bad = {k: v for k, v in cnt.items() if v != 25}
print('recs', len(recs), 'groups', len(cnt), 'not25', bad)
ocr_by = {}
for r in recs:
    parts = []
    txt = []
    for j, (f, a, b, c, d) in enumerate(r['seg']):
        im = Image.open(f'{PG}/{f}').convert('RGB')
        cr = im.crop((int(a), int(max(0, b)), int(c), int(d)))
        # trim white
        from PIL import ImageOps
        gbox = ImageOps.invert(cr.convert('L')).point(lambda v: 255 if v > 60 else 0).getbbox()
        if gbox: cr = cr.crop((max(0, gbox[0] - 8), max(0, gbox[1] - 8), min(cr.width, gbox[2] + 8), min(cr.height, gbox[3] + 8)))
        if cr.height < 25: continue
        p = f"img/E18-{r['g']}-r{r['r']}-s{r['s']}-{r['n']:02d}-{j}.webp"
        cr.save(f'{OUT}/{p}', 'WEBP', quality=70, method=6); parts.append(p)
        txt += [l['t'] for l in sorted(O[f], key=lambda l: (l['y'], l['x'])) if a - 5 <= l['x'] + l['w'] / 2 <= c + 5 and b - 5 <= l['y'] <= d - 5]
    r['full'] = parts; r['ocr'] = '\n'.join(txt); del r['seg']
json.dump(recs, open(f'{OUT}/qs18e.json', 'w'), ensure_ascii=False)
