/* 공부노트 Service Worker v2.0.2 — 오프라인 열람·복습 및 외부 라이브러리 캐시 */
const CACHE_NAME = 'studynote-shell-v2.1.0';
const LIB_CACHE = 'studynote-libs-v2.0.0';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* 버전 고정 외부 라이브러리 및 웹폰트 (오프라인 캐시) */
const PINNED_LIBS = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map((url) => shell.add(url)));
    const libs = await caches.open(LIB_CACHE);
    await Promise.allSettled(
      PINNED_LIBS.map((url) =>
        fetch(url, { mode: 'cors' })
          .then((res) => { if (res.ok) return libs.put(url, res); })
          .catch(() => {})
      )
    );
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== CACHE_NAME && k !== LIB_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // AI API 호출 및 Supabase API 요청은 캐시하지 않음
  if (
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.hostname.includes('openrouter.ai') ||
    url.hostname.includes('api.openai.com') ||
    url.hostname.includes('api.anthropic.com') ||
    url.hostname.includes('supabase.co')
  ) {
    return;
  }

  // 고정 CDN 라이브러리 및 폰트: 캐시 우선
  if (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith((async () => {
      const cache = await caches.open(LIB_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return new Response('', { status: 503 });
      }
    })());
    return;
  }

  // 앱 셸: 네트워크 우선 후 오프라인 시 캐시 반환
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        // 브라우저 HTTP 캐시에 남은 옛 index.html을 쓰지 않도록 서버에 항상 다시 확인
        const fresh = await fetch(req, { cache: 'no-cache' });
        if (fresh.ok) {
          const shell = await caches.open(CACHE_NAME);
          shell.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        return caches.match('./index.html');
      }
    })());
  }
});
