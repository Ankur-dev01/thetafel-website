import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#fdfaf5',
        warm: '#f8f2e6',
        warm2: '#f0e8d8',
        amber: {
          DEFAULT: '#d4820a',
          dark: '#b86d08',
          light: '#f5ede0',
        },
        earth: {
          DEFAULT: '#1e1508',
          mid: '#3d2e18',
        },
        stone: {
          DEFAULT: '#9c8b6a',
          light: '#c8b89a',
        },
        night: '#0f0d08',
        green: '#25d366',
      },
      fontFamily: {
        display: ['Raleway', 'sans-serif'],
        body: ['Jost', 'sans-serif'],
      },
      fontSize: {
        'hero': 'clamp(48px, 6.5vw, 86px)',
        'h2': 'clamp(30px, 3.8vw, 48px)',
      },
      letterSpacing: {
        'hero': '-0.03em',
        'h2': '-0.025em',
        'ui': '0.2em',
        'btn': '0.12em',
      },
      lineHeight: {
        'hero': '0.95',
        'h2': '1.05',
      },
      borderRadius: {
        'card': '20px',
        'pill': '100px',
      },
      maxWidth: {
        'content': '1200px',
      },
      boxShadow: {
        'amber': '0 4px 16px rgba(212, 130, 10, 0.3)',
        'amber-hover': '0 8px 24px rgba(212, 130, 10, 0.4)',
        'card': '0 4px 24px rgba(30, 21, 8, 0.08)',
        'card-hover': '0 12px 40px rgba(30, 21, 8, 0.14)',
      },
    },
  },
  plugins: [],
}

export default config