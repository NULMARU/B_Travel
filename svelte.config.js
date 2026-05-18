import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages 서브경로 배포 대응.
//   - GitHub Actions 가 BASE_PATH=/B_Travel 로 빌드 → kit.paths.base 가 그 값을 따른다.
//   - 로컬 dev 에서는 BASE_PATH 가 비어있어 / 에서 동작.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // GitHub Pages 는 SPA fallback 으로 404.html 을 쓴다.
      // (알 수 없는 라우트로 직접 접근하면 404.html 이 서빙되고, 그 안의 클라이언트 라우터가 정상 처리.)
      fallback: '404.html',
      precompress: false,
      strict: false
    }),
    paths: {
      base,
      relative: false
    },
    alias: {
      $lib: 'src/lib'
    },
    prerender: {
      handleHttpError: 'warn'
    }
  }
};

export default config;
