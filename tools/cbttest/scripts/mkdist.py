import sys
S=__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
out=sys.argv[1]
body=open(S+'/site/index.html').read()
i=body.index('</style>')+len('</style>')
head,rest=body[:i],body[i:]
old='<meta name="description" content="한국해양수산연수원 공개 해기사 시험 기출문제(항해 필기)를 회차·과목별로 풀어보는 교육용 사이트">'
head=head.replace(old, old+'''
<link rel="canonical" href="https://teambypass.vercel.app/apps/cbttest/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://teambypass.vercel.app/apps/cbttest/">
<meta property="og:title" content="해기사 시험 문제 풀이">
<meta property="og:description" content="해기사 항해 필기 기출(2018·2020~2025) · 바로 채점, 과목·회차 모의고사, 전 회차 무작위 풀이">''')
doc='<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'+head+'\n</head>\n<body>\n'+rest+'\n</body>\n</html>\n'
open(out,'w').write(doc)
