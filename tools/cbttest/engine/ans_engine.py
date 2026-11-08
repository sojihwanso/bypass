"""기관사 1~4급 정답표 파싱 (2020~2025): {f'{y}-{r}-{g}-{sub}': [25 tokens]}"""
import fitz, re, json, glob, os, sys, zipfile, io
SRC = '/Users/turo/Downloads/해기사 기출문제'
SUBS = ['기관1', '기관2', '기관3', '직무일반', '영어']
TOK = re.compile(r'^(?:[가나사아](?:[/,]?[가나사아])*|전항정답|정답없음|모두정답)$')
def rows(page):
    ws = page.get_text('words')
    lines = {}
    for x0, y0, x1, y1, w, *_ in ws:
        yc = round((y0 + y1) / 2 / 3)
        lines.setdefault(yc, []).append((x0, w, y0))
    out = []
    for yc in sorted(lines):
        out.append(sorted(lines[yc]))
    return out
def parse_doc(doc, year, ans):
    for page in doc:
        t = page.get_text()
        head = t[:120]
        if '기관사' not in head or '국내한정' in head: continue
        m = re.search(r'(?<!\d)(\d)\s*급\s*기관사', head) or re.search(r'기관사\s*답안\s*<\s*(\d)\s*>', head)
        if not m: continue
        g = int(m.group(1))
        if g > 4: continue
        ws = page.get_text('words')
        marks = [(y, i + 1) for i, y in enumerate(sorted(set(round(w[1]) for w in ws if w[4] == '◎')))]
        for w in ws:
            if w[4] not in SUBS: continue
            yc = (w[1] + w[3]) / 2
            rnd = [r for (y, r) in marks if y < w[1]]
            if not rnd: continue
            rnd = rnd[-1]
            toks = sorted((v[0], re.sub(r'\s', '', v[4])) for v in ws if v[0] > w[2] and abs((v[1] + v[3]) / 2 - yc) < 5)
            toks = [('/'.join(t.replace('/', '').replace(',', '')) if re.fullmatch(r'[가나사아/,]+', t) else t) for _, t in toks if TOK.match(t)]
            if len(toks) == 25:
                ans[f'{year}-{rnd}-{g}-{w[4]}'] = toks
            else:
                print('WARN', year, g, rnd, w[4], len(toks), file=sys.stderr)
ans = {}
for y, pat in [(2021, '2021/항/*answer*.pdf'), (2022, '2022/항/*answer*.pdf'), (2023, '2023/항/*answer*.pdf'), (2024, '2024/항/*answer*.pdf'), (2025, '2025/항/2025_202525.pdf')]:
    parse_doc(fitz.open(glob.glob(f'{SRC}/{pat}')[0]), y, ans)
# 2020: zip of per-grade answer PDFs (text is sequential: 제N회, 과목, 25 tokens)
z = zipfile.ZipFile(f'{SRC}/2020/항/2020_2020_answer.zip')
for info in z.infolist():
    name = info.filename.encode('cp437').decode('cp949', 'replace')
    m = re.match(r'2020 (\d)급기관답안', name)
    if not m or int(m.group(1)) > 4: continue
    g = int(m.group(1))
    L = [x.strip() for p in fitz.open(stream=z.read(info), filetype='pdf') for x in p.get_text().split('\n') if x.strip()]
    rnd = None
    for i, x in enumerate(L):
        mr = re.fullmatch(r'제\s*(\d)\s*회', x)
        if mr: rnd = int(mr.group(1)); continue
        if x in SUBS and rnd:
            toks = L[i + 1:i + 26]
            if len(toks) == 25 and all(TOK.match(t) for t in toks): ans[f'2020-{rnd}-{g}-{x}'] = toks
            else: print('WARN 2020', g, rnd, x, file=sys.stderr)
import collections
c = collections.Counter(k.rsplit('-', 1)[0] for k in ans)
print(len(ans), sorted(c.items()))
json.dump(ans, open(os.path.dirname(os.path.abspath(__file__)) + '/answers_engine.json', 'w'), ensure_ascii=False, indent=0)
