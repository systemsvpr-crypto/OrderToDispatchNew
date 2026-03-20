/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#58cc02',
        'primary-hover': '#4aa802',
      },
    },
  },
  plugins: [
    // require('tailwind-scrollbar')({ nocompatible: true }),
  ],
};