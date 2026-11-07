import json,math,re
import os
D=json.load(open(os.path.dirname(os.path.abspath(__file__))+'/../../../apps/cbttest/data/interview.json'))
def norm(s): return re.sub(r'\s+','',s.lower()).replace('’',"'")
def hit(t,k): return any(norm(a) and norm(a) in t for a in k.split('|'))
def part_ok(p,ans):
    t=norm(ans); items=[]
    for kws in p['kw']:
        h=[k for k in kws if hit(t,k)]
        items.append(len(h)>=math.ceil(len(kws)*0.5) if kws else None)
    sc=[x for x in items if x is not None]
    need=min(p['need'],len(sc)) if p.get('need') else math.ceil(len(sc)*0.6)
    return bool(t) and len(sc)>0 and sum(sc)>=need, sum(sc), need
fails=[];weak=[]
for d in D:
    for i,p in enumerate(d['parts']):
        if p.get('en'): continue
        ok,c,n=part_ok(p,'\n'.join(p['items']))
        if not ok: fails.append((d['id'],i,c,n))
        # each item's own text must cover itself
        for it,kws in zip(p['items'],p['kw']):
            h=[k for k in kws if hit(norm(it),k)]
            if len(h)<math.ceil(len(kws)*0.5): weak.append((d['id'],i,it[:40],[k for k in kws if not hit(norm(it),k)]))
        ok2,_,_=part_ok(p,'잘 모르겠습니다. 선박의 안전을 위해 노력합니다.')
        if ok2: fails.append(('JUNKPASS',d['id'],i))
print('fails',fails[:20],len(fails)); print('weak',len(weak))
for w in weak: print(w)
import random
random.seed(1)
parts=[(d,p) for d in D for p in d['parts'] if not p.get('en')]
fp=[]
for d,p in parts:
    others=[q for q in parts if q[0]['sub']==d['sub'] and q[0]['g']==d['g'] and q[0]['id']!=d['id']]
    for od,op in random.sample(others,min(5,len(others))):
        if part_ok(p,'\n'.join(op['items']))[0]: fp.append((d['id'],od['id']))
print('false pass',len(fp),'of',len(parts)*5); print(fp[:30])
