import json,glob,sys
import os
H=os.path.dirname(os.path.abspath(__file__))
D=json.load(open(H+'/interview_auto.json'))
by={d['id']:d for d in D}
bad=[];n=0
for f in sorted(glob.glob(H+'/kw/*.json')):
    K=json.load(open(f))
    for qid,parts in K.items():
        d=by[qid]; kp=[p for p in d['parts']]
        if len(kp)==1 and len(parts)!=1 and len(parts)==len(kp[0]['items']): parts=[[x[0] if len(x)==1 and isinstance(x[0],list) else x for x in parts]]
        if len(parts)!=len(kp): bad.append((qid,'parts',len(parts),len(kp))); continue
        for p,kl in zip(kp,parts):
            if p.get('en'):
                continue
            if len(kl)!=len(p['items']): bad.append((qid,'items',len(kl),len(p['items']))); continue
            def clean(k):
                alts=k.split('|')
                good=[a for a in alts if not ((len(a.strip())<=1 and a.strip().isascii()) or a.strip() in ('-','+',''))]
                return '|'.join(good) if good else k
            p['kw']=[[clean(k) for k in it] for it in kl]; n+=1
json.dump(D,open(H+'/../../../apps/cbttest/data/interview.json','w'),ensure_ascii=False,separators=(',',':'))
print('applied parts',n,'bad',bad)
