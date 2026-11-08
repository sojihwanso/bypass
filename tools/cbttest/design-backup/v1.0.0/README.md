# 디자인 백업 — cbttest v1.0.0 (2026-11-09)

디자인 변경 전 상태를 그대로 보관한 폴더입니다.

- `index.html`: 사이트 원본 전체(스타일·스크립트 포함). 그대로 `tools/cbttest/site/index.html`에 덮어쓰면 v1.0.0 디자인으로 돌아갑니다.
- `style.css`: index.html 안의 CSS만 뽑은 것(색상 토큰 93개, 라이트/다크 테마 포함).
- `icons/`: 코드 안에 들어 있던 SVG 아이콘 7개.
- `mascot.webp`: 마스코트 이미지.
- 글꼴: <link rel="preconnect" href="https://fonts.googleapis.com">, <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>, <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Nanum+Gothic:wght@700;800&display=swap">
- git 태그 `cbttest-v1.0.0`으로도 이 시점 전체를 되돌릴 수 있습니다: `git checkout cbttest-v1.0.0 -- tools/cbttest/site apps/cbttest/index.html`
- `screenshot-home-pc.webp`: 사용자가 보낸 v1.0.0 처음 화면(PC) 스크린샷.
