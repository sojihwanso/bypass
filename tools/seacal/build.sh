#!/usr/bin/env bash
# 원본(tools/seacal/site/index.html) → 배포본(apps/seacal/index.html)
# 파비콘은 해기사 시험 문제 풀이(cbttest)와 같은 Team Bypass 로고를 그대로 씁니다.
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC=tools/seacal/site/index.html
DST=apps/seacal/index.html
mkdir -p apps/seacal/data
python3 - "$SRC" "$DST" tools/cbttest/site/index.html <<'EOF'
import sys, re
src, dst, cbt = sys.argv[1:4]
html = open(src, encoding='utf-8').read()
icons = [l for l in open(cbt, encoding='utf-8').read().splitlines() if l.startswith('<link rel="icon"') or l.startswith('<link rel="apple-touch-icon"')]
html = html.replace('<!--FAVICON-->', '\n'.join(icons), 1)
open(dst, 'w', encoding='utf-8').write(html)
print('배포본:', dst, len(html.encode()), 'bytes')
EOF
if [ ! -f apps/seacal/data/holidays.json ]; then
  echo "주의: apps/seacal/data/holidays.json 이 없습니다. python3 tools/seacal/build_holidays.py 로 만드세요 (pip install ephem)."
fi
