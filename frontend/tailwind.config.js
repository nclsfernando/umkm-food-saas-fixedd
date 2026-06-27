/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#fef9ee', 100:'#fdf0d5', 200:'#faddaa', 500:'#f59e0b', 600:'#d97706', 700:'#b45309' },
      },
    },
  },
  plugins: [],
};
