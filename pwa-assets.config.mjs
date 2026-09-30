// 앱 아이콘 생성 설정. public/favicon.svg를 고친 뒤 아래 명령으로 PNG 아이콘을 다시 만든다.
//   npx @vite-pwa/assets-generator@1
// 원본 SVG가 여백 없이 꽉 찬 정사각형이라 padding 없이 그대로 쓴다.
export default {
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ['public/favicon.svg'],
}
