import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        border: 'var(--color-border)',
        celadon: {
          900: 'var(--color-celadon-900)',
          700: 'var(--color-celadon-700)',
          500: 'var(--color-celadon-500)',
          200: 'var(--color-celadon-200)',
          100: 'var(--color-celadon-100)',
        },
        kiln: {
          700: 'var(--color-kiln-700)',
          500: 'var(--color-kiln-500)',
          100: 'var(--color-kiln-100)',
        },
        status: {
          success: 'var(--color-status-success)',
          warning: 'var(--color-status-warning)',
          risk: 'var(--color-status-risk)',
          info: 'var(--color-status-info)',
          neutral: 'var(--color-status-neutral)',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', '"Songti SC"', 'serif'],
        sans: ['Inter', '"Noto Sans SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      maxWidth: {
        'content': '1200px',
        'reading': '760px',
        'task': '880px',
        'participant': '1280px',
        'admin': '1440px',
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '16px',
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1' }],
        'h1': ['2.5rem', { lineHeight: '1.2' }],
        'h2': ['1.875rem', { lineHeight: '1.3' }],
        'h3': ['1.375rem', { lineHeight: '1.4' }],
        'body-lg': ['1.125rem', { lineHeight: '1.7' }],
        'body': ['1rem', { lineHeight: '1.7' }],
        'small': ['0.875rem', { lineHeight: '1.5' }],
        'caption': ['0.75rem', { lineHeight: '1.5' }],
      },
    },
  },
  plugins: [],
};

export default config;
