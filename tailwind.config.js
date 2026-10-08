/** @type {import('tailwindcss').Config} */

// 부드러운 화이트 글라스 테마: 채도를 낮춘 푸른 회색 단계 + 차분한 페리윙클·라벤더 강조.
// (지도 색은 src/lib/theme.ts, 그라데이션·유리 효과는 src/index.css에서 같은 값을 쓴다)
const GRAY = {
  50: '#F9FAFD',
  100: '#F3F5FA',
  200: '#E6E9F2',
  300: '#D3D8E4',
  400: '#A3AABB',
  500: '#636C85',
  600: '#525B72',
  700: '#3E465C',
  800: '#2C3346',
  900: '#1F2537',
};
// 강조 = 차분한 페리윙클(흰 글씨 대비 4.9:1), 보조 강조 = 옅은 라벤더. 연한 강조 = 파스텔
const BRAND = {
  main: '#5E68C4',
  strong: '#4E57A8',
  lavender: '#7A68C2',
  weak: '#F0F2FB',
  weaker: '#E4E7F7',
  onWeak: '#4E56A8',
};

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: GRAY,

        primary: BRAND.main,
        'primary-strong': BRAND.strong,
        'on-primary': '#FFFFFF',
        'primary-container': BRAND.main,
        'on-primary-container': '#FFFFFF',
        'primary-fixed': BRAND.weak,
        'primary-fixed-dim': BRAND.weaker,
        'on-primary-fixed': BRAND.onWeak,
        secondary: BRAND.lavender,
        'secondary-container': BRAND.weak,

        background: '#FFFFFF',
        surface: '#FFFFFF',
        'surface-bright': '#FFFFFF',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': GRAY[50],
        'surface-container': GRAY[100],
        'surface-container-high': GRAY[200],
        'surface-container-highest': GRAY[300],
        'surface-variant': GRAY[100],
        'surface-dim': GRAY[200],
        'on-background': GRAY[900],
        'on-surface': GRAY[900],
        'on-surface-variant': GRAY[600],
        outline: GRAY[500],
        'outline-variant': GRAY[200],
        // 선택된 칩·단계 번호 등
        'inverse-surface': BRAND.main,
        'inverse-on-surface': '#FFFFFF',

        error: '#C2525D',
        'on-error': '#FFFFFF',
        'error-container': '#FBF0F1',
        'on-error-container': '#A8434D',
      },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2rem',
        'gutter-sm': '0.75rem',
        gutter: '1rem',
        margin: '1.25rem',
        'margin-lg': '2rem',
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '"Malgun Gothic"',
          'sans-serif',
        ],
      },
      // 기존 font-*/text-* 토큰 이름은 그대로 두고 크기·굵기만 토스 느낌으로
      fontSize: {
        'display-lg': ['28px', { lineHeight: '1.35', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['24px', { lineHeight: '1.4', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['22px', { lineHeight: '1.4', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-sm': ['18px', { lineHeight: '1.45', letterSpacing: '-0.01em', fontWeight: '700' }],
        'body-lg': ['17px', { lineHeight: '1.6' }],
        'body-md': ['15px', { lineHeight: '1.6' }],
        'body-sm': ['14px', { lineHeight: '1.55' }],
        'label-lg': ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        'label-md': ['13px', { lineHeight: '1.45', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '1.45' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        // 지도 위에 뜨는 요소만 은은한 그림자를 쓴다
        float: '0 1px 4px rgba(70, 80, 130, 0.05), 0 8px 24px rgba(90, 100, 160, 0.08)',
        sheet: '0 -2px 20px rgba(90, 100, 160, 0.06), 0 12px 32px rgba(70, 80, 130, 0.09)',
      },
    },
  },
  plugins: [],
};
