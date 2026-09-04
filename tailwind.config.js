/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        arena: {
          dark: '#12141a',
          darker: '#0a0b0e',
          card: '#1a1d26',
          border: '#282d3c',
          primary: '#6366f1',
          primaryHover: '#4f46e5',
          gold: '#f59e0b',
          boardLight: '#f0d9b5',
          boardDark: '#b58863',
          boardHighlight: '#baca44',
          danger: '#ef4444',
          success: '#10b981'
        }
      }
    },
  },
  plugins: [],
}
