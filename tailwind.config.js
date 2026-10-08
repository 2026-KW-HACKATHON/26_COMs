/** @type {import('tailwindcss').Config} */

// 토스처럼 흰 바탕 + 무채색 회색 단계 + 강조색 하나. 강조색을 바꾸려면 BRAND만 고치면 된다.
// (지도 색은 src/lib/theme.ts에서 같은 값을 쓴다)
const GRAY = {
  50: '#F9FAFB',
  100: '#F2F4F6',
  200: '#E5E8EB',
  300: '#D1D6DB',
  400: '#B0B8C1',
  500: '#8B95A1',
  600: '#6B7684',
  700: '#4E5968',
  800: '#333D4B',
  900: '#191F28',
};
// 강조 = 파랑 (흰 글씨 대비 3.7:1, 굵은 버튼 글씨용). 연한 강조 = 아주 옅은 하늘색
const BRAND = {
  main: '#3182F6',
  strong: '#1B64DA',
  weak: '#E8F3FF',
  weaker: '#C9E2FF',
  onWeak: '#1B64DA',
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
        secondary: GRAY[600],
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
        'inverse-surface': GRAY[800],
        'inverse-on-surface': '#FFFFFF',

        error: '#F04452',
        'on-error': '#FFFFFF',
        'error-container': '#FFEEEF',
        'on-error-container': '#C9303D',
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
        // 지도 위에 뜨는 요소만 은은한 그림자를 쓴다 (나머지 화면은 평평하게)
        float: '0 2px 12px rgba(0, 0, 0, 0.08)',
        sheet: '0 -2px 20px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};
