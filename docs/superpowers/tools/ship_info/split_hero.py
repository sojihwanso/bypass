# usage: split.py <dir> <orig.png> <name-prefix> [dayKeyForIntersect.png]
import sys, json, numpy as np
from PIL import Image, ImageFilter
d, orig, pre = sys.argv[1], sys.argv[2], sys.argv[3]
O = Image.open(f"{d}/{orig}").convert("RGB"); W, H = O.size
def nongreen(p):
    k = np.asarray(Image.open(p).convert("RGB").resize((W, H), Image.LANCZOS)).astype(int)
    r, g, b = k[...,0], k[...,1], k[...,2]
    gr = g - np.maximum(r, b)            # greenness
    return np.clip((140 - gr) / 80, 0, 1)  # 1 = ship, 0 = green
a = nongreen(f"{d}/key.png")
if len(sys.argv) > 4:
    other = (nongreen(sys.argv[4]) > .5).astype(np.uint8) * 255
    dil = np.asarray(Image.fromarray(other).filter(ImageFilter.MaxFilter(9))) > 0
    a = a * dil
# clean: remove speckle by 3x3 median on hard mask, keep soft edge
hard = (a > .5).astype(np.uint8) * 255
hard = np.asarray(Image.fromarray(hard).filter(ImageFilter.MedianFilter(3))) > 0
a = np.where(hard, np.maximum(a, .0), 0)
a = np.asarray(Image.fromarray((a*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6))).astype(float)/255
a[~np.asarray(Image.fromarray(hard.astype(np.uint8)*255).filter(ImageFilter.MaxFilter(3)))>0] = 0
# components on 4px grid, after dilation to join masts
lab_src = np.asarray(Image.fromarray(hard.astype(np.uint8)*255).filter(ImageFilter.MaxFilter(5))) > 0
G = 2; gh, gw = H//G+1, W//G+1
grid = np.zeros((gh, gw), bool)
ys, xs = np.nonzero(lab_src); grid[ys//G, xs//G] = True
lab = np.zeros((gh, gw), int); n = 0
for y in range(gh):
    for x in range(gw):
        if grid[y,x] and not lab[y,x]:
            n += 1; st = [(y,x)]; lab[y,x] = n
            while st:
                cy, cx = st.pop()
                for ny, nx in ((cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)):
                    if 0<=ny<gh and 0<=nx<gw and grid[ny,nx] and not lab[ny,nx]:
                        lab[ny,nx] = n; st.append((ny,nx))
full = lab[np.arange(H)[:,None]//G, np.arange(W)[None,:]//G]
Oa = np.asarray(O)
plate = np.asarray(Image.open(f"{d}/plate.png").convert("RGB").resize((W, H), Image.LANCZOS))
# background: Gemini plate (no ships), with its watermark sparkle patched from sea 90px to the left
bg = plate.copy()
cx, cy, R = round(1430/1552*W), round(567/688*H), round(34/1552*W)
yy, xx = np.mgrid[0:H, 0:W]
dist = np.hypot(xx-cx, yy-cy)
wgt = np.clip((R*1.6 - dist)/(R*0.6), 0, 1)[...,None]
src = np.roll(plate, round(90/1552*W), axis=1)
bg = (bg*(1-wgt) + src*wgt).astype(np.uint8)
Image.fromarray(bg).save(f"{d}/{pre}-bg.webp", "WEBP", quality=86, method=6)
sizes = {i: int(((full == i) & (a > 0)).sum()) for i in range(1, n+1)}
big = [i for i in sizes if sizes[i] >= 2500]
cent = {i: np.argwhere(full == i).mean(0) for i in range(1, n+1) if sizes[i] > 0}
for i in sizes:
    if i in big or sizes[i] == 0: continue
    ys_, xs_ = np.nonzero(full == i); hit = None
    for b in big:
        by, bx = np.nonzero(full == b)
        if ys_.min() >= by.min()-14 and ys_.max() <= by.max()+6 and xs_.min() >= bx.min()-10 and xs_.max() <= bx.max()+10: hit = b; break
    full[full == i] = hit if hit else 0
out = []
for i in big:
    m = (full == i) & (a > 0)
    ys, xs = np.nonzero(m); P = 3
    y0, y1, x0, x1 = max(ys.min()-P,0), min(ys.max()+P+1,H), max(xs.min()-P,0), min(xs.max()+P+1,W)
    rgba = np.dstack([Oa[y0:y1,x0:x1], (a[y0:y1,x0:x1]*m[y0:y1,x0:x1]*255).astype(np.uint8)])
    name = f"{pre}-ship{len(out)+1}.webp"
    Image.fromarray(rgba, "RGBA").save(f"{d}/{name}", "WEBP", quality=90, method=6)
    out.append({"f": name, "x": round(x0/W*100,3), "y": round(y0/H*100,3), "w": round((x1-x0)/W*100,3), "px": [int(x0),int(y0),int(x1-x0),int(y1-y0)], "area": int(m.sum())})
print(json.dumps({"W":W,"H":H,"ships":out}, ensure_ascii=False, indent=1))
