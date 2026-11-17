/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F5F0',
        stone: '#ECE8E0',
        ink: '#17181C',
        accent: { DEFAULT: '#FF5A36', soft: '#FFE3DB' },
        felt: { DEFAULT: '#0E9AA7', dark: '#0B7C86', light: '#5CC6CF' },
        brass: '#C9A227',
      },
      fontFamily: {
        display: ['"Oswald"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,24,28,.06), 0 8px 24px rgba(23,24,28,.08)',
        lift: '0 12px 32px rgba(23,24,28,.18)',
      },
    },
  },
  plugins: [],
}
