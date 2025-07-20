const { fontFamily } = require("tailwindcss/defaultTheme")

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        background: 'hsl(0 0% 0%)', // Black
        foreground: 'hsl(0 0% 100%)', // White
        muted: 'hsl(0 0% 15%)',
        'muted-foreground': 'hsl(0 0% 65%)',
        border: 'hsl(0 0% 15%)',
        accent: 'hsl(0 0% 20%)',
      },
      fontFamily: {
        sans: ["var(--font-inter)", ...fontFamily.sans],
      },
      borderRadius: {
        lg: `0.5rem`,
        md: `calc(0.5rem - 2px)`,
        sm: 'calc(0.5rem - 4px)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} 