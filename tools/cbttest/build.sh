#!/bin/bash
# 사이트 빌드: tools/cbttest/site/index.html(원본) -> apps/cbttest/index.html(배포본)
# 저장소 루트에서 실행: bash tools/cbttest/build.sh
set -e
cd "$(dirname "$0")/../.."
python3 tools/cbttest/scripts/mkdist.py apps/cbttest/index.html
echo "built apps/cbttest/index.html"
