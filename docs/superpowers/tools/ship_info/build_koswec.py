"""KOSWEC 업체·선박 PDF → koswec.json
python3 -I build_koswec.py <KOSWEC_업체_선박정보.pdf> <out.json>
"""
import json, logging, re, sys
from collections import Counter
import pdfplumber

logging.disable(logging.WARNING)
BIZ = ['외항상선', '해외취업상선', '내항상선', '원양어선', '해외취업어선', '연근해어선']
FISH = {'원양어선', '연근해어선', '해외취업어선'}
HDR = re.compile(r'^(.+?) (\d[\d,]*)척$')
ROW = re.compile(r'^(\d+) (.+) (\d[\d,.]*T|-) (' + '|'.join(BIZ) + r') (.+)$')
SEC = re.compile(r'^■ (' + '|'.join(BIZ) + r') \((\d+)곳\)$')
# 선사록 CO 이름 ← KOSWEC 이름('(주)' 뗀 것)
APP_NAME = {
    '에이치엠엠': 'HMM', '에이치엠엠오션서비스': 'HMM오션서비스', '에스엠상선': 'SM상선',
    '케이엘씨에스엠': 'KLCSM', '케이엘엔지': 'K-LNG', '현대엘엔지해운': '현대LNG해운',
    '케이에스에스해운': 'KSS해운', '에스티엑스오션서비스': 'STX오션서비스', '케이엠씨해운': 'KMC해운',
}
SAME = ('범진상운 남성해운 동영해운 동진상선 천경해운 범주해운 포스에스엠 대한해운 대한해운엘엔지 대한상선 '
        '에이치라인해운 폴라리스쉬핑 지마린서비스 윌헴슨쉽매니지먼트코리아 아이엠에스코리아 싱크로해운 삼주에스엠 '
        '디엘에스엠 동진상운 정양해운 오션제이드쉬핑 코리아쉽메니져스 상지해운 수성해운 인터렉스메가라인 '
        '국제해양기술 코린스타 동지해운 훼어선박 고려에스엠').split()
APP_NAME.update({n: n for n in SAME})
RENAME = {'태양해운(양희정)': '태양해운'}


def norm(s):
    return re.sub(r'\(주\)|㈜|주식회사|\s', '', s)


def clean(v):
    v = v.strip()
    return None if v in ('', '-', '--') else v


def parse(pdf):
    p = pdfplumber.open(pdf)
    firms, cur, biz, on = [], None, None, False
    countries, types = set(), set()
    raw_rows = []
    for pg in p.pages:
        lines = (pg.extract_text() or '').split('\n')
        if not on:
            if '업체별 선박 상세' not in lines:
                continue
            on = True
        for t in pg.extract_tables():
            for r in t:
                if len(r) == 7 and r[0] and r[0].isdigit():
                    types.add(r[4]); countries.add(r[5]); countries.add(r[6])
        for ln in lines:
            m = SEC.match(ln)
            if m:
                biz = m.group(1); continue
            if ln.startswith('# 선박명') or ln == '업체별 선박 상세':
                continue
            r = ROW.match(ln)
            if r and cur is not None and len(cur['ships']) < cur['cnt']:
                cur['ships'].append([r.group(2), r.group(3), r.group(4), r.group(5)]); continue
            h = HDR.match(ln)
            if h:
                cur = {'n': h.group(1), 'cnt': int(h.group(2).replace(',', '')), 'b': biz, 'info': '', 'ships': []}
                firms.append(cur); continue
            if cur is not None and not cur['ships']:
                cur['info'] = (cur['info'] + ' ' + ln).strip(); continue
            raise SystemExit('알 수 없는 줄: ' + ln)
    return firms, countries, types


def split_tail(tail, types, countries):
    for t in sorted(types, key=len, reverse=True):
        if tail.startswith(t + ' '):
            rest = tail[len(t) + 1:]
            for c in sorted(countries, key=len, reverse=True):
                if rest.startswith(c + ' ') and rest[len(c) + 1:] in countries:
                    return t, c, rest[len(c) + 1:]
            if rest.count(' ') == 1:
                return (t, *rest.split(' '))
            for c in sorted(countries, key=len, reverse=True):
                if rest.endswith(' ' + c):
                    return t, rest[:-len(c) - 1], c
                if rest.startswith(c + ' '):
                    return t, c, rest[len(c) + 1:]
    raise SystemExit('선박 꼬리를 나눌 수 없음: ' + tail)


def phone(v):
    """원본 표기 정리: 앞뒤 '-' 제거, 하이픈 없는 8자리 대표번호(15xx·16xx·18xx)는 XXXX-XXXX"""
    if v is None:
        return None
    v = v.strip('-')
    if re.fullmatch(r'1[568]\d{6}', v):
        v = v[:4] + '-' + v[4:]
    return v


def info_fields(info):
    tel = fax = addr = None
    parts = [x.strip() for x in info.split(' · ')]
    rest = []
    for x in parts:
        if x.startswith('대표'):
            continue
        if x.startswith('전화 '):
            tel = clean(x[3:])
        elif x.startswith('팩스 '):
            fax = clean(x[3:])
        else:
            rest.append(x)
    if rest:
        addr = clean(' · '.join(rest))
    tel, fax = phone(tel), phone(fax)
    mob = re.compile(r'^01[016789]')
    tel = None if tel and mob.match(tel) else tel
    fax = None if fax and mob.match(fax) else fax
    return tel, fax, addr


def main(pdf, out):
    firms, countries, types = parse(pdf)
    bad = [(f['n'], f['cnt'], len(f['ships'])) for f in firms if f['cnt'] != len(f['ships'])]
    detail = (len(firms), sum(len(f['ships']) for f in firms))
    # 지역 묶음 제외
    firms = [f for f in firms if not f['n'].startswith(('개인선주(', '연근해어선('))]
    # 같은 이름 병합
    merged = {}
    for f in firms:
        n = RENAME.get(f['n'], f['n'])
        if n in merged:
            g = merged[n]
            if len(f['ships']) > len(g['ships']):
                g['b'] = f['b']
            g['ships'] += f['ships']
            if not g['info'].count('전화 0') and f['info'].count('전화 0'):
                g['info'] = f['info']
        else:
            merged[n] = dict(f, n=n, ships=list(f['ships']))
    firms = [f for f in merged.values() if len(f['ships']) >= 3]
    firms = [f for f in firms if not all(s[2] in FISH for s in f['ships'])]
    for f in firms:
        for s in f['ships']:
            for ty in types:
                if s[3].startswith(ty + ' ') and s[3][len(ty) + 1:].count(' ') == 1:
                    countries.update(s[3][len(ty) + 1:].split(' '))
    ships_all = [(s, *split_tail(s[3], types, countries)) for f in firms for s in f['ships']]
    tcount = Counter(t for _, t, _, _ in ships_all)
    type_names = [t for t, _ in tcount.most_common()]
    res = []
    for f in firms:
        tel, fax, addr = info_fields(f['info'])
        ships = []
        for s in f['ships']:
            t, flag, owner = split_tail(s[3], types, countries)
            gt = None if s[1] == '-' else float(s[1][:-1].replace(',', ''))
            if gt is not None and gt.is_integer():
                gt = int(gt)
            ships.append([s[0], gt, BIZ.index(s[2]), type_names.index(t), flag, owner])
        res.append({'id': norm(f['n']), 'n': f['n'], 'b': BIZ.index(f['b']), 'tel': tel, 'fax': fax,
                    'addr': addr, 'app': APP_NAME.get(norm(f['n'])), 'ships': ships})
    res.sort(key=lambda f: (-len(f['ships']), f['n']))
    data = {'source': {'site': 'koswec.or.kr 정보마당 › 업체조회', 'collected': '2026-11-26',
                       'totals': {'summaryFirms': 907, 'summaryShips': 6753,
                                  'detailFirms': detail[0], 'detailShips': detail[1]}},
            'bizNames': BIZ, 'typeNames': type_names, 'firms': res}
    json.dump(data, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('detail', detail, 'count mismatch', bad)
    print('firms', len(res), 'ships', sum(len(f['ships']) for f in res), 'app', sum(1 for f in res if f['app']))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
