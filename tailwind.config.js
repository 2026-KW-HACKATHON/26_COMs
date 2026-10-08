/** @type {import('tailwindcss').Config} */

// 오래된 동네 앨범 같은 디자인: 따뜻한 종이색 바탕 + 먹색 글씨 + 노을빛 주황 강조색 하나.
// 회색도 푸른 기 대신 누런 기가 도는 단계로 맞췄다. 강조색을 바꾸려면 BRAND만 고치면 된다.
// (지도 색은 src/lib/theme.ts, 노을 그라데이션·필름 날짜는 src/index.css에서 같은 값을 쓴다)
const GRAY = {
  50: '#FBF8F4',
  100: '#F4EFE8',
  200: '#E9E2D9',
  300: '#D9D0C5',
  400: '#B1A69A',
  500: '#8C8176',
  600: '#6E645B',
  700: '#51483F',
  800: '#3A322B',
  900: '#2B221C',
};
const BRAND = {
  main: '#F2552C',
  strong: '#D9430F',
  weak: '#FFF1EA',
  weaker: '#FFE2D4',
  onWeak: '#B83C10',
};
/** 바탕 종이색 (index.html·vite.config.ts의 theme-color와 같은 값) */
const PAPER = '#FAF6F1';

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

        // 바탕은 종이색, 카드(surface)는 흰 인화지
        background: PAPER,
        paper: PAPER,
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
        // 선택된 칩·안내 말풍선: 먹색
        'inverse-surface': GRAY[900],
        'inverse-on-surface': '#FFF8F2',

        error: '#E5484D',
        'on-error': '#FFFFFF',
        'error-container': '#FDEEEC',
        'on-error-container': '#B4282E',
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
        // 추억이 담긴 제목(회상 카드·가게 이름·화면 제목)에만 쓰는 바탕체
        serif: ['"Gowun Batang"', '"Noto Serif KR"', '"AppleMyungjo"', 'serif'],
        // 방명록에 펜으로 쓴 'OO 왔다감' 느낌: 앱 이름과 폴라로이드 아래 글씨
        hand: ['"Nanum Pen Script"', '"Gowun Batang"', 'cursive'],
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
      // 그림자도 검정 대신 갈색 기가 도는 빛으로 (종이 위에 사진을 올려 둔 느낌)
      boxShadow: {
        float: '0 2px 12px rgba(74, 44, 20, 0.10)',
        sheet: '0 -2px 20px rgba(74, 44, 20, 0.06), 0 10px 30px rgba(74, 44, 20, 0.12)',
        card: '0 1px 2px rgba(74, 44, 20, 0.05), 0 8px 24px rgba(74, 44, 20, 0.07)',
        photo: '0 1px 2px rgba(74, 44, 20, 0.08), 0 10px 24px -6px rgba(74, 44, 20, 0.22)',
        glow: '0 10px 24px -8px rgba(226, 72, 30, 0.55)',
      },
    },
  },
  plugins: [],
};
