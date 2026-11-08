# 2026-11-08 오후 요청 진행표 (사용자 요청 6가지)

1. [x] '준비 중' 팝업(soon) 삭제 — soon()·연도 '준비 중' 타일·.masc CSS 제거 (mascot.webp는 미사용)
2. [x] "(정답표 기준)" 883개 재검증(웹 검색) → 확인되면 표시 제거/해설 수정, 그래도 불확실하면 "(정답표 기준)" + "※ 확실하지 않음" 둘 다 유지
3. [x] 해설 없는 항해 이미지 문항 875개 해설 작성(웹 검색)
4. [x] 사이트 전체 오탈자·오류·코드 점검
5. 자동 재개: 19:30 초기화 후 1회만(19:33 예약). 그 뒤 제한 걸리면 중단하고 보고만.
6. [x] 모든 작업 끝나면 버전 1.0.0으로 재설정, 이후 기존 규칙 유지

## 메모
- 작업 폴더: tools/cbttest/engine/work/{recheck,deckimg}
- 2번·3번: 15:2x 에이전트 10개 시작(재검증 r00~r14 → work/recheck/rNN.json, 항해 해설 d00~d14 → work/deckexp/dNN.json). 끝난 뒤 `python3 apply_recheck.py && python3 ../scripts/exp_merge.py` 로 반영(zz_overrides.json). 중단되면 json 없는/모자란 파일만 다시 맡기기.
- 19:31 사용자 요청으로 에이전트 10개 수동 재개(이것이 1회 재개). 19:33 예약은 삭제. 다시 제한 걸리면 더 진행하지 않고 보고만.
- 19:37 다시 사용량 제한(초기화 00:30). 사용자가 "중단된 모든 작업 계속 진행" 요청 → 00:33 1회 재개 예약.
  남은 묶음: recheck r02 r04 r05 r07 r08 r10 r11 r14 / deckexp d08 d11
  사용자 지시: d00~d02·d12·d14의 불확실 5문항은 '확실'로 처리 완료(uncertain=false, 해설 재작성).
  재개 방법: 기존 에이전트에 SendMessage(재검증 r00-02 adfe2a8fd8f370990, r03-05 af617fc51d5b61040, r06-08 ab0fb679148d800cc, r09-11 a39277660aa3d00c9, r12-14 ac6eb8f5b1996e9cc, 해설 d06-08 a2e0eb5c7d1504860, d09-11 a129d94bab3808cf1)
- 19:39 사용자 추가 크레딧 구매 → 남은 묶음 에이전트 즉시 재개(00:33 예약은 대비용으로 유지, 끝나면 삭제).
- 사용자 규칙(계산 문제): 계산 결과가 정답표와 달라도 정해진 답(정답표)으로 처리하고 '확실' 취급. 해설의 공식은 조사한 그대로 쓰고, 불일치 언급은 하지 않음.
  → 진행 중 에이전트에 전달함. 이미 끝난 결과(r12~r14 등, 앞선 31문항 중 계산 문제 포함)는 반영 단계에서 계산 문항만 골라 해설을 다시 써야 함(TODO: calcfix).
- 사용자 요청: 웹 검색 없이(전문 지식·교재 기억으로) 판정된 문항 전부를 웹 검색으로 재검증. → 재검증 묶음이 모두 끝난 뒤, rNN.json의 src가 '미확인/미확보/없음/지식/교재/기억/추정/일반' 등인 문항을 모아 work/websearch/wNN.txt로 만들고, 문항마다 WebSearch 필수(검색어·근거를 src에 기록)인 에이전트로 재검증. 계산 문제 규칙 동일 적용.
- 19:4x 크레딧으로 계속: r11(a39277660aa3d00c9)·d06~d07(a2e0eb5c7d1504860) 재개, 웹검증 376문항 work/websearch/w00~w09 에이전트 5개 시작(r11 결과는 나중에 추가 검증 필요할 수 있음).
- 반영 순서: apply_recheck.py가 recheck 결과 뒤에 websearch(wNN.json) 결과를 덮어쓰도록 수정 필요(TODO).
- 11/09 00:0x 사용자 지시: NOR 문항(3d9fb9e5a6eb, 2023 1회 1급 상선·어선 영어 19) 정답을 '나'로 변경(exams.json 반영, 해설 d09.json). 백그라운드 작업 일시 중단 요청 → 00:33 예약 삭제, 실행 중 에이전트 없음. 재개는 사용자 지시 후.
  남은 것: recheck r11, websearch w00~w09(376문항, 일부 진행), 반영(apply_recheck+exp_merge), 사이트 점검, 1.0.0 배포.
- 11/09 사용자 요청으로 bypass/.claude/settings.local.json 생성(작업 폴더 밖 읽기·쓰기 차단, 예외: ~/Downloads/해기사 기출문제). 이후 임시 파일은 /private/tmp 대신 tools/cbttest/engine/work/ 아래에 쓸 것.
  남은 배치(websearch w*, recheck r11)가 참조하던 scratchpad 이미지 37개를 work/img_ref/로 복사하고 경로를 바꿔 둠.

## ⏸ 보류: 웹 검색 재검증 (사용자 요청으로 나중에 진행, 2026-11-09)
- 대상: 재검증 결과 중 출처가 '근거 미확인·교재·지식·웹 근거 없음'인 376문항 → work/websearch/w00~w09.txt (이미지 경로는 work/img_ref/로 옮겨 둠)
- 진행 방법: 각 wNN.txt를 에이전트에 맡겨 wNN.json({key:{verdict,exp,src}}) 작성 — 문항마다 WebSearch/WebFetch 필수, 국내 법령은 nepla.ai·law.go.kr 전문을 받아 조문 확인, 계산 문제는 정답표대로 '확실'(공식은 조사한 그대로)
- 반영: `python3 tools/cbttest/engine/apply_recheck.py && python3 tools/cbttest/scripts/exp_merge.py` (wNN.json이 recheck 결과보다 우선 적용) → build.sh → 버전 셋째 자리 올려 배포
- 예상 사용량: 약 75만~110만 토큰(5시간 한도 약 1회분)
- 11/09 완료: 재검증 883(확인 508·불확실 375), 항해 이미지 해설 875, 계산 문항 규칙 적용, NOR 정답 '나', 사이트 점검(중단 안내 문구 수정), v1.0.0 배포. 남은 것: 웹 검색 재검증(보류)
