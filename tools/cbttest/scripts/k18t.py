import numpy as np, glob, subprocess, sys, json
from PIL import Image
sys.path.insert(0,'.')
from k18 import grid, D, S
def rows_text(path):
    a = np.asarray(Image.open(path).convert('L')) < 150
    strip = a.shape[0] < 80
    xs, rows = grid(a, strip)
    res=[]
    for (y0,y1) in rows:
        cells=[]
        for ci in range(25):
            c=a[y0+4:y1-3, xs[ci]+4:xs[ci+1]-3].copy()
            while c.shape[0]>4 and c[0].mean()>0.4: c=c[1:]
            while c.shape[0]>4 and c[-1].mean()>0.4: c=c[:-1]
            while c.shape[1]>4 and c[:,0].mean()>0.5: c=c[:,1:]
            while c.shape[1]>4 and c[:,-1].mean()>0.5: c=c[:,:-1]
            cells.append(c)
        # compose a clean row image with spacing
        H=40; W=40*25
        canvas=np.zeros((H,W),bool)
        for i,c in enumerate(cells):
            hh,ww=min(c.shape[0],H-4),min(c.shape[1],36)
            canvas[2:2+hh, i*40+2:i*40+2+ww]=c[:hh,:ww]
        im=Image.fromarray((~canvas*255).astype(np.uint8)).resize((W*3,H*3),Image.LANCZOS)
        im.save(S+'/ans/row.png')
        r=subprocess.run(['tesseract',S+'/ans/row.png','-','-l','kor','--psm','7','-c','tessedit_char_whitelist=가나사아'],capture_output=True,text=True)
        res.append(r.stdout.strip().replace(' ',''))
    return res
if __name__=='__main__':
    for p in sys.argv[1:]: print(p, rows_text(p))
