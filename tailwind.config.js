/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        velvet: { 950: '#12060a', 900: '#1f0a10', 800: '#3a0f1a', 700: '#5c1426', 600: '#8a1c35' },
        marquee: { 300: '#ffe8a3', 400: '#ffd166', 500: '#f4b400' },
        screen: '#f6f1e7',
      },
      fontFamily: {
        display: ['"Bungee"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: { bulb: '0 0 12px 2px rgba(255,209,102,.55)' },
    },
  },
  plugins: [],
}
