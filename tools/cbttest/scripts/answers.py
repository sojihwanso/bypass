import re, subprocess, json
S=__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
SUBJ=['항해','운용','법규','영어','상선전문','어선전문']
T=r'(?:[가나사아](?:\s*[/,]\s*[가나사아])*|전항정답|정답없음|모두정답)'
ROW=re.compile(r'(항해|운용|법규|영어|상선전문|어선전문)\s+((?:'+T+r'\s+){24}'+T+')')
def txt(p): return subprocess.run(['pdftotext','-layout',p,'-'],capture_output=True,text=True).stdout
ans={}  # key: f"{y}-{r}-{g}-{kind}-{subj}" kind in m/f/x(both)
def put(y,r,g,kind,sub,s):
    a=re.sub(r'\s*([/,])\s*',r'\1',s).split(); assert len(a)==25, s
    ans[f'{y}-{r}-{g}-{kind}-{sub}']=a
# 2020
for g in [1,2,3,4]:
    t=txt(f'{S}/ans/a2020/2020 {g}급항해답안.pdf')
    t='\n'+t
    blocks=re.split(r'\n\s*직종\s+과목[^\n]*\n',t)
    for b in blocks[1:]:
        m=re.search(r'제\s*(\d)\s*회',b); r=int(m.group(1))
        kind='m' if '(상선)' in b else 'f' if '(어선)' in b else 'x'
        for mm in ROW.finditer(b): put(2020,r,g,kind,mm.group(1),mm.group(2))
# 2021
t=txt(f'{S}/ans/a2021.pdf')
for sec in re.split(r'(?=<[^<>\n]*답안\s*>)',t):
    m=re.match(r'<\s*(\d)급\s*항해사\((상선|어선)\)\s*답안\s*>',sec)
    if not m: continue
    g=int(m.group(1)); kind='m' if m.group(2)=='상선' else 'f'
    if g>4: continue
    for rb in re.split(r'(?=◎)',sec):
        mr=re.search(r'제\s*(\d)\s*회',rb)
        if not mr: continue
        for mm in ROW.finditer(rb): put(2021,int(mr.group(1)),g,kind,mm.group(1),mm.group(2))
# 2022-2025 (same layout as 2021)
import glob
for y in [2022, 2023, 2024, 2025]:
    fs = glob.glob(f'/mnt/user-data/uploads/{y}/항/*.pdf')
    t = txt(fs[0])
    for sec in re.split(r'(?=<[^<>\n]*답안\s*>)', t):
        m = re.match(r'<\s*(\d)\s*급\s*항해사\s*\((상선|어선)\)\s*답안\s*>', sec)
        if not m: continue
        g = int(m.group(1)); kind = 'm' if m.group(2) == '상선' else 'f'
        if g > 4: continue
        for rb in re.split(r'(?=◎)', sec):
            mr = re.search(r'(\d{4})\s*년\s*(?:제\s*)?(\d)\s*회', rb)
            if not mr: continue
            for mm in ROW.finditer(rb): put(y, int(mr.group(2)), g, kind, mm.group(1), mm.group(2))
# 2018 manual
for line in open(f'{S}/ans/k18_manual.txt'):
    g,r,sub,a=line.split(); ans[f'2018-{r}-{g}-x-{sub}']=list(a)
json.dump(ans,open(f'{S}/build/answers.json','w'),ensure_ascii=False,indent=0)
import collections
c=collections.Counter(k.rsplit('-',2)[0] for k in ans)
for k in sorted(c): print(k, c[k], sorted(set(x.split('-')[3]+x.split('-')[4] for x in ans if x.startswith(k+'-'))))
