/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#135bec",
        "primary-dark": "#0f4bc4",
        "background-light": "#f6f6f8",
        "background-dark": "#101622",
        "surface-light": "#ffffff",
        "surface-dark": "#1c2533",
        "card-dark": "#192233",
        "border-dark": "#324467",
        "input-dark": "#232f48",
        "text-secondary": "#92a4c9",
      },
      fontFamily: {
        "display": ["Lexend", "sans-serif"],
        "body": ["Noto Sans", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "full": "9999px"
      },
    },
  },
  plugins: [],
}
