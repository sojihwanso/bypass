# 기관 필기 추가 작업 진행표

사용자 요청(2026-11-08): 기관 필기(기관사 1~4급) 항목 추가. 항해 필기와 같은 레이아웃·형식, 해설은 인터넷 검색으로 구성.
5시간 사용량 제한에 걸리면 다음 초기화 뒤 이 파일을 읽고 이어서 진행.

원본: /Users/turo/Downloads/해기사 기출문제/{2018,2020..2025}/기/*.pdf|zip, 정답: */항/*answer*.pdf, 2018/2018_answer.pdf
작업 폴더: tools/cbttest/engine/ (스크립트·중간 산출물), 임시: scratchpad

## 단계
- [x] 1. 정답표 파싱 (ans_engine.py → answers_engine.json, 2020~2025 460과목)
- [x] 2. 2020~2025 문제 추출(parse_engine.py, 11,500문항) → build_engine.py로 bank/exams 합침(p:'e', 고유 8,362문항, 스프라이트 E*.webp)
  - parse 산출물 폴더(CBT_BUILD)는 scratchpad/eng — 세션이 바뀌면 parse_engine.py 재실행 필요(약 15분)
- [x] 3. 사이트 UI: 기관 계열·직종·연도·회차·과목·모드·무작위·채점 기준·문구·출처·도움말 반영, 브라우저 점검 완료 (2018 기관 연도 타일은 "준비 중")
- [x] 4. 해설: 8,362개 완료(exp/out/engine_2020_2025.json). 원래 계획: 기관 고유 8,362문항(항해와 겹치는 문항 0) → work/batches/e000~e104.txt(80문항씩) → work/out/eNNN.json
  - 진행 방법: work/out 에 없는(또는 키가 모자란) 배치만 골라 서브에이전트(5배치씩) 실행. 프롬프트는 이 파일 아래 '해설 프롬프트' 참고
  - 1차(2026-11-08 01:2x): e000~e034 → 34개 완료(e019만 남음, 사용량 제한)
  - 2차: e019, e035~e068 완료
  - 3차(2026-11-08 05:0x): e069~e104 에이전트 7개 시작
- [x] 5. v1.0.0 배포 완료(2026-11-08 09:5x, 커밋 d3f1d4f) — 2020~2025 기관
- [x] 6. 2018 기관 (v1.1.0 배포) — → 끝나면 v1.1.0. 정답 80줄 완료(answers18e.json, 눈 판독+OCR 대조). 남은 것: seg18e.py 문항 분할 수정(OCR은 scratchpad/e18/ocr/q.json, 쪽 이미지 scratchpad/e18/pages), 해설, 빌드(build_engine에 2018 포함)(스캔 4개 PDF + 2018_answer.pdf 이미지 정답표) — 항해 2급 40문항 정답도 이 정답표로 복구 가능

## 메모
- 버전: 완료 시 1.0.0 (사용자 지정). 이후 기존 규칙(첫째=큰 콘텐츠, 둘째=하위 콘텐츠, 셋째=수정) 유지.

## 해설 프롬프트 (서브에이전트용, 배치 번호만 바꿔서 사용)
You write short Korean study explanations (해설) for Korean marine engineer (해기사 기관사 1~4급) written exam questions.
W=/Users/turo/Downloads/Claude/bypass/tools/cbttest/engine/work
Your batches: $W/batches/eNNN.txt ... (5개)
For each batch, skip if $W/out/eNNN.json already has every key; otherwise write it (JSON {key: 해설}) right after finishing that batch.
Item: `#<key> [...] ★정답: <letter>` + 문제/보기(가 나 사 아). ★정답 = 공식 정답 — 그쪽으로 설명. 이미지/그림 문항은 표시된 파일을 Read로 열어 확인.
WebSearch(standard)로 불확실한 사실 확인. 1~2문장 30~90자 합니다체, 보기 글자 대신 내용으로, 옳지 않은 것 문항은 틀린 점과 바른 사실, 계산은 공식·결과, 영어는 한국어로, 키가 의심되면 "(정답표 기준)", 그림 의존 "(그림 문제)", 마크다운·URL 금지. 끝나면 파일별 개수와 의심 키 목록만 보고.
- 2018 항해 2급: 정답표 원본(2018_answer.pdf) 대조 결과, 문제 이미지의 회차 표시가 한 칸씩 밀려 있었음(이미지 1→실제 4회, 2→1, 3→2, 4→3). exams.json 회차를 바로잡고 1회 항해 1~15번(정답표 원본 정답) 복구, 해설 15개 작성. '4회 어선전문'으로 있던 25문항은 정답표 어느 회차와도 맞지 않아 계속 제외.
- 기관사 직종 화면: 사용자가 준 [별표 3] PDF(engine 폴더에 사본) 2. 기관부 승무기준으로 GRADE_E 작성 완료.
- 2018 기관: seg18e.py 재작성(번호 되돌아감=과목 전환 추정, 경계 확실한 문항만) → 1,758/2,000문항, 표본 5개 정답표 대조 일치. build_engine이 qs18e.json·answers18e.json 포함. 해설: 재사용 541(exp/out/engine_2018_reuse.json) + work/batches18/f00~f15(1,217문항) 에이전트 4개(2026-11-08 10:2x). 사이트: DATA_YEARS_E에 2018, 수록범위·문구 반영. 끝나면 out18 → exp/out/engine_2018_written.json, exp_merge, v1.1.0 배포.
- 2026-11-08 14:5x: 2018 기관 1,758문항·해설 1,758개(재사용 541 + 신규 1,217) 반영, 단 하단 보기 잘림 수정(seg18e 쪽 하단 기준 0.995). 해설은 exp/out/engine_2018.json(문항 위치로 새 키에 옮김). 모든 단계 완료.
