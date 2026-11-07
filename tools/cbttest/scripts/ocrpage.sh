#!/bin/bash
# usage: ocrpage.sh pdf page outdir
pdf=$1; p=$2; out=$3; b=$(basename $pdf .pdf)-$(printf %02d $p)
[ -f $out/$b.R.tsv ] && exit 0
pdftoppm -r 250 -gray -png -f $p -l $p -singlefile $pdf $out/$b
python3 -I "$(dirname "$0")/split.py $out/$b.png
for h in L R; do tesseract $out/$b.$h.png $out/$b.$h -l kor+eng --psm 4 txt tsv >/dev/null 2>&1; done
