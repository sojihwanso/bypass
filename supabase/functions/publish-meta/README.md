# 링크 미리보기 고치기 설정 (한 번만)

HQ › **링크 미리보기**에서 저장하면 이 함수가 GitHub의 페이지 HTML에서 미리보기 태그(`og:title`, `og:description`, `og:image`, `og:image:alt`)만 바꿔 저장합니다. 카톡은 스크립트를 실행하지 않고 HTML 글자만 읽기 때문에 이렇게 합니다.

`publish-wiki`를 이미 설정했다면 GitHub 토큰은 그대로 씁니다. 새로 할 일은 아래 두 가지입니다.

## 1. 함수 올리기 — Supabase 프로젝트 주인

1. Supabase 대시보드 → **Edge Functions** → **Deploy a new function** → **Via Editor**
2. 함수 이름: `publish-meta` (정확히 이 이름)
3. 편집기 내용을 지우고 이 폴더의 `index.ts` 전체를 붙여 넣은 뒤 **Deploy**
4. 함수 설정에서 **Verify JWT / Enforce JWT verification** 끄기 (운영진 확인은 함수가 직접 함)
5. Secrets 의 `GITHUB_TOKEN` 은 `publish-wiki` 와 같은 값을 함께 씁니다. (프로젝트 전체에 한 번만 넣으면 됨)

## 2. SQL 실행

SQL Editor 에서 `supabase/014_share_images.sql` 실행 → 미리보기 그림 저장소(`share-images`)가 생깁니다.

## 모든 페이지 공통 그림

HQ › 링크 미리보기 맨 위 **모든 페이지 공통 그림**에서 그림을 바꾸면, 이 함수가 저장소의 모든 페이지(HQ 빼고) HTML 에 같은 `og:image` 를 붙여 **커밋 한 번**으로 저장합니다(배포도 한 번).
제목·설명은 페이지마다 그대로 두고, 없는 페이지만 페이지 `<title>`·`description` 으로 채웁니다.
같은 그림은 `site_settings` 의 `share` 에도 저장되고, `publish-wiki` 가 새로 올라오는 앱·위키에 이 그림을 붙입니다.

## 안전장치

- 운영진만 고칠 수 있습니다.
- 고칠 수 있는 페이지: 메인 · 커뮤니티 · 로그인 · 회원가입 · 처리 현황 · `/routes/` · `/site/`, 그리고 `/apps/` · `/tools/` · `/wiki/` · `/archive/` 아래 한 단계 폴더의 `index.html`. HQ(`/hq/`)는 빠집니다.
- 그 안에서도 미리보기 태그(`og:*`, `twitter:card`)만 바꿉니다.
- 그림 주소는 HQ에서 올린 그림(`share-images`)이나 사이트의 `/assets/` 그림만 받습니다.
