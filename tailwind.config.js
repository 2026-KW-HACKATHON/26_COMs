/** @type {import('tailwindcss').Config} */

// 플랫 디자인: 단색 면 + 얇은 테두리. 뉴트럴 회색 단계 + 차분한 블루 강조색 하나.
// (지도 색은 src/lib/theme.ts에서 같은 값을 쓴다)
const GRAY = {
  50: '#FAFAFB',
  100: '#F3F4F6',
  200: '#E6E8EC',
  300: '#D5D8DE',
  400: '#A4AAB3',
  500: '#626A75',
  600: '#4F5661',
  700: '#3A404A',
  800: '#2A2F37',
  900: '#1F2329',
};
// 강조 = 차분한 블루(흰 글씨 대비 4.8:1). 연한 강조 = 아주 옅은 블루
const BRAND = {
  main: '#3B6FD4',
  strong: '#2F5DB8',
  weak: '#EEF3FC',
  weaker: '#DDE7FA',
  onWeak: '#2F5DB8',
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
        secondary: BRAND.strong,
        'secondary-container': BRAND.weak,

        background: '#F7F8FA',
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

        error: '#C9484F',
        'on-error': '#FFFFFF',
        'error-container': '#FCEFF0',
        'on-error-container': '#A63A41',
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
        // 플랫: 지도 위에 뜨는 요소만 아주 얇은 그림자 한 겹 (테두리와 함께 쓴다)
        float: '0 1px 2px rgba(16, 24, 40, 0.06)',
        sheet: '0 1px 3px rgba(16, 24, 40, 0.08)',
      },
    },
  },
  plugins: [],
};
