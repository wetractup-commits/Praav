/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette from PRD §7.1
        rose: {
          DEFAULT: '#B5294E',
          light:   '#E8526E',
          pale:    '#FDF0F3',
        },
        midnight: {
          DEFAULT: '#1C1C2E',
          light:   '#2E2E46',
        },
        sand: {
          DEFAULT: '#F7F3EE',
          dark:    '#EDE7DF',
        },
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        sm:  '0 2px 12px rgba(28,28,46,.08)',
        md:  '0 8px 32px rgba(28,28,46,.12)',
        lg:  '0 24px 64px rgba(28,28,46,.18)',
        top: '0 -4px 24px rgba(28,28,46,.10)',
      },
      animation: {
        'fade-up':   'fadeUp .35s ease both',
        'fade-down': 'fadeDown .5s ease both',
        'float':     'float 3s ease-in-out infinite',
        'slide-in':  'slideIn .3s ease both',
      },
      keyframes: {
        fadeUp:   { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeDown: { from: { opacity: 0, transform: 'translateY(-16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        float:    { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        slideIn:  { from: { opacity: 0, transform: 'translateX(20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
}
