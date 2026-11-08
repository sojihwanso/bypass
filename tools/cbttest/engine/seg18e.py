"""2018 기관사 스캔 문제지: 쪽 OCR(ocrpage) 결과로 문항 시작 위치를 찾아 문항별 이미지로 자른다.
- 읽는 순서(쪽 → 왼쪽 단 → 오른쪽 단)로 회차 머리글·과목 머리글·문항 번호를 모은다.
- 번호가 크게 줄어들면(예: 25 → 1) 과목 머리글을 못 읽은 것으로 보고 다음 과목으로 넘긴다.
- 문항 n은 다음 문항이 n+1(또는 과목 끝)로 확인될 때만 쓴다 → 경계가 불확실한 문항은 버린다.
사용: python3 seg18e.py <pages폴더> <ocr json> <출력폴더>  → <출력>/qs18e.json, <출력>/img/E18-*.webp"""
import json, re, sys, os
from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS = None
PG, OCRF, OUT = sys.argv[1:4]
os.makedirs(f'{OUT}/img', exist_ok=True)
O = json.load(open(OCRF))
SUBS = ['기관1', '기관2', '기관3', '직무일반', '영어']
QRE = re.compile(r'^\s*([0-9SsOoIlB]{1,2})\s*[.,]')
CONF = str.maketrans({'S': '5', 's': '5', 'O': '0', 'o': '0', 'I': '1', 'l': '1', 'B': '8'})
SIZE = {}
recs = []
for g in [1, 2, 3, 4]:
    ev = []  # (kind, value, page, col, y, x0, x1, ytop, ybot)
    for f in sorted(x for x in O if x.startswith(f'g{g}-')):
        W, H = Image.open(f'{PG}/{f}').size; SIZE[f] = (W, H); mid = W / 2
        L = [l for l in O[f] if l['t'].strip()]
        hdr = [l for l in L if l['y'] < H * 0.13 and re.search(r'정기|해기사\s*시험|직\s*종|수험번호|성\s*명', l['t'])]
        m = next((re.search(r'제\s*(\d)\s*회', l['t']) for l in hdr if re.search(r'제\s*\d\s*회', l['t'])), None)
        top = (max(l['y'] + l['h'] for l in hdr) + 12) if hdr else H * 0.03
        if m: ev.append(('round', int(m.group(1)), f, 0, 0, 0, 0, 0, 0))
        body = [l for l in L if l['y'] >= top - 5 and l['y'] < H * 0.995 and not re.fullmatch(r'\s*[-–]?\s*\d{1,2}\s*[-–]?\s*', l['t'])]  # 쪽 번호만 제외, 단 맨 아래 보기 줄은 포함
        for col in (0, 1):
            cl = sorted([l for l in body if ((l['x'] + l['w'] / 2) < mid) == (col == 0)], key=lambda l: l['y'])
            if not cl: continue
            lm = min(l['x'] for l in cl)
            rm = max(l['x'] + l['w'] for l in cl)
            x0 = max(0, lm - 30)
            x1 = min(W, rm + 30) if col == 0 else min(W, rm + 30)
            ytop = cl[0]['y'] - 10; ybot = max(l['y'] + l['h'] for l in cl) + 14
            ev.append(('colstart', 0, f, col, ytop, x0, x1, ytop, ybot))
            for l in cl:
                t = l['t']
                ms = re.search(r'제\s*(\d)\s*과\s*[목옥]', t)
                if ms:
                    ev.append(('subj', int(ms.group(1)), f, col, l['y'], x0, x1, l['y'] + l['h'] + 10, ybot)); continue
                mq = QRE.match(t)
                if mq and l['x'] - lm < W * 0.04 and not re.match(r'^\s*[가나사아]\s*[.,]', t):
                    raw = mq.group(1).translate(CONF)
                    if raw.isdigit() and 1 <= int(raw) <= 25:
                        ev.append(('q', int(raw), f, col, l['y'], x0, x1, 0, ybot))
            ev.append(('colend', 0, f, col, ybot, x0, x1, 0, ybot))
    # walk events, assign round/subject, build question regions
    rnd = 0; si = 0; last = 0; cur = None; open_q = []
    def close(y_end_page, y_end):
        pass
    qs = []  # dict(r, si, n, segs)
    for k, v, f, col, y, x0, x1, yt, yb in ev:
        if k == 'round':
            if v != rnd: rnd = v; si = 0; last = 0; cur = None
        elif k == 'subj':
            if cur: cur['segs'].append((f, x0, cur['_y'], x1, y - 8)); cur['end'] = 'subj'; cur = None
            si = v; last = 0; cur_top = yt
            cur = None; lastsubj_y = (f, col, yt)
        elif k == 'q':
            if last and v < last - 5:  # 번호가 되돌아감 → 과목 머리글을 놓침
                if cur: cur['end'] = 'subj'; cur['segs'].append((f, x0, cur['_y'], x1, y - 8)); cur = None
                si += 1
            elif last == 0 and si == 0:
                si = 1
            if cur:
                cur['segs'].append((f, x0, cur['_y'], x1, y - 8)); cur['nxt'] = v
            cur = {'r': rnd, 'g': g, 's': si, 'n': v, 'segs': [], '_y': y - 8, 'nxt': None}
            qs.append(cur); last = v
        elif k == 'colend':
            if cur: cur['segs'].append((f, x0, cur['_y'], x1, yb)); cur['_y'] = None
        elif k == 'colstart':
            if cur: cur['_y'] = yt
    if cur: cur['end'] = 'end'
    for q in qs:
        ok = (q['nxt'] == q['n'] + 1) or (q['n'] == 25 and q.get('end') in ('subj', 'end'))
        if ok and 1 <= q['s'] <= 5:
            q['segs'] = [s for s in q['segs'] if s[2] is not None and s[4] - s[2] > 20]
            recs.append({'y': 2018, 'r': q['r'], 'g': g, 's': q['s'], 'sn': SUBS[q['s'] - 1], 'n': q['n'], 'seg': q['segs']})
# 같은 (g, r, s, n) 중복 제거
seen = set(); uniq = []
for r in recs:
    k = (r['g'], r['r'], r['s'], r['n'])
    if k in seen: continue
    seen.add(k); uniq.append(r)
recs = uniq
from collections import Counter
cnt = Counter((r['g'], r['r'], r['sn']) for r in recs)
print('recs', len(recs), 'groups', len(cnt), 'full25', sum(1 for v in cnt.values() if v == 25), {k: v for k, v in sorted(cnt.items()) if v != 25}, flush=True)
_cache = {}
for r in recs:
    parts, txt = [], []
    for j, (f, a, b, c, d) in enumerate(r['seg']):
        if f not in _cache: _cache.clear(); _cache[f] = Image.open(f'{PG}/{f}').convert('RGB')
        im = _cache[f]
        cr = im.crop((int(a), int(max(0, b)), int(c), int(d)))
        gb = ImageOps.invert(cr.convert('L')).point(lambda v: 255 if v > 60 else 0).getbbox()
        if gb: cr = cr.crop((max(0, gb[0] - 12), max(0, gb[1] - 12), min(cr.width, gb[2] + 12), min(cr.height, gb[3] + 12)))
        if cr.height < 40: continue
        if cr.width > 1800: cr = cr.resize((1800, round(cr.height * 1800 / cr.width)), Image.LANCZOS)
        p = f"img/E18-{r['g']}-r{r['r']}-s{r['s']}-{r['n']:02d}-{j}.webp"
        cr.save(f'{OUT}/{p}', 'WEBP', quality=70, method=4); parts.append(p)
        txt += [l['t'] for l in sorted(O[f], key=lambda l: (l['y'], l['x'])) if a - 5 <= l['x'] + l['w'] / 2 <= c + 5 and b - 5 <= l['y'] <= d - 5]
    r['full'] = parts; r['ocr'] = '\n'.join(txt); del r['seg']
recs = [r for r in recs if r['full']]
json.dump(recs, open(f'{OUT}/qs18e.json', 'w'), ensure_ascii=False)
print('saved', len(recs))
