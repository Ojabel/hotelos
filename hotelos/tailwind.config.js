const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1440px' },
    extend: {
      colors: {
        forest: c('forest'),
        deep: c('deep'),
        champagne: c('champagne'),
        ivory: c('ivory'),
        slate: c('slate'),
        line: c('line'),
        success: c('success'),
        warning: c('warning'),
        danger: c('danger'),
        info: c('info'),
      },
      fontFamily: {
        heading: ['"DM Sans"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        meta: ['12px', '16px'],
        body: ['14px', '20px'],
        card: ['15px', '22px'],
        section: ['20px', '28px'],
        page: ['28px', '34px'],
      },
      borderRadius: { sm: '4px', DEFAULT: '6px', md: '6px', lg: '8px' },
      boxShadow: {
        card: '0 1px 2px rgba(23,37,31,0.05)',
        pop: '0 8px 24px rgba(23,37,31,0.14)',
      },
    },
  },
  plugins: [],
};
