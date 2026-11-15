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
import re
# 보기를 가리킬 때 작은따옴표로 표시: 보기 '사', ~다는 '나'는, 문장 첫머리 '아'는
_Q = [(re.compile(r"보기\s*([가나사아])(?=(?:는|가|를|도|와|만|이|의|에|로|\)|,|\.|\s|$))"), r"보기 '\1'"),
      (re.compile(r"((?:다|하|라|있|없|되|이)는)\s([가나사아])(?=(?:는|가|를|도|와|만|이|의)\s)"), r"\1 '\2'"),
      (re.compile(r"((?:^|[:.,]\s))([가나사아])(?=(?:는|가|를|도)\s)"), r"\1'\2'"),
      (re.compile(r"((?:정답표는|정답표의|정답은|정답인|정답을|정답이))\s([가나사아])(?=(?:의|를|로|가|는|도|와|이|,|\.|\s))"), r"\1 '\2'")]
for k, v in exp.items():
    for p_, r_ in _Q: v = p_.sub(r_, v)
    exp[k] = v
json.dump(exp, open(D+'/exp.json','w'), ensure_ascii=False, separators=(',',':'))
tot=len(bank)
print('explanations', len(exp), '/', tot, 'text questions', round(os.path.getsize(D+'/exp.json')/1024),'KB')
