import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
// SvelteKit 전용 PWA 래퍼는 별도 패키지(@vite-pwa/sveltekit).
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

// GitHub Pages 서브경로 (예: /B_Travel/) 에서 동작하도록 base 를 svelte.config 의 paths.base 와 맞춘다.
const base = process.env.BASE_PATH ?? '';
const startUrl = `${base}/`;
const scope = `${base}/`;

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      // 매니페스트 파일 자체의 URL 도 base 하위에 위치하게 됨 (vite 가 처리).
      manifest: {
        name: 'B_Travel — 자전거 여행 기록',
        short_name: 'B_Travel',
        description:
          '현장 음성 → 본문 + 사실레이어 → 다국어 발행. 자전거 여행자의 라이딩 기록 도구.',
        theme_color: '#0b6e4f',
        background_color: '#0b1620',
        display: 'standalone',
        orientation: 'any',
        start_url: startUrl,
        scope,
        lang: 'ko',
        icons: [
          {
            src: `${base}/favicon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,webmanifest}'],
        // SPA 라우팅: 알 수 없는 경로는 클라이언트 라우터가 처리하도록 base 의 index 로 폴백.
        navigateFallback: `${base}/index.html`,
        navigateFallbackDenylist: [/^\/api\//]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    port: 5173,
    strictPort: false
  }
});
