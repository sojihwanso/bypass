import sys
S=__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
out=sys.argv[1]
body=open(S+'/site/index.html').read()
i=body.index('</style>')+len('</style>')
head,rest=body[:i],body[i:]
old='<meta name="description" content="한국해양수산연수원 공개 해기사 시험 기출문제(항해·기관 필기)를 회차·과목별로 풀어보는 교육용 사이트">'
head=head.replace(old, old+'''
<link rel="canonical" href="https://teambypass.vercel.app/apps/cbttest/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://teambypass.vercel.app/apps/cbttest/">
<meta property="og:title" content="해기사 시험 문제 풀이">
<meta property="og:description" content="해기사 항해·기관 필기 기출(2018·2020~2025) · 바로 채점, 과목·회차 모의고사, 전 회차 무작위 풀이">
<meta property="og:site_name" content="BYPASS">
<meta property="og:locale" content="ko_KR">
<meta property="og:image" content="https://itzdjdgjqcpmxdfssfel.supabase.co/storage/v1/object/public/share-images/home-1794878136557.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="누구나 무엇이든. BYPASS">''')
doc='<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'+head+'\n<meta name="twitter:card" content="summary_large_image">\n</head>\n<body>\n'+rest+'\n</body>\n</html>\n'
# 다른 작업(사이트 공통 도구)이 배포본에 직접 넣는 것은 그대로 이어받습니다:
#  - 링크 미리보기 그림(og:image…) 줄: 배포본에 있으면 그 값을 씀
#  - 맨 아래 'BYPASS 커뮤니티로' 버튼(<!-- bp-home … </button>)
import os, re
if os.path.exists(out):
    old = open(out).read()
    og_old = re.findall(r'<meta property="og:image[^>]*>', old)
    if og_old:
        doc = re.sub(r'(?:<meta property="og:image[^>]*>\n?)+', '\n'.join(og_old) + '\n', doc, count=1)
    m = re.search(r'\n?<!-- bp-home.*?</button>\n', old, re.S)
    if m and '<!-- bp-home' not in doc:
        doc = doc.replace('\n</body>', m.group(0).rstrip('\n') + '\n</body>', 1)
open(out,'w').write(doc)
