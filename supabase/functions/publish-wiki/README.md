# 위키 올리기 처음 설정 (한 번만)

공사장 H구역의 **위키 올리기** 버튼이 동작하려면 아래 세 가지를 한 번 해 두어야 합니다.
노선도 목록 관리(+ 우회로 추가, 고치기, 삭제)는 `005_routes.sql` 만 실행하면 바로 됩니다.

## 1. GitHub 토큰 만들기 — 저장소 주인(sojihwanso)이 해야 함

이 저장소에 파일을 대신 올릴 수 있는 열쇠입니다. **이 저장소의 파일 쓰기 권한만** 주므로 다른 저장소나 계정 설정에는 손대지 못합니다.

1. GitHub 오른쪽 위 프로필 사진 → **Settings**
2. 왼쪽 맨 아래 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
3. 이렇게 채웁니다.
   - Token name: `bypass-wiki`
   - Expiration: 1년 (만료되면 같은 방법으로 다시 만들어 2번 단계의 값만 바꾸면 됨)
   - Repository access: **Only select repositories** → `sojihwanso/bypass`
   - Permissions → Repository permissions → **Contents: Read and write** (나머지는 그대로)
4. **Generate token** → 나온 `github_pat_…` 값을 복사해 둡니다. 이 화면을 닫으면 다시 볼 수 없습니다.

## 2. Supabase에 함수 올리기 — Supabase 프로젝트 주인이 함

1. Supabase 대시보드 → 왼쪽 **Edge Functions** → **Deploy a new function** → **Via Editor**
2. 함수 이름: `publish-wiki` (정확히 이 이름)
3. 편집기 내용을 지우고, 이 폴더의 `index.ts` 전체를 붙여 넣은 뒤 **Deploy**
4. **Edge Functions → Secrets**(또는 Settings 안의 Secrets)에서 **Add new secret**
   - Name: `GITHUB_TOKEN`
   - Value: 1번에서 복사한 `github_pat_…`

(메뉴 이름은 Supabase 화면 개편에 따라 조금 다를 수 있습니다.)

## 3. SQL 실행

SQL Editor에서 `supabase/005_routes.sql` 전체를 붙여 넣고 **Run**.

## 확인

공사장 H구역 → **위키 올리기** → 과목 이름, 주소 이름(영문, 예: `navigation-101`), HTML 파일을 고르고 올립니다.
"위키를 올렸습니다"가 뜨면 GitHub 저장소에 `wiki/navigation-101/index.html` 이 생기고, Vercel 배포가 끝나면
`https://teambypass.vercel.app/wiki/navigation-101/` 에서 열립니다.

## 안전장치

- 운영진(`bypass_role = staff`)만 올릴 수 있습니다. 함수가 로그인 정보를 직접 확인합니다.
- `/wiki/` 아래 페이지는 `vercel.json`의 보안 설정(sandbox)으로 열려서, 위키 HTML 안에 어떤 코드가 있어도
  사이트 로그인 정보에 접근할 수 없습니다. 대신 위키 페이지 안에서는 브라우저 저장소(localStorage)를 쓸 수 없습니다.
- 주소 이름은 영문 소문자·숫자·하이픈만 받아서 `wiki/` 바깥 파일은 건드릴 수 없습니다.
