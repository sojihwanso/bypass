import json, glob, os
S=__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
bank=json.load(open(S+'/site/data/bank.json'))
exp={}
for f in sorted(glob.glob(S+'/exp/out/*.json')):
    d=json.load(open(f))
    for k,v in d.items():
        if k not in bank: print('unknown key',k,f); continue
        exp[k]=v.strip()
json.dump(exp, open(S+'/site/data/exp.json','w'), ensure_ascii=False, separators=(',',':'))
tot=sum(1 for b in bank.values() if 'q' in b)
print('explanations', len(exp), '/', tot, 'text questions', round(os.path.getsize(S+'/site/data/exp.json')/1024),'KB')
