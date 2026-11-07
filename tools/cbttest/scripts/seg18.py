"""Segment 2018 scanned exam pages into per-question image crops using OCR line positions."""
import json, glob, re, os, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
S = __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
OCR = f'{S}/ocr18'
OUT = f'{S}/build'
A = json.load(open(f'{OUT}/answers.json'))
SUBS = ['항해', '운용', '법규', '영어', '상선전문', '어선전문']
DIG = re.compile(r'^\s*(\d{1,2})\s*[.,]')


def load(g):
    pages = []
    for f in sorted(glob.glob(f'{OCR}/2018_sailor_{g}-*.json')):
        d = json.load(open(f))
        d['tag'] = os.path.basename(f)[:-5]
        t = ''.join(l['t'] for c in d['cols'] for l in c['lines']).replace(' ', '')
        if re.search('알려드립니다|지침서의용도', t):
            for c in d['cols']:
                idx = [i for i, l in enumerate(c['lines']) if re.search(r'과\s*목', l['t'])]
                c['lines'] = c['lines'][idx[0]:] if idx else []
        pages.append(d)
    return pages


ALL = []

def events(pages):
    ALL.clear()
    """Yield ordered events: ('start', page, col, y, digit) / ('subj', ...) / ('hdr', ...)"""
    ev = []
    for pi, d in enumerate(pages):
        H = d['h']
        hdr = any(re.search(r'직\s*종\s*[:：]|수\s*험\s*번\s*호', l['t']) for c in d['cols'] for l in c['lines'] if l['y'] < H * 0.12)
        if hdr:
            ev.append(('hdr', pi, 0, 0, None))
        for ci, c in enumerate(d['cols']):
            ls = [l for l in c['lines'] if l['y'] < H - 40]
            dx = sorted(l['x'] for l in ls if DIG.match(l['t']))
            x0 = dx[len(dx) // 4] if dx else (min(l['x'] for l in ls) if ls else c['x0'])
            prev = None
            ls = [l for l in ls if not (l['y'] < H * 0.12 and re.search(r'직\s*종|수\s*험|년\s*도|해\s*기\s*사\s*시\s*험|성\s*명', l['t']))]
            for l in ls:
                ALL.append((pi, ci, l['y'], l['x'] - x0, l, (l['y'] - prevy) if (prevy := (ALL[-1][4]['y2'] if ALL and ALL[-1][0] == pi and ALL[-1][1] == ci else -999)) > -999 else 999))
                rel = l['x'] - x0
                t = l['t']
                if re.search(r'과\s*[목옥]\s*\[', t) or re.search(r'^[체제]\s*\d\s*과\s*[목옥]', t):
                    ev.append(('subj', pi, ci, l['y'], None, re.sub(r'\s', '', t)))
                    prev = l
                    continue
                m = DIG.match(t)
                if re.search(r'바\s*랍\s*니\s*다|수\s*고|^[|_\-\s]*[가나사아]\s*[.,]', t):
                    m = None
                    prev = l
                    continue
                gap = (l['y'] - prev['y2']) if prev else 999
                if -40 < rel < 50 and (m or (gap > 50 and re.match(r'^\s*[0-9IlOoSB]{1,2}\s*[.,]', t))):
                    ev.append(('start', pi, ci, l['y'], int(m.group(1)) if m else None, l))
                prev = l
    return ev


def build(g):
    pages = load(g)
    ev = events(pages)
    ei, si, expect = 0, 0, 1
    seq = []
    first = True
    names = []  # per exam list of subject names
    lasthdr = ''
    cur = ['항해']
    def nextsub():
        nonlocal si
        si += 1
        k = len(cur)
        if k < 4:
            cur.append(SUBS[k])
        else:
            if '어' in lasthdr[:12] and '어선전문' not in cur: cur.append('어선전문')
            elif '상' in lasthdr[:12] and '상선전문' not in cur: cur.append('상선전문')
            else: cur.append('상선전문' if '상선전문' not in cur else '어선전문')
    for e in ev:
        if e[0] == 'hdr':
            if not first:
                ei += 1; si = 0; expect = 1; cur = ['항해']
                if ei >= 4: break
            continue
        if e[0] == 'subj':
            lasthdr = e[5] if len(e) > 5 else ''
            if expect >= 18 and not first:
                nextsub(); expect = 1
            continue
        if e[0] != 'start':
            continue
        dgt = e[4]
        if first and dgt and dgt > 1:
            expect = dgt
        first = False
        if dgt == expect or (dgt is None and expect <= 25):
            n = expect
        elif dgt is not None and expect < dgt <= expect + 3 and dgt <= 25:
            n = dgt
        elif dgt is not None and dgt <= 3 and expect >= 20:
            nextsub(); n = dgt
        elif dgt is None and expect > 25:
            nextsub(); n = 1
        else:
            continue
        seq.append((ei + 1, cur[si], n, e))
        expect = n + 1
    # gap filling
    filled = []
    for k, item in enumerate(seq):
        filled.append(item)
        if k + 1 < len(seq):
            r, sub, n, e = item
            r2, sub2, n2, e2 = seq[k + 1]
            if (r, sub) == (r2, sub2) and n2 - n in (2, 3):
                need = n2 - n - 1
                a = (e[1], e[2], e[3]); b = (e2[1], e2[2], e2[3])
                cands = [x for x in ALL if a < (x[0], x[1], x[2]) < b and x[3] < 60 and x[5] > 25 and not re.match(r'^[|_\-\s]*[가나사아]\s*[.,]', x[4]['t'])]
                cands.sort(key=lambda x: -x[5])
                pick = sorted(cands[:need], key=lambda x: (x[0], x[1], x[2]))
                for j, x in enumerate(pick):
                    filled.append((r, sub, n + 1 + j, ('start', x[0], x[1], x[2], None, x[4])))
    # edge gap filling (missing last / first question of a subject)
    filled.sort(key=lambda it: (it[3][1], it[3][2], it[3][3]))
    extra = []
    for k in range(len(filled) - 1):
        r, sub, n, e = filled[k]; r2, sub2, n2, e2 = filled[k + 1]
        if r != r2 or sub == sub2:
            continue
        a = (e[1], e[2], e[3]); b = (e2[1], e2[2], e2[3])
        span = [x for x in ALL if a < (x[0], x[1], x[2]) < b]
        hi = [i for i, x in enumerate(span) if re.search(r'과\s*[목옥]', x[4]['t'])]
        hidx = hi[0] if hi else len(span)
        if n < 25:
            c = [x for x in span[:hidx] if -80 < x[3] < 40 and x[5] > -30 and not re.match(r'^[|_\-\s]*[가나사아]\s*[.,]', x[4]['t'])]
            c.sort(key=lambda x: -x[5])
            for j, x in enumerate(sorted(c[:25 - n], key=lambda x: (x[0], x[1], x[2]))):
                extra.append((r, sub, n + 1 + j, ('start', x[0], x[1], x[2], None, x[4])))
        if n2 > 1:
            c = [x for x in span[hidx + 1:] if x[3] < 60 and x[5] > 25 and not re.search(r'과\s*[목옥]', x[4]['t']) and not re.match(r'^[|_\-\s]*[가나사아]\s*[.,]', x[4]['t'])]
            c.sort(key=lambda x: -x[5])
            for j, x in enumerate(sorted(c[:n2 - 1], key=lambda x: (x[0], x[1], x[2]))):
                extra.append((r2, sub2, j + 1, ('start', x[0], x[1], x[2], None, x[4])))
    filled += extra
    # classify 5th/6th subjects by content
    FISH = r'어선|어구|트롤|어획|어업|어군|어로|수산|어장|선망|연승|자망|원양|어류|어창|양망|투망|어탐|집어'
    CARGO = r'화물|용선|탱커|컨테이너|선하증권|적하|하역|운임|보험|화주|원유|벌크|선적|양하|화차|위험물'
    keys = sorted([(x[0], x[1], x[2]) for x in ALL])
    import bisect
    filled.sort(key=lambda it: (it[0], (it[3][1], it[3][2], it[3][3])))
    starts = sorted(((it[3][1], it[3][2], it[3][3]), k) for k, it in enumerate(filled))
    txt = {}
    for j, (pos, k) in enumerate(starts):
        end = starts[j + 1][0] if j + 1 < len(starts) else (9999, 9, 0)
        txt[k] = ' '.join(x[4]['t'] for x in ALL if pos <= (x[0], x[1], x[2]) < end).replace(' ', '')
    grp = {}
    for k, it in enumerate(filled):
        if it[1] in ('상선전문', '어선전문'):
            grp.setdefault(it[0], {}).setdefault(it[1], []).append(k)
    rename = {}
    for r, gs in grp.items():
        sc = {}
        for name, ks in gs.items():
            t = ''.join(txt[k] for k in ks)
            sc[name] = len(re.findall(FISH, t)) - len(re.findall(CARGO, t))
        if len(sc) == 2:
            a, b = sorted(sc, key=lambda n: sc[n])
            rename[(r, a)] = '상선전문'; rename[(r, b)] = '어선전문'
        else:
            (name, v), = sc.items()
            rename[(r, name)] = '어선전문' if v > 0 else '상선전문'
        print('  classify', g, r, sc, {k[1]: v for k, v in rename.items() if k[0] == r})
    filled = [(r, rename.get((r, sub), sub), n, e) for (r, sub, n, e) in filled]
    return pages, filled


def crops(g, pages, seq):
    res = []
    imgcache = {}

    def page_img(pi):
        if pi not in imgcache:
            imgcache.clear()
            imgcache[pi] = Image.open(f"{OCR}/pages/{pages[pi]['tag']}.jpg")
        return imgcache[pi]

    def col_bounds(pi, ci):
        d = pages[pi]; c = d['cols'][ci]
        ls = [l for l in c['lines'] if l['y'] < d['h'] - 40]
        return c['x0'], c['x1'], ls

    for k, (r, sub, n, e) in enumerate(seq):
        _, pi, ci, y = e[:4]
        nxt = seq[k + 1][3] if k + 1 < len(seq) else None
        # also stop at subject headers / exam headers between
        pieces = []
        cur_pi, cur_ci, cur_y = pi, ci, y - 18
        while True:
            x0, x1, ls = col_bounds(cur_pi, cur_ci)
            # end in this column: next start in same col below, or a subj header
            ends = []
            if nxt and nxt[1] == cur_pi and nxt[2] == cur_ci and nxt[3] > cur_y + 20:
                ends.append(nxt[3] - 18)
            for l in ls:
                if l['y'] > cur_y + 30 and (re.search(r'과\s*[목옥]\s*\[|^[체제]\s*\d\s*과\s*[목옥]', l['t'])):
                    ends.append(l['y'] - 20)
            if ends:
                yb = min(ends)
                inside = [l for l in ls if cur_y <= l['y'] < yb]
                if inside:
                    yb = min(yb, max(l['y2'] for l in inside) + 22)
                pieces.append((cur_pi, x0, cur_y, x1, yb))
                break
            inside = [l for l in ls if l['y'] >= cur_y]
            yb = (max(l['y2'] for l in inside) + 22) if inside else cur_y + 10
            pieces.append((cur_pi, x0, cur_y, x1, yb))
            # move to next column/page
            if cur_ci == 0:
                cur_ci = 1
            else:
                cur_pi += 1; cur_ci = 0
            if cur_pi >= len(pages) or len(pieces) > 3:
                break
            if nxt and (nxt[1], nxt[2]) < (cur_pi, cur_ci):
                break
            x0b, x1b, lsb = col_bounds(cur_pi, cur_ci)
            # skip header area on header pages
            top = min([l['y'] for l in lsb] or [0])
            hdrl = [l for l in lsb if re.search(r'직\s*종|수\s*험|성\s*명|해기사', l['t']) and l['y'] < pages[cur_pi]['h'] * 0.12]
            if hdrl:
                top = max(l['y2'] for l in hdrl) + 10
            # if next start is at the very top of this column, stop
            if nxt and nxt[1] == cur_pi and nxt[2] == cur_ci and nxt[3] - top < 40:
                break
            # stop when a subject header is first in the column
            firstl = [l for l in lsb if l['y'] >= top]
            if firstl and re.search(r'과\s*[목옥]', firstl[0]['t']):
                break
            cur_y = top - 12
        res.append((r, sub, n, pieces))
    return res


def render(g, pages, res):
    out = []
    os.makedirs(f'{OUT}/img18', exist_ok=True)
    for (r, sub, n, pieces) in res:
        ims = []
        for (pi, x0, y0, x1, y1) in pieces:
            d = pages[pi]
            if min(d['h'], y1) - max(0, y0) < 8:
                continue
            im = Image.open(f"{OCR}/pages/{d['tag']}.jpg")
            sc = im.width / d['w']
            c = im.crop((int(x0 * sc), int(max(0, y0) * sc), int(x1 * sc), int(min(d['h'], y1) * sc)))
            ims.append(c)
        if not ims:
            continue
        # trim right whitespace & stack
        W = max(i.width for i in ims); H = sum(i.height for i in ims)
        canvas = Image.new('L', (W, H), 255); yy = 0
        for i in ims:
            canvas.paste(i.convert('L'), (0, yy)); yy += i.height
        from PIL import ImageOps
        inv = ImageOps.invert(canvas).point(lambda v: 255 if v > 60 else 0)
        bb = inv.getbbox()
        if bb:
            canvas = canvas.crop((max(0, bb[0] - 10), max(0, bb[1] - 8), min(W, bb[2] + 10), min(H, bb[3] + 8)))
        if canvas.width > 900:
            canvas = canvas.resize((900, round(canvas.height * 900 / canvas.width)), Image.LANCZOS)
        si = SUBS.index(sub) + 1
        name = f'2018-{g}-r{r}-s{si}-{n:02d}.webp'
        canvas.save(f'{OUT}/img18/{name}', 'WEBP', quality=60, method=6)
        out.append({'y': 2018, 'r': r, 'g': g, 'k': 'x', 's': si, 'sn': sub, 'n': n, 'full': [f'img18/{name}']})
    return out


if __name__ == '__main__':
    allq = []
    for g in [1, 2, 3, 4]:
        pages, seq = build(g)
        import collections
        cnt = collections.Counter((r, s) for (r, s, n, e) in seq)
        print(g, dict(cnt))
        # missing numbers
        for (r, s), c in sorted(cnt.items()):
            ns = sorted(n for (rr, ss, n, e) in seq if rr == r and ss == s)
            miss = [i for i in range(1, 26) if i not in ns]
            if miss:
                print('   missing', r, s, miss)
        if '--render' in sys.argv:
            res = crops(g, pages, seq)
            allq += render(g, pages, res)
    if '--render' in sys.argv:
        json.dump(allq, open(f'{OUT}/qs18.json', 'w'), ensure_ascii=False)
        print(len(allq))
