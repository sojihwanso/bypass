"""이스터에그 그림: 후드티(크림색)와 주황 다리 경계에 진한 외곽선 추가.
4배로 키운 뒤 경계를 찾고 다시 줄여서(초과 표본) 선을 매끄럽게 만든다."""
import numpy as np
from PIL import Image, ImageFilter
S = 4
src = Image.open('egg-orig.webp').convert('RGB')
big = src.resize((src.width * S, src.height * S), Image.BICUBIC)
a = np.asarray(big).astype(int); R, G, B = a[..., 0], a[..., 1], a[..., 2]
cream = (R > 228) & (G > 212) & (B > 185) & (R - B < 60)
orange = (R > 200) & (G > 80) & (G < 175) & (B < 110)
roi = np.zeros_like(cream); roi[400*S:505*S, 104*S:345*S] = True
img = lambda m: Image.fromarray((m * 255).astype('uint8'))
sm = lambda m, r: np.asarray(img(m).filter(ImageFilter.GaussianBlur(r))).astype(float) / 255
# 매끄러운 마스크로 경계 위치(두 마스크가 반반인 곳)를 잡음
c, o = sm(cream, 3), sm(orange, 3)
dist = np.abs(c - o)                          # 경계에서 0
near = (c > 0.08) & (o > 0.08) & roi
line = np.asarray(img(near & (dist < 0.6)).filter(ImageFilter.MaxFilter(7))) > 0
alpha_big = sm(line, 2.2)
alpha_big = np.clip((alpha_big - 0.25) / 0.35, 0, 1)
alpha = np.asarray(Image.fromarray((alpha_big * 255).astype('uint8')).resize(src.size, Image.LANCZOS)).astype(float)[..., None] / 255
base = np.asarray(src).astype(float); ink = np.array([36, 16, 8])
out = (base * (1 - alpha) + ink * alpha).astype('uint8')
Image.fromarray(out).save('egg-new.png'); Image.fromarray(out).save('egg-new.webp', 'WEBP', quality=90, method=6)
