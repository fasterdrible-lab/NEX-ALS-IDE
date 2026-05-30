import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dde8ff',
          200: '#c2d3ff',
          300: '#96b5fd',
          400: '#638dfa',
          500: '#4166f5',
          600: '#2c48ea',
          700: '#2537d7',
          800: '#242fae',
          900: '#232d89',
          950: '#181d54',
        },
      },
    },
  },
  plugins: [],
}

export default config
