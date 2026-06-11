import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // NEX-ALS Dark Luxury — substitui slate
        slate: {
          950: '#080612',
          900: '#0D0A24',
          850: '#100C2A',
          800: '#151038',
          750: '#1A1442',
          700: '#1E1650',
          600: '#2E266A',
          500: '#4A4290',
          400: '#7B75B8',
          300: '#A8A3CC',
          200: '#C8C4E0',
          100: '#E8E6F4',
          50:  '#F8F8FC',
        },
        // Gold primary
        brand: {
          50:  '#FEF9EC',
          100: '#FDF0CC',
          200: '#FAE0A0',
          300: '#F2C879',
          400: '#E8B55A',
          500: '#D9A441',
          600: '#C4912E',
          700: '#A87A22',
          800: '#8A6318',
          900: '#5C400E',
          950: '#332308',
        },
        // Purple accent NEX-ALS
        nex: {
          purple:  '#B78DFF',
          purpleL: '#D4BBFF',
          purpleD: '#7A56CC',
          gold:    '#D9A441',
          goldL:   '#F2C879',
          goldD:   '#A87A22',
          bg:      '#080612',
          card:    '#0D0A24',
          border:  'rgba(255,255,255,0.08)',
        },
      },
      backgroundImage: {
        'nex-gradient':   'linear-gradient(135deg, #080612 0%, #151038 100%)',
        'nex-card':       'linear-gradient(145deg, #0D0A24 0%, #100C2A 100%)',
        'gold-gradient':  'linear-gradient(135deg, #D9A441 0%, #F2C879 50%, #D9A441 100%)',
        'gold-shine':     'linear-gradient(90deg, transparent 0%, rgba(242,200,121,0.15) 50%, transparent 100%)',
      },
      boxShadow: {
        'nex-glow':   '0 0 20px rgba(217,164,65,0.15), 0 0 40px rgba(217,164,65,0.08)',
        'nex-card':   '0 4px 24px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset',
        'gold-glow':  '0 0 16px rgba(217,164,65,0.4)',
        'purple-glow':'0 0 16px rgba(183,141,255,0.3)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
