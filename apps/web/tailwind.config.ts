import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // NEX-ALS Dark Luxury — substitui slate
        slate: {
          950: '#050B16',
          900: '#08111F',
          850: '#0A1526',
          800: '#0E1B30',
          750: '#12213A',
          700: '#172A47',
          600: '#22385C',
          500: '#3B5378',
          400: '#6E83A6',
          300: '#9FB0CC',
          200: '#C4D0E2',
          100: '#E6ECF5',
          50:  '#F7F9FC',
        },
        // Azul elétrico Zeus (primária; antes dourado NEX)
        brand: {
          50:  '#EFF7FF',
          100: '#DBEEFF',
          200: '#B8DCFF',
          300: '#7CC0FF',
          400: '#3FA2FF',
          500: '#1A8CFF',
          600: '#0B6FE0',
          700: '#0A58B4',
          800: '#0C478C',
          900: '#0E3766',
          950: '#0A2242',
        },
        // Acento roxo + aliases nex (gold* agora apontam para o azul Zeus)
        nex: {
          purple:  '#B78DFF',
          purpleL: '#D4BBFF',
          purpleD: '#7A56CC',
          gold:    '#1A8CFF',
          goldL:   '#7CC0FF',
          goldD:   '#0A58B4',
          bg:      '#050B16',
          card:    '#08111F',
          border:  'rgba(255,255,255,0.08)',
        },
      },
      backgroundImage: {
        'nex-gradient':   'linear-gradient(135deg, #050B16 0%, #0E1B30 100%)',
        'nex-card':       'linear-gradient(145deg, #08111F 0%, #0A1526 100%)',
        'gold-gradient':  'linear-gradient(135deg, #1A8CFF 0%, #7CC0FF 50%, #1A8CFF 100%)',
        'gold-shine':     'linear-gradient(90deg, transparent 0%, rgba(124,192,255,0.15) 50%, transparent 100%)',
      },
      boxShadow: {
        'nex-glow':   '0 0 20px rgba(26,140,255,0.15), 0 0 40px rgba(26,140,255,0.08)',
        'nex-card':   '0 4px 24px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset',
        'gold-glow':  '0 0 16px rgba(26,140,255,0.4)',
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
