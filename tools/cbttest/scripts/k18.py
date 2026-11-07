import numpy as np, json, glob, subprocess, os
from PIL import Image
S = __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
D = f'{S}/ans/k18'


def grid(a, strip):
    h, w = a.shape
    pc = a.mean(0)
    cand = np.where(pc > 0.4)[0]
    Lx = [x for x in cand if 140 < x < 185][0]
    Rx = cand.max()
    xs = []
    for i in range(26):
        e = round(Lx + (Rx - Lx) * i / 25); lo, hi = max(0, e - 6), min(w - 1, e + 6)
        xs.append(lo + int(pc[lo:hi + 1].argmax()))
    pr = a[:, Lx:Rx].mean(1)
    if strip:
        yy = np.where(pr > 0.5)[0]
        top = [y for y in yy if y < h / 2]; bot = [y for y in yy if y > h / 2]
        rows = [(max(top) if top else 0, min(bot) if bot else h)]
    else:
        ys = []
        for i in range(7):
            e = round(h * i / 6); lo, hi = max(0, e - 7), min(h - 1, e + 7)
            ys.append(lo + int(pr[lo:hi + 1].argmax()))
        rows = [(ys[i], ys[i + 1]) for i in range(1, 6)]
    return xs, rows


def feat(c):
    ys_, xs_ = np.where(c)
    if len(ys_) == 0:
        return np.zeros(16 * 16)
    c = c[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1]
    return (np.asarray(Image.fromarray((c * 255).astype(np.uint8)).resize((16, 16), Image.BILINEAR)) / 255.0).flatten()


def extract(pdfpath, pages, tag):
    out = []  # (page, round, row, col, feat, crop)
    for pg in pages:
        subprocess.run(['pdfimages', '-f', str(pg), '-l', str(pg), '-png', pdfpath, f'{D}/{tag}p{pg}'], check=True)
        ims = sorted(glob.glob(f'{D}/{tag}p{pg}-*.png'))
        rnd = 0
        for path in ims:
            a = np.asarray(Image.open(path).convert('L')) < 150
            strip = a.shape[0] < 80
            if not strip:
                rnd += 1
            xs, rows = grid(a, strip)
            a = a.copy()
            for x in xs: a[:, max(0, x - 2):x + 3] = False
            for (y0, y1) in rows:
                for y in (y0, y1):
                    a[max(0, y - 2):y + 3, xs[0]:] = False
            for ri, (y0, y1) in enumerate(rows):
                for ci in range(25):
                    c = a[y0 + 1:y1, xs[ci] + 1:xs[ci + 1]].copy()
                    # drop rows/cols that are near-solid (residual grid lines) only at the edges
                    while c.shape[0] > 4 and c[0].mean() > 0.5: c = c[1:]
                    while c.shape[0] > 4 and c[-1].mean() > 0.5: c = c[:-1]
                    while c.shape[1] > 4 and c[:, 0].mean() > 0.6: c = c[:, 1:]
                    while c.shape[1] > 4 and c[:, -1].mean() > 0.6: c = c[:, :-1]
                    out.append((pg, rnd, 'f' if strip else ri, ci, feat(c), c))
    return out


if __name__ == '__main__':
    cells = extract(f'{S}/ans/a2018.pdf', [1, 2, 3, 4], 'a')
    F = np.array([c[4] for c in cells])
    rng = np.random.default_rng(0)
    best = None
    K = 5
    for trial in range(10):
        C = F[rng.choice(len(F), K, replace=False)]
        for it in range(60):
            d = ((F[:, None, :] - C[None]) ** 2).sum(2); L = d.argmin(1)
            C = np.array([F[L == k].mean(0) if (L == k).any() else C[k] for k in range(K)])
        inert = d.min(1).sum()
        if best is None or inert < best[0]:
            best = (inert, L.copy(), C.copy())
    L = best[1]
    np.save(f'{D}/F.npy', F)
    json.dump({'meta': [c[:4] for c in cells], 'L': L.tolist()}, open(f'{D}/cl.json', 'w'))
    tiles = []
    for k in range(K):
        idx = np.where(L == k)[0]
        print(k, len(idx))
        sel = idx[rng.choice(len(idx), min(36, len(idx)), replace=False)]
        row = np.zeros((34, 34 * 36), bool)
        for j, i in enumerate(sel):
            c = cells[i][5][:30, :26]
            row[2:2 + c.shape[0], j * 34 + 2:j * 34 + 2 + c.shape[1]] = c
        tiles.append(row)
    m = ~np.vstack(tiles)
    Image.fromarray((m * 255).astype(np.uint8)).save(f'{S}/img/clusters.png')
