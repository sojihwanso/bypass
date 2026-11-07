# Extract ordered column lines (with trailing-space info) from text PDFs
import pdfplumber, json, sys, re
def page_lines(pg):
    W=pg.width; mid=W/2
    out=[]
    for ci,(x0,x1) in enumerate([(0,mid),(mid,W)]):
        chars=[c for c in pg.chars if x0<= (c['x0']+c['x1'])/2 < x1]
        chars.sort(key=lambda c:c['top'])
        rows=[]
        for c in chars:
            bl=c['bottom']
            for r in rows:
                if abs(r['bl']-bl)<4 or (c['top']<r['bl']-2 and c['bottom']>r['top']+2 and c['size']<r['size']*0.85):
                    r['c'].append(c); r['top']=min(r['top'],c['top']); break
            else:
                rows.append({'bl':bl,'top':c['top'],'size':c['size'],'c':[c]})
        for r in rows:
            cs=sorted(r['c'],key=lambda c:c['x0'])
            t=''; px=None
            for c in cs:
                if px is not None and c['x0']-px>c['size']*0.6 and not t.endswith(' ') and c['text']!=' ': t+=' '
                t+=c['text']; px=c['x1']
            fonts=set(c['fontname'] for c in cs)
            out.append({'col':ci,'top':r['top'],'bot':max(c['bottom'] for c in cs),'x0':cs[0]['x0'],'x1':max(c['x1'] for c in cs),'t':t,'unk':any('unknown' in f for f in fonts)})
    out.sort(key=lambda l:(l['col'],l['top']))
    return out
if __name__=='__main__':
    p=pdfplumber.open(sys.argv[1]); i=int(sys.argv[2])
    for l in page_lines(p.pages[i]): print(l['col'],round(l['top']),round(l['x0']),'U' if l['unk'] else ' ',repr(l['t']))
