import sys, os, re, glob, json
sys.path.insert(0, os.path.dirname(__file__))
import parse_text as P
S = P.S
stats = {'q': 0, 'fig': 0, 'full': 0}
allrec = []
for f in sorted(glob.glob(f'{S}/new/norm/*.pdf')):
    b = os.path.basename(f)
    m = re.match(r'(\d{4})-(\d)급항해사\((상선|어선)\)', b)
    year, grade, kind = int(m.group(1)), int(m.group(2)), m.group(3)
    key = f"{year}-{grade}{'m' if kind == '상선' else 'f'}"
    exams, pdf = P.parse_file(f, None)
    recs = P.finalize(exams, pdf, key, stats)
    cnt = {}
    for (r, si, sname, rec) in recs:
        allrec.append({'y': year, 'r': r, 'g': grade, 'k': kind, 's': si, 'sn': sname, **rec})
        cnt[(r, si, sname)] = cnt.get((r, si, sname), 0) + 1
    bad = {f'{k[0]}회{k[1]}{k[2]}': v for k, v in cnt.items() if v != 25}
    print(b, 'exams', sorted(set(k[0] for k in cnt)), 'subjects', len(cnt), 'not25', bad, flush=True)
json.dump(allrec, open(f'{P.OUT}/text_qs_new.json', 'w'), ensure_ascii=False)
print(stats)
