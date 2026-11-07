import json, glob, os
S=__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
D=S+'/../../apps/cbttest/data'
bank=json.load(open(D+'/bank.json'))
exp={}
for f in sorted(glob.glob(S+'/exp/out/*.json')):
    d=json.load(open(f))
    for k,v in d.items():
        if k not in bank: print('unknown key',k,f); continue
        exp[k]=v.strip()
json.dump(exp, open(D+'/exp.json','w'), ensure_ascii=False, separators=(',',':'))
tot=len(bank)
print('explanations', len(exp), '/', tot, 'text questions', round(os.path.getsize(D+'/exp.json')/1024),'KB')
