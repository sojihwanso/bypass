"""기관사 1~4급 문제지(2020~2025 텍스트 PDF) → 문항 JSON + 그림/전체 이미지 크롭.
환경변수 CBT_BUILD: 산출물 폴더 (text_qs_engine.json, img/)"""
import sys, os, re, glob, json, zipfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
import parse_text as P
P.SUBNAMES = ['기관1', '기관2', '기관3', '직무일반', '영어']
SRC = '/Users/turo/Downloads/해기사 기출문제'
OUT = P.OUT
files = []  # (path, year, grade, default_round)
for y in [2021, 2022, 2023, 2024, 2025]:
    for f in sorted(glob.glob(f'{SRC}/{y}/기/*.pdf')):
        g = int(re.search(r'(\d)\.pdf$', f).group(1))
        files.append((f, y, g, None))
zd = f'{OUT}/zip2020'; os.makedirs(zd, exist_ok=True)
for zf in sorted(glob.glob(f'{SRC}/2020/기/*.zip')):
    g = int(re.search(r'(\d)\.zip$', zf).group(1))
    z = zipfile.ZipFile(zf)
    for info in z.infolist():
        m = re.search(r'-(\d)-(\d)', info.filename)
        r = int(m.group(1)); assert int(m.group(2)) == g
        p = f'{zd}/2020-g{g}-r{r}.pdf'
        open(p, 'wb').write(z.read(info))
        files.append((p, 2020, g, r))
stats = {'q': 0, 'fig': 0, 'full': 0}
allrec = []
for f, y, g, r0 in files:
    exams, pdf = P.parse_file(f, r0)
    recs = P.finalize(exams, pdf, f'E{y}-{g}' + (f'r{r0}' if r0 else ''), stats)
    cnt = {}
    for (r, si, sname, rec) in recs:
        allrec.append({'y': y, 'r': r, 'g': g, 's': si, 'sn': sname, **rec})
        cnt[(r, sname)] = cnt.get((r, sname), 0) + 1
    bad = {f'{k[0]}회{k[1]}': v for k, v in cnt.items() if v != 25}
    print(os.path.basename(f), y, g, 'rounds', sorted(set(k[0] for k in cnt)), 'subj', len(cnt), 'not25', bad, flush=True)
json.dump(allrec, open(f'{OUT}/text_qs_engine.json', 'w'), ensure_ascii=False)
print(stats, len(allrec))
