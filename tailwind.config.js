/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#faf8f3',
          100: '#f4efe6',
          200: '#e8dfd1',
          300: '#d8c9b4',
          400: '#bfae95',
        },
        pine: {
          50: '#eef5f1',
          100: '#d8e9e0',
          200: '#b3d3c3',
          300: '#86b7a0',
          400: '#5a967c',
          500: '#3d7b62',
          600: '#2f6350',
          700: '#274f41',
          800: '#213f35',
          900: '#1c342c',
        },
        clay: {
          50: '#fbf1ec',
          100: '#f6e0d4',
          200: '#ecc0aa',
          300: '#df9977',
          400: '#d07a50',
          500: '#bf5f35',
          600: '#a94c28',
          700: '#8c3c23',
          800: '#733323',
          900: '#5f2d20',
        },
        ink: {
          DEFAULT: '#1e2a24',
          muted: '#5b6b62',
          soft: '#8a978f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(30, 42, 36, 0.04), 0 8px 24px -12px rgba(30, 42, 36, 0.18)',
        lift: '0 2px 4px rgba(30, 42, 36, 0.05), 0 20px 40px -20px rgba(30, 42, 36, 0.25)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-up': 'slide-up 220ms ease-out',
      },
    },
  },
  plugins: [],
};
