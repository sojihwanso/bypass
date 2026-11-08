"""기관 문항(text_qs_engine.json + answers_engine.json)을 사이트 데이터(bank.json, exams.json, img 스프라이트)에 합친다.
여러 번 실행해도 같은 결과(기존 p:'e' 시험과 기관 전용 문항을 지우고 다시 만든다).
사용: CBT_BUILD=<parse 산출물 폴더> python3 build_engine.py"""
import json, os, re, hashlib, collections, glob
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__))
B = os.environ['CBT_BUILD']
D = os.path.normpath(H + '/../../../apps/cbttest/data')
AMAP = {'가': 0, '나': 1, '사': 2, '아': 3}
A = json.load(open(H + '/answers_engine.json'))
SUBS_E = ['기관1', '기관2', '기관3', '직무일반', '영어']
MAXW_FULL, MAXW_FIG = 860, 640

def norm(t): return re.sub(r'[\s\W_]+', '', t or '').lower()
def dhash(path):
    im = Image.open(f'{B}/{path}').convert('L').resize((17, 16), Image.LANCZOS)
    px = list(im.getdata()); bits = 0
    for r_ in range(16):
        for c_ in range(16):
            bits = (bits << 1) | (px[r_ * 17 + c_] > px[r_ * 17 + c_ + 1])
    return 'i%064x' % bits
def qkey(q):
    if 'full' in q:
        return hashlib.sha1('|'.join(dhash(p) for p in q['full']).encode()).hexdigest()[:12]
    figs = '|'.join(dhash(p) for p in q.get('fig', []))
    return hashlib.sha1((norm(q['q']) + '|' + '|'.join(sorted(norm(o) for o in q['o'])) + '|' + figs).encode()).hexdigest()[:12]
def ans_for(y, r, g, sub, n):
    a = A.get(f'{y}-{r}-{g}-{sub}')
    if not a: return None
    tok = a[n - 1]
    return sorted(AMAP[c] for c in tok.split('/') if c in AMAP) or [0, 1, 2, 3]  # 전항정답 등 → 모두 정답

bank = json.load(open(f'{D}/bank.json')); exams = json.load(open(f'{D}/exams.json'))
exams = [e for e in exams if e['p'] != 'e']
keep = {q[1] for e in exams for q in e['qs']}
bank = {k: v for k, v in bank.items() if k in keep}
for f in glob.glob(f'{D}/img/E*.webp'): os.remove(f)

groups = collections.defaultdict(list)
for x in json.load(open(f'{B}/text_qs_engine.json')):
    groups[(x['y'], x['r'], x['g'], SUBS_E[x['s'] - 1])].append(x)

sprite = collections.defaultdict(list)
eng = []  # (y, r, g, sub, [(rec, rawq)])
missing = []
for key in sorted(groups):
    y, r, g, sub = key
    out = []
    for q in sorted(groups[key], key=lambda q: q['n']):
        rec = {'n': q['n'], 'k': qkey(q), 'a': ans_for(y, r, g, sub, q['n'])}
        if rec['a'] is None: missing.append((key, q['n']))
        if 'full' in q:
            rec['img'] = []
            for p in q['full']:
                if Image.open(f'{B}/{p}').height >= 30: sprite[(y, g, r)].append(((p, MAXW_FULL), rec['img']))  # 빈 띠(높이 18px 등) 제외
        else:
            rec['q'], rec['o'] = q['q'], q['o']
            if 'fig' in q:
                rec['fig'] = []
                for p in q['fig']: sprite[(y, g, r)].append(((p, MAXW_FIG), rec['fig']))
        out.append(rec)
    eng.append((y, r, g, sub, out))

def load_img(rel, maxw):
    im = Image.open(f'{B}/{rel}').convert('RGB')
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    return im
nsp = 0
for (y, g, r), imgs in sorted(sprite.items()):
    ims = [(load_img(*t), ref) for t, ref in imgs]
    chunks = [[]]; h = 0
    for im, ref in ims:
        if h + im.height > 15000 and chunks[-1]: chunks.append([]); h = 0
        chunks[-1].append((im, ref)); h += im.height + 4
    for ci, ch in enumerate(chunks):
        W = max(im.width for im, _ in ch); Ht = sum(im.height + 4 for im, _ in ch)
        sp = Image.new('RGB', (W, Ht), 'white'); yy = 0; name = f'E{y}-{g}-{r}-{ci}.webp'
        for im, ref in ch:
            sp.paste(im, (0, yy)); ref.append({'s': name, 'y': yy, 'w': im.width, 'h': im.height, 'W': W, 'H': Ht}); yy += im.height + 4
        sp.save(f'{D}/img/{name}', 'WEBP', quality=75, method=6); nsp += 1

# canonical copy for new keys: most recent engine occurrence
occ = {}
for (y, r, g, sub, out) in eng:
    for rec in out:
        if rec['k'] not in bank and (rec['k'] not in occ or (y, r) >= occ[rec['k']][0]): occ[rec['k']] = ((y, r), rec)
for k, (_, rec) in occ.items():
    bank[k] = {'img': rec['img']} if 'img' in rec else {'q': rec['q'], 'o': rec['o'], **({'fig': rec['fig']} if 'fig' in rec else {})}
reord = shared = 0
for (y, r, g, sub, out) in eng:
    refs = []
    for rec in out:
        b = bank[rec['k']]; ref = [rec['n'], rec['k'], rec['a']]
        if rec['k'] in keep: shared += 1
        if 'o' in rec and 'o' in b:
            cn = [norm(o) for o in b['o']]; used = set(); od = []
            for o in rec['o']:
                j = next((j for j, c in enumerate(cn) if c == norm(o) and j not in used), None)
                if j is None: raise SystemExit(f'option mismatch {y}-{r}-{g} {sub} {rec["n"]}')
                used.add(j); od.append(j)
            if od != list(range(len(od))): ref.append(od); reord += 1
        refs.append(ref)
    exams.append({'y': y, 'r': r, 'g': g, 'p': 'e', 'sub': sub, 'qs': refs})
json.dump(bank, open(f'{D}/bank.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(exams, open(f'{D}/exams.json', 'w'), ensure_ascii=False, separators=(',', ':'))
n = sum(len(o) for *_, o in eng)
print('engine qs', n, 'unique new', len(occ), 'shared with deck', shared, 'reordered', reord, 'sprites', nsp, 'missing ans', len(missing), missing[:5])
print('bank KB', os.path.getsize(f'{D}/bank.json') // 1024, 'exams KB', os.path.getsize(f'{D}/exams.json') // 1024)
