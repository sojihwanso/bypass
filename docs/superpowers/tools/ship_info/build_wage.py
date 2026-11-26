"""2026 한국선원통계연보 임금현황(PDF 72쪽) → wage.json
python3 -I build_wage.py <임금현황.pdf> <out.json>
"""
import json, logging, re, sys
import pdfplumber

logging.disable(logging.WARNING)
N = r'([\d,]+|-)'
SIX = re.compile(r'^(.*?)\s*' + r'\s+'.join([N] * 6) + r'$')
VES = re.compile(r'\(([\d,]+)척\)')
TITLE = re.compile(r'^\((\d+)\)\s*(.+?)\s*\(')
RANKS = [('total', '합계'), ('off', '해기사 계'), ('master', '선장'), ('co', '1항사'), ('o2', '2항사'),
         ('o3', '3항사'), ('ce', '기관장'), ('e1', '1기사'), ('e2', '2기사'), ('e3', '3기사'),
         ('ro', '통신장'), ('rat', '부원 계'), ('bsn', '갑판장'), ('abs', '갑판수'), ('os', '갑판원'),
         ('olr', '조기장'), ('oiler', '조기수'), ('wiper', '조기원'), ('ccook', '조리장'),
         ('cook', '조리수'), ('boy', '조리원')]
# (bizKey, 이름, 직책별 쪽, 선종 쪽 범위)
BIZ = [('ocean', '외항선', 4, range(5, 16)), ('coastal', '내항선', 17, range(18, 30)),
       ('deepsea', '원양어선', 31, range(32, 37)), ('nearsea', '연근해어선', 41, range(42, 53)),
       ('fmerchant', '해외취업상선', 54, range(55, 66)), ('ffish', '해외취업어선', 67, range(68, 72))]
NOTE65 = '승선원 전원 외국인선원으로 임금자료 없음'


def num(v):
    return None if v == '-' else int(v.replace(',', ''))


def table(lines, page):
    rows = []
    for l in lines:
        m = SIX.match(l.strip())
        if m and m.group(1):
            rows.append([num(x) for x in m.groups()[1:]])
    if len(rows) != 21:
        raise SystemExit(f'{page}쪽: 직책 행 {len(rows)}개(21개여야 함)')
    return rows


def vessels(lines, page):
    for l in lines:
        m = VES.search(l)
        if m:
            return int(m.group(1).replace(',', ''))
    raise SystemExit(f'{page}쪽: 척수 없음')


def type_name(lines, page):
    for l in lines:
        m = TITLE.match(l)
        if m:
            n = re.sub(r'\s', '', m.group(2)).replace('유․도선', '유·도선')
            return '예선(이접안용)' if n == '예선' and '이접안' in l.replace(' ', '') else n
    raise SystemExit(f'{page}쪽: 선종 제목 없음')


def main(pdf, out):
    p = pdfplumber.open(pdf)
    L = lambda n: (p.pages[n - 1].extract_text() or '').split('\n')
    data = {'source': {'title': '2026년 한국선원통계연보 3. 임금현황', 'pages': '227~297쪽', 'unit': '천원',
                       'note': '월평균 임금은 업종별 총승선원의 평균값'},
            'ranks': [list(r) for r in RANKS],
            'overall': {'vessels': vessels(L(1), 1), 'rows': table(L(2), 2)}, 'biz': {}}
    for key, name, rp, tps in BIZ:
        lines = L(rp)
        b = {'name': name, 'vessels': vessels(lines, rp), 'rows': table(lines, rp), 'types': {}}
        for tp in tps:
            lines = L(tp)
            t = {'vessels': vessels(lines, tp), 'rows': table(lines, tp)}
            if any(l.startswith('주)') and '외국인선원' in l for l in lines):
                t['note'] = NOTE65
            n = type_name(lines, tp)
            if n in b['types']:
                raise SystemExit(f'{tp}쪽: 선종 {n} 중복')
            b['types'][n] = t
        data['biz'][key] = b
        print(key, b['vessels'], list(b['types']))
    json.dump(data, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
