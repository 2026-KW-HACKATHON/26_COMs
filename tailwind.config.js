/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: { 
        'on-tertiary': '#ffffff', 'primary-container': '#ff7b54', 'surface-bright': '#fff8f5', 
        'on-error': '#ffffff', 'primary-fixed-dim': '#ffb5a0', 'secondary-container': '#fe9975', 
        'inverse-surface': '#34302c', 'primary-fixed': '#ffdbd1', 'outline-variant': '#dfc0b7', 
        'inverse-primary': '#ffb5a0', 'on-surface': '#1e1b18', 'on-tertiary-fixed-variant': '#6c3a00', 
        'error': '#ba1a1a', 'secondary-fixed': '#ffdbcf', 'primary': '#a63a19', 
        'secondary-fixed-dim': '#ffb59c', 'surface-dim': '#e1d8d4', 'on-primary-container': '#6d1a00', 
        'surface-container': '#f5ece7', 'error-container': '#ffdad6', 'on-secondary-fixed-variant': '#783115', 
        'on-tertiary-container': '#572e00', 'surface-container-highest': '#e9e1dc', 'tertiary-container': '#da924e', 
        'on-primary-fixed': '#3b0a00', 'on-secondary-fixed': '#380c00', 'secondary': '#97472a', 
        'outline': '#8b716a', 'on-background': '#1e1b18', 'tertiary': '#8a5010', 
        'surface-container-high': '#efe6e2', 'on-primary-fixed-variant': '#862302', 'surface-container-low': '#fbf2ed', 
        'on-surface-variant': '#58423c', 'background': '#fff8f5', 'tertiary-fixed-dim': '#ffb877', 
        'surface-container-lowest': '#ffffff', 'on-primary': '#ffffff', 'tertiary-fixed': '#ffdcc1', 
        'surface-tint': '#a63a19', 'surface': '#fff8f5', 'on-error-container': '#93000a', 
        'on-secondary': '#ffffff', 'on-secondary-container': '#762f14', 'inverse-on-surface': '#f8efea', 
        'on-tertiary-fixed': '#2e1600', 'surface-variant': '#e9e1dc' 
      },
      spacing: { 
        'space-xs': '0.25rem', 'gutter-sm': '0.75rem', 'space-md': '1rem', 'margin-lg': '2rem', 
        'space-xl': '2rem', 'space-sm': '0.5rem', 'space-lg': '1.5rem', 'gutter': '1rem', 'margin': '1.25rem' 
      },
      fontFamily: { 
        'headline-md': ['Plus Jakarta Sans', 'sans-serif'], 'headline-sm': ['Plus Jakarta Sans', 'sans-serif'], 
        'label-md': ['Plus Jakarta Sans', 'sans-serif'], 'display-lg-mobile': ['Plus Jakarta Sans', 'sans-serif'], 
        'body-md': ['Noto Sans', 'sans-serif'], 'headline-lg': ['Plus Jakarta Sans', 'sans-serif'], 
        'label-sm': ['Plus Jakarta Sans', 'sans-serif'], 'body-sm': ['Noto Sans', 'sans-serif'], 
        'display-lg': ['Plus Jakarta Sans', 'sans-serif'], 'body-lg': ['Noto Sans', 'sans-serif'], 
        'label-lg': ['Plus Jakarta Sans', 'sans-serif'] 
      },
    },
  },
  plugins: [],
}