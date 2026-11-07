"""Parse 2020/2021 text-layer exam PDFs into question JSON + figure crops."""
import pdfplumber, pypdfium2 as pdfium, re, json, os, sys, glob
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from lines import page_lines

S = __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
OUT = f'{S}/build'
IMG = f'{OUT}/img'
os.makedirs(IMG, exist_ok=True)

MK = {'㉮': 0, '㉯': 1, '㉴': 2, '㉵': 3}
MKRE = re.compile('[㉮㉯㉴㉵]')
SUBRE = re.compile(r'\[\s*제\s*(\d)\s*과목\s*[:：]\s*(.+?)\s*\]')
QRE = re.compile(r'^\s*(\d{1,2})\s*\.\s*(.*)$')
SCALE = 3.0  # render scale (216 dpi)


def norm_join(a, b):
    if not a:
        return b.lstrip()
    if a.endswith(' ') or b.startswith(' '):
        return a.rstrip() + ' ' + b.lstrip()
    return a + b


def parse_file(path, default_round=None):
    global KIND5
    KIND5 = '상선전문' if '상선' in os.path.basename(path) else '어선전문'
    pdf = pdfplumber.open(path)
    doc = pdfium.PdfDocument(path)
    exams = []  # list of dict(round, subjects{idx:{name, qs}})
    cur = None
    for pi, pg in enumerate(pdf.pages):
        txt = pg.extract_text() or ''
        if re.search(r'문\s*제\s*지', txt) and len(txt) < 600:
            m = re.search(r'제\s*(\d)\s*회', txt)
            cur = {'round': int(m.group(1)) if m else default_round, 'subjects': {}}
            exams.append(cur)
            continue
        if cur is None:
            cur = {'round': default_round, 'subjects': {}}
            exams.append(cur)
        lines = page_lines(pg)
        hdr = []
        for im in pg.images:
            w = im['x1'] - im['x0']; h = im['bottom'] - im['top']
            if 18 <= h <= 32 and 140 <= w <= 230:
                if not any(abs(im['top'] - o['top']) < 5 and abs(im['x0'] - o['x0']) < 20 for o in hdr):
                    hdr.append(im)
        for im in hdr:
            col = 0 if (im['x0'] + im['x1']) / 2 < pg.width / 2 else 1
            lines.append({'col': col, 'top': im['top'], 'bot': im['bottom'], 'x0': im['x0'], 'x1': im['x1'], 't': '[[SUBJ]]', 'unk': False})
        lines.sort(key=lambda l: (l['col'], l['top']))
        hdr_ids = set(id(o) for o in pg.images if 18 <= o['bottom'] - o['top'] <= 32 and 140 <= o['x1'] - o['x0'] <= 230)
        # graphics on page
        gfx = [('img', o) for o in pg.images if id(o) not in hdr_ids] + [('rect', o) for o in pg.rects] + \
              [('line', o) for o in pg.lines] + [('curve', o) for o in pg.curves]
        cur.setdefault('pages', []).append((pi, pg, lines, gfx))
    # second pass per exam: sequential parsing
    for ex in exams:
        subj = None
        q = None
        expect = 1
        segs = []  # question segments for figure detection
        for (pi, pg, lines, gfx) in ex.get('pages', []):
            for L in lines:
                t = L['t']
                if re.fullmatch(r'\s*-\s*\d+\s*-?\s*', t):
                    continue
                m = SUBRE.search(t)
                if t == '[[SUBJ]]':
                    ni = len(ex['subjects']) + 1
                    m = re.match(r'(.*)', str(ni))
                    nm = ['항해', '운용', '법규', '영어', KIND5][ni - 1]
                    subj = {'idx': ni, 'name': nm, 'qs': []}
                    ex['subjects'][ni] = subj
                    expect = 1
                    q = None
                    continue
                if m:
                    subj = {'idx': int(m.group(1)), 'name': m.group(2).replace(' ', ''), 'qs': []}
                    ex['subjects'][subj['idx']] = subj
                    expect = 1
                    q = None
                    continue
                if subj is None:
                    continue
                m = QRE.match(t)
                if m and int(m.group(1)) == expect and L['x0'] < (pg.width / 2 if L['col'] == 0 else pg.width) and not MKRE.match(t.strip()):
                    q = {'n': expect, 'stem': [], 'opts': ['', '', '', ''], 'cur': None, 'segs': [], 'unk': False}
                    subj['qs'].append(q)
                    expect += 1
                    rest = m.group(2)
                    q['segs'].append([pi, L['col'], L['top'], L['bot']])
                    L = dict(L, t=rest)
                    t = rest
                if q is None:
                    continue
                # extend segment
                sg = q['segs'][-1]
                if sg[0] == pi and sg[1] == L['col']:
                    sg[3] = max(sg[3], L['bot'])
                else:
                    q['segs'].append([pi, L['col'], L['top'], L['bot']])
                if L['unk']:
                    q['unk'] = True
                # split options
                parts = re.split('([㉮㉯㉴㉵])', t)
                head = parts[0]
                if head.strip() or not len(parts) > 1:
                    if q['cur'] is None:
                        q['stem'].append((head, L))
                    else:
                        q['opts'][q['cur']] = norm_join(q['opts'][q['cur']], head)
                for k in range(1, len(parts), 2):
                    oi = MK[parts[k]]
                    q['cur'] = oi
                    q['opts'][oi] = norm_join(q['opts'][oi], parts[k + 1])
        ex['doc'] = doc
    return exams, pdf


def stem_text(stem):
    out = ''
    box = False
    for (t, L) in stem:
        s = t
        if re.match(r'^\s*<\s*보\s*기\s*>\s*$', s):
            out = out.rstrip() + '\n<보기>\n'
            box = True
            continue
        if box and re.match(r'^\s*(ㄱ|ㄴ|ㄷ|ㄹ|ㅁ|ㅂ)\s*\.', s):
            out = out.rstrip(' ') + ('\n' if not out.endswith('\n') else '') + s.strip() + (' ' if s.endswith(' ') else '')
            continue
        if re.match(r'^\s*\(\d\)', s) or re.match(r'^\s*[①②③④⑤]', s):
            out = out.rstrip(' ') + ('\n' if out and not out.endswith('\n') else '') + s.strip() + (' ' if s.endswith(' ') else '')
            continue
        if out.endswith('\n'):
            out += s.lstrip()
        else:
            out = norm_join(out, s)
    return re.sub(r'[ \t]+', ' ', out).strip()


def render_crop(doc, pi, box, name, cutrules=False):
    k = (id(doc), pi)
    if k not in _render_cache:
        _render_cache.clear()
        _render_cache[k] = doc[pi].render(scale=SCALE).to_pil()
    bm = _render_cache[k]
    x0, y0, x1, y1 = [v * SCALE for v in box]
    im = bm.crop((int(x0), int(y0), int(x1), int(y1))).convert('RGB')
    import numpy as np
    if cutrules:
        a = np.asarray(im.convert('L'))
        dark = (a < 160)
        h = a.shape[0]
        rows = np.where(dark.mean(1) > 0.7)[0]
        for r in sorted(rows, reverse=True):
            if r > h * 0.6 and dark[r + 3:].mean() < 0.002:
                im = im.crop((0, 0, im.width, max(1, r - 2)))
                break
    # trim white margins
    from PIL import ImageOps
    g = ImageOps.invert(im.convert('L')).point(lambda v: 255 if v > 18 else 0)
    bb = g.getbbox()
    if bb:
        pad = 8
        im = im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)))
    if (np.asarray(im.convert('L')) < 150).mean() < 0.004:
        return None, (0, 0)
    path = f'{IMG}/{name}.webp'
    im.save(path, 'WEBP', quality=72, method=6)
    return f'img/{name}.webp', im.size


_render_cache = {}


def finalize(exams, pdf, key, stats):
    """Convert parsed exams into output records; detect figures & full-image questions."""
    out = []
    for ex in exams:
        doc = ex['doc']
        pages = {pi: (pg, lines, gfx) for (pi, pg, lines, gfx) in ex.get('pages', [])}
        for si, subj in sorted(ex['subjects'].items()):
            qs = subj['qs']
            for qi, q in enumerate(qs):
                # Determine segment bottoms: up to next question start in same col/page
                nxt = qs[qi + 1]['segs'][0] if qi + 1 < len(qs) else None
                rec = {'n': q['n'], 'q': stem_text(q['stem']), 'o': [re.sub(r'\s+', ' ', o).strip() for o in q['opts']]}
                figs = []
                full = q['unk'] or bool(re.search('[\ue000-\uf8ff]', rec['q'] + ''.join(rec['o'])))
                why = ['unk'] if full else []
                if any(not o for o in rec['o']):
                    full = True; why.append('emptyopt')
                for (pi, col, top, bot) in q['segs']:
                    pg, lines, gfx = pages[pi]
                    W = pg.width
                    cx0, cx1 = (0, W / 2) if col == 0 else (W / 2, W)
                    # extend bottom to next question or next text line start
                    lim = pg.height - 40
                    if nxt and nxt[0] == pi and nxt[1] == col and nxt[2] > top:
                        lim = nxt[2] - 2
                    for L2 in lines:
                        if L2['col'] == col and L2['top'] > bot + 1 and (L2['t'] == '[[SUBJ]]' or SUBRE.search(L2['t'])):
                            lim = min(lim, L2['top'] - 2)
                            break
                    lim = max(lim, bot + 2)
                    seg_top = top
                    # graphics in this column region
                    items = []
                    for kind, o in gfx:
                        ox = (o['x0'] + o['x1']) / 2
                        oy0, oy1 = o['top'], o['bottom']
                        if not (cx0 <= ox < cx1):
                            continue
                        if oy1 < seg_top - 2 or oy0 > lim:
                            continue
                        if kind == 'img' and (o['x1'] - o['x0']) > W * 0.45:
                            continue  # watermark/logo
                        items.append((kind, o))
                    imgs = [o for k, o in items if k == 'img']
                    if any((o['x1'] - o['x0']) < 90 and (o['bottom'] - o['top']) < 40 for o in imgs):
                        full = True; why.append('smallimg')
                    cw = cx1 - cx0
                    vec = [o for k, o in items if k != 'img' and not ((o['bottom'] - o['top']) < 3 and ((o['x1'] - o['x0']) > cw * 0.6 or (o['x1'] - o['x0']) < 45))]
                    # text gaps (figure placeholder space)
                    tl = [L for L in lines if L['col'] == col and seg_top - 1 <= L['top'] <= lim and L['t'].strip() and L['top'] < pg.height - 45 and not re.fullmatch(r'\s*-\s*\d+\s*-?\s*', L['t'])]
                    gaps = []
                    for a, b in zip(tl, tl[1:]):
                        if b['top'] - a['bot'] > 30:
                            gaps.append((a['bot'], b['top']))
                    # vector: box around <보기> is ignorable; many lines => table
                    has_box = any(re.search(r'<\s*보\s*기\s*>', L['t']) for L in tl)
                    nvec = len(vec)
                    if nvec > (6 if has_box else 2):
                        # table or drawing; if text-dense area -> full image
                        vy0 = min(o['top'] for o in vec); vy1 = max(o['bottom'] for o in vec)
                        inside = [L for L in tl if vy0 - 1 <= L['top'] <= vy1 + 1]
                        if len(inside) >= 2 and not has_box:
                            full = True; why.append('table%d' % nvec)
                        elif not has_box:
                            figs.append((pi, (cx0 + 4, vy0 - 4, cx1 - 4, vy1 + 4)))
                    for o in imgs:
                        figs.append((pi, (max(cx0, o['x0'] - 4), o['top'] - 4, min(cx1, o['x1'] + 4), o['bottom'] + 4)))
                    if not imgs and nvec <= 2:
                        for (g0, g1) in gaps:
                            figs.append((pi, (cx0 + 4, g0 + 1, cx1 - 4, g1 - 1)))
                    yb = max([L['bot'] for L in tl] + [o['bottom'] for o in imgs] + [o['bottom'] for o in vec] + [bot])
                    q.setdefault('_box', []).append((pi, (cx0 + 2, top - 3, cx1 - 2, min(lim, yb + 5))))
                if full:
                    parts = []
                    for j, (pi, box) in enumerate(q['_box']):
                        p, sz = render_crop(doc, pi, box, f"{key}-r{ex['round']}-s{si}-{q['n']:02d}-full{j}", True)
                        if p: parts.append(p)
                    rec['full'] = parts
                    rec['_why'] = why
                    stats['full'] += 1
                elif figs:
                    # merge figures
                    paths = []
                    for j, (pi, box) in enumerate(figs):
                        if box[3] - box[1] < 12:
                            continue
                        p, sz = render_crop(doc, pi, box, f"{key}-r{ex['round']}-s{si}-{q['n']:02d}-f{j}")
                        if p and sz[1] > 30 and sz[0] > 30:
                            paths.append(p)
                        elif p:
                            os.remove(f'{OUT}/{p}')
                    if paths:
                        rec['fig'] = paths
                        stats['fig'] += 1
                out.append((ex['round'], si, subj['name'], rec))
                stats['q'] += 1
    return out


if __name__ == '__main__':
    stats = {'q': 0, 'fig': 0, 'full': 0}
    allrec = []
    files = sorted(glob.glob(f'{S}/data/해기사-2020-*.pdf')) + sorted(glob.glob(f'{S}/data/2021년*.pdf'))
    for f in files:
        b = os.path.basename(f)
        m = re.search(r'(\d)급항해사\((상선|어선)\)', b)
        grade, kind = int(m.group(1)), m.group(2)
        year = 2020 if b.startswith('해기사-2020') else 2021
        rnd = int(re.search(r'정기-(\d)-', b).group(1)) if year == 2020 else None
        key = f"{year}-{grade}{'m' if kind == '상선' else 'f'}"
        exams, pdf = parse_file(f, rnd)
        recs = finalize(exams, pdf, key, stats)
        for (r, si, sname, rec) in recs:
            allrec.append({'y': year, 'r': r, 'g': grade, 'k': kind, 's': si, 'sn': sname, **rec})
        cnt = {}
        for (r, si, sname, rec) in recs:
            cnt.setdefault((r, si, sname), 0)
            cnt[(r, si, sname)] += 1
        print(b, {f'{k[0]}회{k[1]}{k[2]}': v for k, v in cnt.items()}, flush=True)
    json.dump(allrec, open(f'{OUT}/text_qs.json', 'w'), ensure_ascii=False)
    print(stats)
