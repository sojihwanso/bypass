import json,glob,re,sys
for f in sorted(glob.glob(__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/kw/*.txt')):
    out={};cur=None
    for line in open(f):
        line=line.strip()
        if not line: continue
        if line.startswith('@'):
            cur=line[1:].strip(); out[cur]=[[]]; continue
        if line=='--': out[cur].append([]); continue
        out[cur][-1].append([k.strip() for k in line.split(';') if k.strip()])
    json.dump(out,open(f[:-4]+'.json','w'),ensure_ascii=False)
