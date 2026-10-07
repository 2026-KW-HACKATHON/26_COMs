import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 홈 화면에 설치하는 앱(PWA). 서비스 워커는 npm run build 결과물에서만 동작한다.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '기억캡슐',
        short_name: '기억캡슐',
        description: '월계1동 가게에 5초 영상으로 추억을 남기는 지도 기반 기록 서비스',
        lang: 'ko',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        // 아이콘은 pwa-assets.config.mjs로 생성
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // 폰트는 한 번 받으면 오프라인에서도 쓴다. 지도는 앱에 포함된 데이터로 그려서 따로 받을 것이 없다.
        // Supabase 요청은 캐시하지 않는다.
        runtimeCaching: [
          {
            // Pretendard는 글자 범위별로 나뉜 파일 중 화면에 나온 글자의 파일만 받는다
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-fonts',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
