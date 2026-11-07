import sys, subprocess, json, os, csv, io
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
S=__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
pdf, p = sys.argv[1], int(sys.argv[2])
tag=os.path.basename(pdf)[:-4]+'-%02d'%p
out=f'{S}/ocr18/{tag}.json'
if os.path.exists(out): sys.exit()
tmp=f'{S}/ocr18/{tag}'
subprocess.run(['pdftoppm','-r','110','-gray','-png','-f',str(p),'-l',str(p),'-singlefile',pdf,tmp],check=True)
im=Image.open(tmp+'.png').convert('L'); os.remove(tmp+'.png')
im=im.point(lambda v:255 if v>170 else v)
w,h=im.size; a=np.asarray(im)
lo,hi=int(w*.44),int(w*.56)
dark=(a[int(h*.15):int(h*.9),lo:hi]<120).sum(0)
mid=lo+int(dark.argmax())
DW=1500
im.resize((DW,round(h*DW/w)),Image.LANCZOS).save(f'{S}/ocr18/pages/{tag}.jpg',quality=58,optimize=True,progressive=True)
res={'w':w,'h':h,'mid':mid,'cols':[]}
for (x0,x1) in [(0,mid-6),(mid+6,w)]:
  c=im.crop((x0,0,x1,h)); c=c.resize((c.width//2,c.height//2),Image.LANCZOS)
  c.save(tmp+'.c.png')
  r=subprocess.run(['tesseract',tmp+'.c.png','-','-l','kor','--psm','6','tsv'],capture_output=True,text=True)
  lines={}
  for row in csv.DictReader(io.StringIO(r.stdout),delimiter='\t',quoting=csv.QUOTE_NONE):
    if row['level']!='5' or not row['text'].strip(): continue
    k=(row['block_num'],row['par_num'],row['line_num'])
    L=lines.setdefault(k,{'words':[]})
    L['words'].append((int(row['left'])*2+x0,int(row['top'])*2,int(row['width'])*2,int(row['height'])*2,row['text']))
  ls=[]
  for L in lines.values():
    ws=L['words']; ls.append({'x':ws[0][0],'y':min(q[1] for q in ws),'y2':max(q[1]+q[3] for q in ws),'t':' '.join(q[4] for q in ws)})
  ls.sort(key=lambda l:l['y'])
  res['cols'].append({'x0':x0,'x1':x1,'lines':ls})
os.remove(tmp+'.c.png')
json.dump(res,open(out,'w'),ensure_ascii=False)
