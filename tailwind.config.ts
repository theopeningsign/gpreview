import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B35',
        dark: '#333333',
        bg: '#F8F9FA'
      },
      boxShadow: {
        soft: '0 6px 20px rgba(0,0,0,0.08)'
      },
      borderRadius: {
        xl: '14px'
      }
    },
  },
  plugins: [],
}

export default config





