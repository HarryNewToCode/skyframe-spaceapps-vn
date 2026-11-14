/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#090D16',
        panel: '#111827',
        gridline: '#1E293B',
        solar: '#F59E0B',
        eclss: '#06B6D4',
        bio: '#10B981',
        rad: '#EF4444',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
