import json,sys
import os
D=json.load(open(os.path.dirname(os.path.abspath(__file__))+'/interview_auto.json'))
pre=sys.argv[1]
for d in D:
    if not d['id'].startswith(pre): continue
    print('##',d['id'],d['q'].replace('\n',' ')[:110])
    for i,p in enumerate(d['parts']):
        if p.get('en'): print(f' P{i} [EN exact]'); continue
        print(f' P{i}', (d['qs'][i] if i<len(d['qs']) else '')[:60], ('need=%d'%p['need']) if p.get('need') else '')
        for j,it in enumerate(p['items']): print(f'  {j}. {it}')
