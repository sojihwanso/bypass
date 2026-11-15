#!/usr/bin/env python3
"""대한민국 관공서 공휴일 1990~2100 생성기 → apps/seacal/data/holidays.json

근거
- 「관공서의 공휴일에 관한 규정」 [시행 2026.5.11, 대통령령 제36290호] 와 그 연혁(부칙)
- 「공직선거법」 제34조 (임기만료 선거일: 대통령 70일·국회 50일·지방 30일 전 이후 첫 수요일,
  선거일이나 그 전날·다음날이 공휴일이면 다음 주 수요일)
- 음력 날짜(설·추석·부처님 오신 날)는 한국 표준시(UTC+9) 기준으로 신월(합삭)과 중기를
  천문 계산(pyephem)해서 구한다. 확인용으로 korean-lunar-calendar(한국천문연구원 자료 기반,
  ~2050)와 python-holidays(KR) 값을 함께 비교한다(--check).

연혁 요약 (이 스크립트가 따르는 규칙)
- 신정: 1990~1998 1.1~1.2, 1999~ 1.1
- 국군의 날(10.1)·한글날(10.9): 1990년까지 공휴일, 한글날은 2013년부터 다시 공휴일
- 식목일(4.5): 2005년까지, 제헌절(7.17): 2007년까지, 2026.5.11부터 다시(국경일 전부 공휴일)
- 노동절(5.1): 2026.5.1부터 관공서 공휴일. 그 전 근로자의 날(5.1, 1994~)은 선원법 제71조로
  유급휴가 사용일수에서만 빠지는 날 → 종류 'l'
- 대체공휴일
  · 2013.11.5~2021.8.3: 설·추석 연휴가 일요일·다른 공휴일과 겹침, 어린이날이 토·일·다른 공휴일과 겹침
  · 2021.8.4~: 국경일(삼일절·광복절·개천절·한글날)·어린이날 토·일, 설·추석 일요일, 평일에 다른 공휴일과 겹침
  · 2023.5.4~: 부처님 오신 날·기독탄신일 추가, 2026.5.1~: 노동절 추가, 2026.5.11~: 제헌절(국경일) 추가
  · 대체공휴일은 '다음 첫 번째 비공휴일', 토요일이면 그다음 비공휴일
- 임기만료 선거일: 2006.9.6 규정 이전 선거일과 임시공휴일은 실제 지정 목록(PAST_SPECIAL)으로 넣는다.

종류 코드: p 법정 공휴일, s 대체공휴일, e 선거일, t 임시공휴일, l 선원법상 제외일(근로자의 날)
일요일은 파일에 넣지 않는다(앱이 요일로 계산).
"""
import datetime as dt
import gzip
import json
import math
import os
import sys

import ephem

D = dt.date
KST = dt.timedelta(hours=9)
Y0, Y1 = 1990, 2100

# 실제로 지정된 선거일(2006.9.6 이전)·궐위선거·임시공휴일 (1990~2026.11 확인분)
PAST_SPECIAL = {
    D(1991, 3, 26): ('e', '지방의회의원선거'), D(1991, 6, 20): ('e', '지방의회의원선거'),
    D(1992, 3, 24): ('e', '제14대 국회의원선거'), D(1992, 12, 18): ('e', '제14대 대통령선거'),
    D(1995, 6, 27): ('e', '제1회 전국동시지방선거'), D(1996, 4, 11): ('e', '제15대 국회의원선거'),
    D(1997, 12, 18): ('e', '제15대 대통령선거'), D(1998, 6, 4): ('e', '제2회 전국동시지방선거'),
    D(2000, 4, 13): ('e', '제16대 국회의원선거'), D(2002, 6, 13): ('e', '제3회 전국동시지방선거'),
    D(2002, 7, 1): ('t', '임시공휴일(월드컵 4강)'), D(2002, 12, 19): ('e', '제16대 대통령선거'),
    D(2004, 4, 15): ('e', '제17대 국회의원선거'), D(2006, 5, 31): ('e', '제4회 전국동시지방선거'),
    D(2015, 8, 14): ('t', '임시공휴일'), D(2016, 5, 6): ('t', '임시공휴일'),
    D(2017, 5, 9): ('e', '제19대 대통령선거'), D(2017, 10, 2): ('t', '임시공휴일'),
    D(2020, 8, 17): ('t', '임시공휴일'), D(2023, 10, 2): ('t', '임시공휴일'),
    D(2024, 10, 1): ('t', '임시공휴일(국군의 날)'), D(2025, 1, 27): ('t', '임시공휴일'),
    D(2025, 6, 3): ('e', '제21대 대통령선거'),
}

# 2006.9.6 이후 임기만료 선거 (실제 날짜로 확인된 것). 그 뒤는 규칙으로 계산
PAST_ELECTIONS = {
    D(2007, 12, 19): '제17대 대통령선거', D(2008, 4, 9): '제18대 국회의원선거',
    D(2010, 6, 2): '제5회 전국동시지방선거', D(2012, 4, 11): '제19대 국회의원선거',
    D(2012, 12, 19): '제18대 대통령선거', D(2014, 6, 4): '제6회 전국동시지방선거',
    D(2016, 4, 13): '제20대 국회의원선거', D(2018, 6, 13): '제7회 전국동시지방선거',
    D(2020, 4, 15): '제21대 국회의원선거', D(2022, 3, 9): '제20대 대통령선거',
    D(2022, 6, 1): '제8회 전국동시지방선거', D(2024, 4, 10): '제22대 국회의원선거',
    D(2026, 6, 3): '제9회 전국동시지방선거',
}


# ---------------- 음력 (한국 표준시) ----------------
def kst_date(e):
    return (ephem.Date(e).datetime() + KST).date()


def sun_lon(t):
    s = ephem.Sun(t)
    return math.degrees(ephem.Ecliptic(s, epoch=t).lon)


def term_time(start, target):
    """start 이후 태양 황경이 target(도)이 되는 첫 시각"""
    t = ephem.Date(start)
    step = 1.0
    def diff(x):
        return (sun_lon(x) - target + 540) % 360 - 180
    while not (diff(t) < 0 <= diff(t + step)):
        t = ephem.Date(t + step)
    lo, hi = t, t + step
    for _ in range(50):
        mid = (lo + hi) / 2
        if diff(mid) < 0:
            lo = mid
        else:
            hi = mid
    return ephem.Date(hi)


def lunar_months(y0, y1):
    """[(시작 양력일, 월, 윤달여부)] — y0-1년 11월 ~ y1+1년"""
    nm = []
    t = ephem.Date(D(y0 - 2, 10, 1))
    while True:
        t = ephem.next_new_moon(t)
        d = kst_date(t)
        nm.append((d, t))
        t = ephem.Date(t + 1)
        if d > D(y1 + 2, 3, 1):
            break
    starts = [d for d, _ in nm]
    # 중기(황경 30의 배수) 날짜
    zq = []
    t = ephem.Date(D(y0 - 2, 10, 1))
    k = int(sun_lon(t) // 30) + 1
    while True:
        tt = term_time(t, (k * 30) % 360)
        zq.append((kst_date(tt), (k * 30) % 360))
        t = ephem.Date(tt + 20)
        k += 1
        if zq[-1][0] > D(y1 + 2, 3, 1):
            break
    def has_zq(i):
        a, b = starts[i], starts[i + 1]
        return [lon for d, lon in zq if a <= d < b]
    # 동지(270)가 든 달 = 11월
    m11 = [i for i in range(len(starts) - 1) if 270 in has_zq(i)]
    out = []
    for a, b in zip(m11, m11[1:]):
        n = b - a
        leap_i = None
        if n == 13:
            for i in range(a + 1, b):
                if not has_zq(i):
                    leap_i = i
                    break
        m = 11
        for i in range(a, b):
            if i == leap_i:
                out.append((starts[i], m, True))
                continue
            if i != a:
                m = m % 12 + 1
            out.append((starts[i], m, False))
    return out, starts


def lunar_to_solar(months, starts, year_of_month1, month, day):
    # year_of_month1: 해당 음력 해의 1월이 들어 있는 양력 해
    for idx, (s, m, leap) in enumerate(months):
        if m == 1 and not leap and s.year == year_of_month1 and s.month <= 3:
            # 그 해의 1월부터 month 찾기
            for s2, m2, leap2 in months[idx:]:
                if m2 == month and not leap2:
                    return s2 + dt.timedelta(days=day - 1)
    raise ValueError((year_of_month1, month, day))


# ---------------- 선거일 계산 ----------------
def first_wed_from(d):
    return d + dt.timedelta(days=(2 - d.weekday()) % 7)


def election_date(term_end, days_before, is_holiday):
    d = first_wed_from(term_end - dt.timedelta(days=days_before))
    while is_holiday(d) or is_holiday(d - dt.timedelta(1)) or is_holiday(d + dt.timedelta(1)):
        d += dt.timedelta(days=7)
    return d


def build():
    months, starts = lunar_months(Y0, Y1)
    lunar = {}
    for y in range(Y0, Y1 + 1):
        seol = lunar_to_solar(months, starts, y, 1, 1)
        chu = lunar_to_solar(months, starts, y, 8, 15)
        bud = lunar_to_solar(months, starts, y, 4, 8)
        lunar[y] = (seol, chu, bud)

    H = {}  # date -> [(kind, name, cls)]  cls: 대체공휴일 판정용 분류

    def add(d, kind, name, cls=None):
        H.setdefault(d, []).append((kind, name, cls))

    for y in range(Y0, Y1 + 1):
        add(D(y, 1, 1), 'p', '신정', 'jan1')
        if y <= 1998:
            add(D(y, 1, 2), 'p', '신정 연휴', 'jan1')
        seol, chu, bud = lunar[y]
        for off, nm in ((-1, '설날 전날'), (0, '설날'), (1, '설날 다음 날')):
            add(seol + dt.timedelta(off), 'p', nm, 'seol')
        add(D(y, 3, 1), 'p', '삼일절', 'nat')
        if y <= 2005:
            add(D(y, 4, 5), 'p', '식목일', 'other')
        add(bud, 'p', '부처님 오신 날' if y >= 2017 else '석가탄신일', 'bud')
        if y >= 2026:
            add(D(y, 5, 1), 'p', '노동절', 'labor')
        elif y >= 1994:
            add(D(y, 5, 1), 'l', '근로자의 날', None)
        add(D(y, 5, 5), 'p', '어린이날', 'child')
        add(D(y, 6, 6), 'p', '현충일', 'memorial')
        if y <= 2007 or y >= 2026:
            add(D(y, 7, 17), 'p', '제헌절', 'nat')
        add(D(y, 8, 15), 'p', '광복절', 'nat')
        if y <= 1990:
            add(D(y, 10, 1), 'p', '국군의 날', 'other')
        add(D(y, 10, 3), 'p', '개천절', 'nat')
        if y <= 1990 or y >= 2013:
            add(D(y, 10, 9), 'p', '한글날', 'nat')
        for off, nm in ((-1, '추석 전날'), (0, '추석'), (1, '추석 다음 날')):
            add(chu + dt.timedelta(off), 'p', nm, 'chu')
        add(D(y, 12, 25), 'p', '기독탄신일', 'xmas')

    for d, (k, nm) in PAST_SPECIAL.items():
        add(d, k, nm, None)
    for d, nm in PAST_ELECTIONS.items():
        add(d, 'e', nm, None)

    def is_hol(d):  # 관공서 공휴일(일요일 포함, 'l' 제외)
        return d.weekday() == 6 or any(k != 'l' for k, _, _ in H.get(d, []))

    # 미래 임기만료 선거일 (공직선거법 제34조)
    pres_end = D(2030, 6, 3)          # 제21대 대통령 임기 2025.6.4~2030.6.3
    while pres_end.year <= Y1 + 1:
        e = election_date(pres_end, 70, is_hol)
        if Y0 <= e.year <= Y1:
            add(e, 'e', '대통령선거(예정)', None)
        pres_end = D(pres_end.year + 5, 6, 3)
    na_end = D(2028, 5, 29)           # 제22대 국회 임기 2024.5.30~2028.5.29
    while na_end.year <= Y1:
        add(election_date(na_end, 50, is_hol), 'e', '국회의원선거(예정)', None)
        na_end = D(na_end.year + 4, 5, 29)
    loc_end = D(2030, 6, 30)          # 제9회 지방선거 당선자 임기 ~2030.6.30
    while loc_end.year <= Y1:
        add(election_date(loc_end, 30, is_hol), 'e', '전국동시지방선거(예정)', None)
        loc_end = D(loc_end.year + 4, 6, 30)

    # 대체공휴일
    def rules(d):
        """d에 적용되는 규정 시기"""
        if d < D(2013, 11, 5):
            return None
        if d < D(2021, 8, 4):
            return 'r2013'
        if d < D(2023, 5, 4):
            return 'r2021'
        if d < D(2026, 5, 1):
            return 'r2023'
        return 'r2026'

    def lost_days(d):
        ents = [(k, c) for k, _, c in H.get(d, []) if k == 'p' and c]
        r = rules(d)
        if not r or not ents:
            return 0
        wd = d.weekday()
        cls = [c for _, c in ents]
        if r == 'r2013':
            wk_ok = {'child'}           # 토·일
            sun_ok = {'seol', 'chu'}    # 일요일
            ov_ok = {'seol', 'chu', 'child'}
        else:
            wk_ok = {'nat', 'child'}
            if r in ('r2023', 'r2026'):
                wk_ok |= {'bud', 'xmas'}
            if r == 'r2026':
                wk_ok |= {'labor'}
            sun_ok = {'seol', 'chu'}
            ov_ok = wk_ok | sun_ok
        if wd == 5:
            return sum(1 for c in cls if c in wk_ok)
        if wd == 6:
            return sum(1 for c in cls if c in wk_ok or c in sun_ok)
        if len(cls) >= 2 and any(c in ov_ok for c in cls):
            return len(cls) - 1
        return 0

    subs = []
    for d in sorted(list(H)):
        n = lost_days(d)
        for _ in range(n):
            subs.append(d)
    for d in subs:
        x = d + dt.timedelta(1)
        while is_hol(x) or x.weekday() == 5:
            x += dt.timedelta(1)
        add(x, 's', '대체공휴일', None)

    # 출력: 연도별 "MMDD:k:이름" 목록 (일요일인 'p'만 있는 날도 이름 표시용으로 남김)
    out = {}
    for d in sorted(H):
        if not (Y0 <= d.year <= Y1):
            continue
        seen = []
        for k, nm, _ in H[d]:
            if (k, nm) not in seen:
                seen.append((k, nm))
        for k, nm in seen:
            out.setdefault(str(d.year), []).append(f"{d.month:02d}{d.day:02d}{k}{nm}")
    return out, lunar


def main():
    out, lunar = build()
    doc = {
        'v': 1,
        'range': [Y0, Y1],
        'built': dt.date.today().isoformat(),
        'basis': '관공서의 공휴일에 관한 규정[시행 2026.5.11]·공직선거법 제34조. 미래 선거일·음력은 계산값, 임시공휴일은 2026.11 확인분까지',
        'kinds': {'p': '공휴일', 's': '대체공휴일', 'e': '선거일', 't': '임시공휴일', 'l': '근로자의 날(선원법 제71조)'},
        'd': out,
    }
    root = os.path.dirname(os.path.abspath(__file__))
    dst = os.path.join(root, '..', '..', 'apps', 'seacal', 'data', 'holidays.json')
    raw = json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(raw)
    b = raw.encode('utf-8')
    n = sum(len(v) for v in out.values())
    print(f'항목 {n}개, {len(b):,} bytes, gzip {len(gzip.compress(b, 9)):,} bytes → {os.path.normpath(dst)}')
    if '--check' in sys.argv:
        check(out, lunar)


def check(out, lunar):
    import holidays
    from korean_lunar_calendar import KoreanLunarCalendar
    bad = 0
    for y in range(Y0, Y1 + 1):
        seol, chu, bud = lunar[y]
        if y <= 2050:
            c = KoreanLunarCalendar()
            for (m, dd), mine in (((1, 1), seol), ((8, 15), chu), ((4, 8), bud)):
                c.setLunarDate(y, m, dd, False)
                ref = D.fromisoformat(c.SolarIsoFormat())
                if ref != mine:
                    bad += 1
                    print('KASI 불일치', y, m, dd, mine, ref)
        hk = holidays.KR(years=y)
        ref = {
            'seol': hk.get_named('설날', lookup='exact'),
            'chu': hk.get_named('추석', lookup='exact'),
        }
        for k, mine in (('seol', seol), ('chu', chu)):
            if ref[k] and ref[k][0] != mine:
                print('holidays 불일치', y, k, mine, ref[k][0])
    # 1990~2026 전체 비교 (일요일·근로자의 날 제외)
    for y in range(Y0, 2027):
        mine = {D(y, int(s[:2]), int(s[2:4])) for s in out.get(str(y), []) if s[4] != 'l'}
        mine = {d for d in mine if d.weekday() != 6 or any(s.startswith(f'{d.month:02d}{d.day:02d}s') for s in out[str(y)])}
        ref = {d for d in holidays.KR(years=y) if d.weekday() != 6}
        mine_nosun = {d for d in mine if d.weekday() != 6}
        if mine_nosun != ref:
            print(y, '내 것만:', sorted(mine_nosun - ref), '라이브러리만:', sorted(ref - mine_nosun))
    print('KASI 음력 불일치', bad)


if __name__ == '__main__':
    main()
