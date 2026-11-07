# cbttest 작업 원본 (해기사 시험 문제 풀이)

`apps/cbttest/`는 배포본이고, 이 폴더가 그 원본과 작업 도구입니다.
Claude Code(클라우드·터미널) 어느 세션에서든 이 폴더를 기준으로 이어서 작업하면 됩니다.

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `site/index.html` | 사이트 원본 (스타일·스크립트 포함 한 파일). **수정은 여기서** |
| `site/mascot.webp` | 마스코트 이미지 (배포본과 동일) |
| `build.sh` | 원본 → `apps/cbttest/index.html` 배포본 생성 |
| `scripts/mkdist.py` | 원본에 문서 머리말(meta, OG 태그)을 붙여 배포본을 만드는 스크립트 |
| `scripts/` 기타 | 필기 데이터 구축(문제지 파싱·OCR·정답·해설 병합) 때 쓴 스크립트. 원본 PDF·스캔 이미지가 있어야 다시 돌릴 수 있음 |
| `exp/out/*.json` | 필기 AI 해설 원본(회차별). `scripts/exp_merge.py`로 `apps/cbttest/data/exp.json`에 합침 |
| `iv/parsed3.json` | 면접 기출문제집 PDF에서 뽑은 문항·답변 원문 |
| `iv/build_iv.py` | `parsed3.json` → `iv/interview_auto.json` (문항 구조화 + 자동 키워드) |
| `iv/kw/*.txt` | 수작업으로 정리한 면접 채점 키워드·유의어 (과목별) |
| `iv/txt2kw.py` → `iv/apply.py` | 키워드 txt → json → `apps/cbttest/data/interview.json`에 반영 |
| `iv/gradecheck.py` | 모범답안이 모두 통과하는지, 엉뚱한 답이 통과하지 않는지 검사 |
| `iv/dump.py` | 과목별 문항·답변 목록 출력 (예: `python3 iv/dump.py N2_law`) |

## 자주 하는 작업

```bash
# 저장소 루트에서
bash tools/cbttest/build.sh            # 사이트 수정 후 배포본 생성 → 커밋·푸시하면 Vercel 배포

# 면접 키워드 수정 후
python3 tools/cbttest/iv/txt2kw.py
python3 tools/cbttest/iv/apply.py
python3 tools/cbttest/iv/gradecheck.py
```

## 키워드 파일 형식 (`iv/kw/*.txt`)

```
@문항ID          예: @N2_law_03
키워드 ; 키워드    한 줄 = 모범답안 항목 하나, `;` = 항목 안의 핵심 키워드
--               소문항 (1)/(2) 구분
```
`|`로 비슷한 말을 나열합니다 (예: `나란히|병렬|병진`). 띄어쓰기·대소문자는 채점 때 무시됩니다.
항목은 키워드의 절반 이상이 들어가면 충족, 소문항은 항목의 60% 이상(‘N가지 이상’이면 N개)을 충족해야 통과입니다.

## 버전 규칙

`site/index.html`의 `VERSION` 상수와 `.ver` 표시 두 곳(`v. x.y.z`)을 함께 바꿉니다.
- 첫째 자리: 큰 콘텐츠 추가 (예: 기관 필기 추가)
- 둘째 자리: 하위 항목 콘텐츠 추가·변경
- 셋째 자리: 오타·버그 수정

## 데이터 출처

한국해양수산연수원 공개 해기사 시험 문제지·정답표(2018, 2020~2025), 「해기사 면접시험 기출문제집」(2023. 3.).
저작권은 한국해양수산연수원에 있으며, 교육 목적으로만 사용합니다.
