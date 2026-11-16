/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          bg: '#07060d', // near-black with a hint of violet
          surface: '#0f0d18',
          card: '#15121f',
          line: 'rgba(255,255,255,0.08)',
          text: '#f6f4fb',
          muted: '#a49fb5',
          accent: '#ff3d7f', // hot pink
          accent2: '#7c5cff', // electric violet
          gold: '#ffc94d', // premium
          live: '#3ee08f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Unbounded', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,61,127,.35), 0 10px 40px -10px rgba(255,61,127,.55)',
        gold: '0 0 0 1px rgba(255,201,77,.45), 0 12px 40px -12px rgba(255,201,77,.45)',
      },
      animation: {
        shine: 'shine 2.4s linear infinite',
        'fade-in-up': 'fadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scaleIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'float 3s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        blob: 'blob 18s ease-in-out infinite',
      },
      keyframes: {
        shine: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        fadeInUp: { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-6px)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        blob: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(40px,-30px) scale(1.1)' },
          '66%': { transform: 'translate(-30px,20px) scale(0.95)' },
        },
      },
    },
  },
  plugins: [],
};
