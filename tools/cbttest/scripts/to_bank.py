"""Convert per-year question files into a single question bank + exam reference lists.

bank.json : {k: {"q":..., "o":[...], "fig":[...]} | {"img":[...]}}   (one canonical copy per question)
exams.json: [{"y","r","g","p","sub","qs":[[n, k, a, ord?], ...]}]
  - a   : correct answer indices in this exam's option order (kept per exam, from that exam's 정답표)
  - ord : only when this exam shows the options in a different order than the bank copy;
          ord[i] = index into bank.o of the option shown at position i
"""
import json, re, os, sys, collections

S = __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else f'{S}/site/data'
OUT = sys.argv[2] if len(sys.argv) > 2 else f'{S}/site/data'
YEARS = [2018, 2020, 2021, 2022, 2023, 2024, 2025]


def norm(t):
    return re.sub(r'[\s\W_]+', '', t or '').lower()


groups = []
occ = collections.defaultdict(list)  # k -> [(y, r, g, gi, qi)]
for y in YEARS:
    for g in json.load(open(f'{SRC}/{y}.json')):
        gi = len(groups)
        groups.append(dict(y=y, **{k: g[k] for k in ('r', 'g', 'p', 'sub')}, qs=g['qs']))
        for qi, q in enumerate(g['qs']):
            occ[q['k']].append((y, g['r'], gi, qi))

bank = {}
for k, lst in occ.items():
    # canonical copy: the most recent exam (year, round); 상선 paper first for ties
    y, r, gi, qi = max(lst, key=lambda t: (t[0], t[1], groups[t[2]]['p'] == 'm'))
    q = groups[gi]['qs'][qi]
    if 'img' in q:
        bank[k] = {'img': q['img']}
    else:
        bank[k] = {'q': q['q'], 'o': q['o']}
        if 'fig' in q:
            bank[k]['fig'] = q['fig']

exams = []
reordered = 0
for g in groups:
    refs = []
    for q in g['qs']:
        b = bank[q['k']]
        ref = [q['n'], q['k'], q['a']]
        if 'o' in q:
            cn = [norm(o) for o in b['o']]
            ord_ = []
            used = set()
            for o in q['o']:
                j = next((j for j, c in enumerate(cn) if c == norm(o) and j not in used), None)
                if j is None:
                    raise SystemExit(f'option mismatch {g["y"]}-{g["r"]}-{g["g"]} {g["sub"]} {q["n"]}')
                used.add(j); ord_.append(j)
            if ord_ != list(range(len(ord_))):
                ref.append(ord_); reordered += 1
        refs.append(ref)
    exams.append({'y': g['y'], 'r': g['r'], 'g': g['g'], 'p': g['p'], 'sub': g['sub'], 'qs': refs})

json.dump(bank, open(f'{OUT}/bank.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(exams, open(f'{OUT}/exams.json', 'w'), ensure_ascii=False, separators=(',', ':'))
nocc = sum(len(g['qs']) for g in groups)
print('exam questions', nocc, '| unique in bank', len(bank), '| shared refs', nocc - len(bank), '| reordered options', reordered)
print('bank KB', os.path.getsize(f'{OUT}/bank.json') // 1024, '| exams KB', os.path.getsize(f'{OUT}/exams.json') // 1024,
      '| old per-year KB', sum(os.path.getsize(f'{SRC}/{y}.json') for y in YEARS) // 1024)

# ---- verify: rebuild every exam question from bank+exams and compare with the old files
bad = 0
for g, e in zip(groups, exams):
    for q, ref in zip(g['qs'], e['qs']):
        b = bank[ref[1]]
        if 'img' in q:
            ok = 'img' in b and ref[2] == q['a'] and ref[0] == q['n']  # image twins share one copy (same image hash)
        else:
            o = [b['o'][j] for j in (ref[3] if len(ref) > 3 else range(len(b['o'])))]
            ok = (norm(b['q']) == norm(q['q']) and [norm(x) for x in o] == [norm(x) for x in q['o']]
                  and ref[2] == q['a'] and ref[0] == q['n'] and bool(b.get('fig')) == bool(q.get('fig')))
            # same option text shown at the answer position
            ok = ok and all(norm(o[i]) == norm(q['o'][i]) for i in q['a'])
        if not ok:
            bad += 1
            if bad < 5: print('MISMATCH', g['y'], g['r'], g['g'], g['sub'], q['n'])
print('verify mismatches:', bad)

# ---- repack sprites: keep only image crops still referenced by the bank
if '--repack' in sys.argv:
    from PIL import Image
    IMG = f'{OUT}/img'
    refs = collections.defaultdict(list)
    for b in bank.values():
        for key in ('img', 'fig'):
            for rf in b.get(key, []):
                refs[rf['s']].append(rf)
    before = sum(os.path.getsize(f'{IMG}/{f}') for f in os.listdir(IMG))
    keep = set()
    for name, lst in refs.items():
        src = Image.open(f'{IMG}/{name}').convert('RGB')
        uniq = {}
        for rf in lst:
            uniq.setdefault(rf['y'], rf)
        rects = sorted(uniq.values(), key=lambda rf: rf['y'])
        W = max(rf['w'] for rf in rects); H = sum(rf['h'] + 4 for rf in rects)
        sp = Image.new('RGB', (W, H), 'white'); yy = 0; newpos = {}
        for rf in rects:
            sp.paste(src.crop((0, rf['y'], rf['w'], rf['y'] + rf['h'])), (0, yy)); newpos[rf['y']] = yy; yy += rf['h'] + 4
        q = 62 if name.startswith('2018') else 75
        sp.save(f'{IMG}/{name}', 'WEBP', quality=q, method=6)
        for rf in lst:
            rf['y'] = newpos[rf['y']]; rf['W'] = W; rf['H'] = H
        keep.add(name)
    for f in os.listdir(IMG):
        if f not in keep:
            os.remove(f'{IMG}/{f}')
    json.dump(bank, open(f'{OUT}/bank.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    after = sum(os.path.getsize(f'{IMG}/{f}') for f in os.listdir(IMG))
    print('sprites', len(keep), '| image MB', round(before / 1e6, 1), '->', round(after / 1e6, 1))
