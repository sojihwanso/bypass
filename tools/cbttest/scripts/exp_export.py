import json, os, sys
S=__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
D=S+'/site/data'; OUT=S+'/exp/batches'
YEAR=int(sys.argv[1]); BS=int(sys.argv[2]) if len(sys.argv)>2 else 60
bank=json.load(open(D+'/bank.json')); ex=json.load(open(D+'/exams.json'))
latest={}
for e in ex:
    for ref in e['qs']:
        t=(e['y'],e['r'])
        if ref[1] not in latest or t>latest[ref[1]][0]: latest[ref[1]]=(t,e,ref)
SUBO=['항해','운용','법규','영어','상선전문','어선전문']
items=[]
for k,(t,e,ref) in latest.items():
    b=bank[k]
    if t[0]!=YEAR or 'q' not in b: continue
    ordr=ref[3] if len(ref)>3 else list(range(4))
    ans=[b['o'][ordr[i]] for i in ref[2]]
    items.append((e['g'],e['r'],SUBO.index(e['sub']),ref[0],k,e['sub'],b,ans))
items.sort()
L='가나사아'
for bi in range(0,len(items),BS):
    with open(f'{OUT}/{YEAR}_{bi//BS:03d}.txt','w') as f:
        for (g,r,si,n,k,sub,b,ans) in items[bi:bi+BS]:
            opts=' / '.join(f'{L[i]}) {o}' for i,o in enumerate(b['o']))
            f.write(f'#{k} [{g}급 {r}회 {sub} {n}] {b["q"]}\n  {opts}\n  ★정답: {" | ".join(ans)}' + ('  (그림 있음)' if b.get('fig') else '') + '\n')
print(len(items), (len(items)+BS-1)//BS, 'batches')
