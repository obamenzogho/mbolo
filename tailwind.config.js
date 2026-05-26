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
        primary: '#009A44',
        secondary: '#3A75C4',
        accent: '#FCD116',
        background: '#0D1117',
        surface: '#161B22',
        'surface-light': '#21262D',
        'text-primary': '#F0F6FC',
        'text-secondary': '#8B949E',
        border: '#30363D',
      },
    },
  },
  plugins: [],
}
