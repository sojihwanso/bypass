import re
"""Assemble site data: per-year JSON + per-subject image sprites."""
import json, os, re, shutil, collections
from PIL import Image

S = __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
B = f'{S}/build'
SITE = f'{S}/site'
SUBS = ['항해', '운용', '법규', '영어', '상선전문', '어선전문']
AMAP = {'가': 0, '나': 1, '사': 2, '아': 3}
A = json.load(open(f'{B}/answers.json'))

if os.path.exists(f'{SITE}/data'):
    shutil.rmtree(f'{SITE}/data')
os.makedirs(f'{SITE}/data/img', exist_ok=True)


def ans_for(y, r, g, paper, sub, n):
    keys = [f'{y}-{r}-{g}-{paper}-{sub}', f'{y}-{r}-{g}-x-{sub}']
    for k in keys:
        if k in A:
            tok = A[k][n - 1]
            return sorted(AMAP[c] for c in tok.split('/') if c in AMAP)
    return None


# ---- gather questions: key (y, r, g, paper, subjIdx) -> list
groups = collections.defaultdict(list)
for x in json.load(open(f'{B}/text_qs.json')) + json.load(open(f'{B}/text_qs_new.json')):
    paper = 'm' if x['k'] == '상선' else 'f'
    sub = SUBS[x['s'] - 1] if x['s'] <= 4 else ('상선전문' if paper == 'm' else '어선전문')
    groups[(x['y'], x['r'], x['g'], paper, sub)].append(x)
for x in json.load(open(f'{B}/qs18.json')):
    groups[(2018, x['r'], x['g'], 'x', x['sn'])].append(x)

MAXW_FULL = 860
MAXW_FIG = 640


def load_img(rel, maxw):
    im = Image.open(f'{B}/{rel}').convert('RGB')
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    return im


import hashlib
def _norm(t): return re.sub(r'[\s\W_]+', '', t or '').lower()
def _dhash(path):
    im = Image.open(f'{B}/{path}').convert('L').resize((17, 16), Image.LANCZOS)
    px = list(im.getdata()); bits = 0
    for r_ in range(16):
        for c_ in range(16):
            bits = (bits << 1) | (px[r_ * 17 + c_] > px[r_ * 17 + c_ + 1])
    return 'i%064x' % bits
def qkey(q):
    if 'full' in q:
        return hashlib.sha1('|'.join(_dhash(p) for p in q['full']).encode()).hexdigest()[:12]
    figs = '|'.join(_dhash(p) for p in q.get('fig', []))
    return hashlib.sha1((_norm(q['q']) + '|' + '|'.join(sorted(_norm(o) for o in q['o'])) + '|' + figs).encode()).hexdigest()[:12]
occ = collections.defaultdict(set)
years = collections.defaultdict(list)
sprite_groups = collections.defaultdict(list)
sprite_count = 0
missing_ans = []
for key in sorted(groups):
    y, r, g, paper, sub = key
    qs = sorted(groups[key], key=lambda q: q['n'])
    # collect images for this group's sprite
    imgs = []
    out = []
    for q in qs:
        rec = {'n': q['n']}
        if 'full' in q:
            rec['img'] = []
            for p in q['full']:
                imgs.append(((p, MAXW_FULL), rec['img']))
        else:
            rec['q'] = q['q']
            rec['o'] = q['o']
            if 'fig' in q:
                rec['fig'] = []
                for p in q['fig']:
                    imgs.append(((p, MAXW_FIG), rec['fig']))
        a = ans_for(y, r, g, paper, sub, q['n'])
        if a is None:
            missing_ans.append((key, q['n']))
        rec['a'] = a
        rec['k'] = qkey(q)
        occ[rec['k']].add(f'{y}-{r}-{g}')
        out.append(rec)
    sprite_groups[(y, g, r)].extend(imgs)
    years[y].append({'r': r, 'g': g, 'p': paper, 'sub': sub, 'qs': out})

for (y, g, r), imgs in sorted(sprite_groups.items()):
    if not imgs:
        continue
    def dims(t):
        w, h0 = Image.open(f'{B}/{t[0]}').size
        return (t[1], round(h0 * t[1] / w)) if w > t[1] else (w, h0)
    imgs = [(t, ref, dims(t)) for t, ref in imgs]
    chunks = [[]]; h = 0
    for t, ref, (iw, ih) in imgs:
        im = type('D', (), {'width': iw, 'height': ih})()
        if h + im.height > 15000 and chunks[-1]:
            chunks.append([]); h = 0
        chunks[-1].append((t, ref, iw, ih)); h += ih + 4
    for ci, ch in enumerate(chunks):
        ch = [(load_img(t[0], t[1]), ref) for t, ref, iw, ih in ch]
        W = max(im.width for im, _ in ch); H = sum(im.height + 4 for im, _ in ch)
        sp = Image.new('RGB', (W, H), 'white'); yy = 0
        name = f'{y}-{g}-{r}-{ci}.webp'
        for im, ref in ch:
            sp.paste(im, (0, yy))
            ref.append({'s': name, 'y': yy, 'w': im.width, 'h': im.height, 'W': W, 'H': H})
            yy += im.height + 4
        sp.save(f'{SITE}/data/img/{name}', 'WEBP', quality=62 if y == 2018 else 75, method=6)
        sprite_count += 1
dup_groups = 0
for y, lst in years.items():
    for grp in lst:
        for rec in grp['qs']:
            me = f"{y}-{grp['r']}-{grp['g']}"
            others = sorted(occ[rec['k']] - {me})
            if others:
                rec['rep'] = others
print('questions seen in more than one exam:', sum(1 for k, v in occ.items() if len(v) > 1))
for y, lst in years.items():
    json.dump(lst, open(f'{SITE}/data/{y}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('sprites', sprite_count)
print('missing answers', len(missing_ans), missing_ans[:10])
for y in years:
    print(y, os.path.getsize(f'{SITE}/data/{y}.json') // 1024, 'KB', sum(len(g['qs']) for g in years[y]), 'qs')
tot = sum(os.path.getsize(f'{SITE}/data/img/{f}') for f in os.listdir(f'{SITE}/data/img'))
print('img total MB', tot / 1e6)
