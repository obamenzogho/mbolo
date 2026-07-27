/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#00C853',
        'primary-dark': '#009A44',
        secondary: '#3A75C4',
        accent: '#FCD116',
        background: '#0A0C10',
        surface: '#141619',
        'surface-elevated': '#1C1F24',
        'surface-highlight': '#252830',
        'text-primary': '#F0F0F0',
        'text-secondary': '#8A8D93',
        'text-muted': '#5A5D63',
        border: '#2A2D33',
        'border-light': '#1E2025',
        error: '#F85149',
        success: '#00C853',
        warning: '#FCD116',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
      },
      fontSize: {
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['15px', { lineHeight: '22px' }],
        lg: ['17px', { lineHeight: '24px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '38px' }],
      },
    },
  },
  plugins: [],
}
