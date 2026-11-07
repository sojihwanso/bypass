import json, re, glob, difflib, sys
SP='/private/tmp/claude-501/-Users-turo-Downloads-Claude-bypass/4e994929-7427-486c-b449-3e4c5df71252/scratchpad/ocr'
R='/Users/turo/Downloads/Claude/bypass/apps/cbttest/data'
b=json.load(open(R+'/bank.json')); e=json.load(open(R+'/exp.json')); ex=json.load(open(R+'/exams.json'))
ocr={}
for f in glob.glob(SP+'/o[0-9].json'): ocr.update(json.load(open(f)))
meta={it['k']:it['meta'] for it in json.load(open(SP+'/all.json'))}
# answer text for text questions
latest={}
for x in ex:
    if x['y']==2018: continue
    for ref in x['qs']:
        k=ref[1]; bb=b[k]
        if 'q' not in bb: continue
        ordr=ref[3] if len(ref)>3 else list(range(4))
        latest[k]=[bb['o'][ordr[i]] for i in ref[2]]
def norm(s): return re.sub(r'[^0-9A-Za-z가-힣]','',s).lower()
def parse(t):
    t=re.sub(r'^\s*\d+\s*[.,]\s*','',t)
    t=t.replace('\n',' ')
    parts=re.split(r'(?:(?<=\s)|^)(가|나|사|아)\s*[.,]\s', t)
    stem=parts[0]; opts={}
    for i in range(1,len(parts)-1,2): opts.setdefault(parts[i],parts[i+1].strip())
    return stem.strip(), [opts.get(L,'') for L in '가나사아']
cands=[(k,norm(b[k]['q'])) for k in latest if k in e]
from collections import defaultdict, Counter
inv=defaultdict(set); cmap=dict(cands)
for k,n in cands:
    for i in range(0,max(1,len(n)-4),2): inv[n[i:i+5]].add(k)
out={}; rows=[]
for k,t in ocr.items():
    stem,opts=parse(t); ns=norm(stem)
    g,r,sub,num,ans=meta[k]
    best=(0,None)
    cnt=Counter()
    for i in range(max(1,len(ns)-4)): cnt.update(inv.get(ns[i:i+5],()))
    pool=[(ck,cmap[ck]) for ck,_ in cnt.most_common(15)]
    for ck,cn in pool:
        if abs(len(cn)-len(ns))>max(8,len(ns)*.25): continue
        s=difflib.SequenceMatcher(None,ns,cn).ratio()
        if s>best[0]: best=(s,ck)
    rec={'k':k,'g':g,'r':r,'sub':sub,'n':num,'stem':stem,'opts':opts,'ans':[ '가나사아'[i] for i in ans],'ansText':[opts[i] for i in ans]}
    if best[0]>=0.85:
        ck=best[1]; at=latest[ck]
        ok=all(max(difflib.SequenceMatcher(None,norm(a),norm(x)).ratio() for x in at)>=0.75 for a in rec['ansText'] if a) and all(rec['ansText'])
        # options set similar too
        osim=sum(max(difflib.SequenceMatcher(None,norm(o),norm(x)).ratio() for x in b[ck]['o']) for o in opts)/4
        if ok and osim>=0.8:
            out[k]=e[ck]; continue
    rows.append(rec)
json.dump(out,open(SP+'/reuse.json','w'),ensure_ascii=False,indent=0)
json.dump(rows,open(SP+'/todo.json','w'),ensure_ascii=False)
print('ocr',len(ocr),'reused',len(out),'todo',len(rows))
print('bad parse',sum(1 for x in rows if not all(x['opts'])))
