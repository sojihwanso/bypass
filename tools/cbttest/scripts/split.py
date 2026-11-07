import sys
from PIL import Image
f=sys.argv[1]; im=Image.open(f).convert('L')
im=im.point(lambda v:255 if v>165 else v)
w,h=im.size
# find vertical divider near middle: darkest column in 45-55%
import numpy as np
a=np.asarray(im)
lo,hi=int(w*.44),int(w*.56)
dark=(a[int(h*.1):int(h*.95),lo:hi]<120).sum(0)
mid=lo+int(dark.argmax())
im.save(f)
im.crop((0,0,mid-4,h)).save(f[:-4]+'.L.png')
im.crop((mid+4,0,w,h)).save(f[:-4]+'.R.png')
open(f[:-4]+'.mid','w').write(str(mid))
