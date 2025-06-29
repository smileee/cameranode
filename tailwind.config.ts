const { fontFamily } = require("tailwindcss/defaultTheme")
const { type } = require('os');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{ts,tsx}',
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
        background: 'hsl(0 0% 2%)', // Almost black
        foreground: 'hsl(0 0% 98%)', // Off-white
        card: 'hsl(0 0% 4%)',
        'card-foreground': 'hsl(0 0% 98%)',
        popover: 'hsl(0 0% 4%)',
        'popover-foreground': 'hsl(0 0% 98%)',
        primary: 'hsl(0 0% 98%)',
        'primary-foreground': 'hsl(0 0% 9%)',
        secondary: 'hsl(0 0% 14.9%)',
        'secondary-foreground': 'hsl(0 0% 98%)',
        muted: 'hsl(0 0% 14.9%)',
        'muted-foreground': 'hsl(0 0% 63.9%)',
        accent: 'hsl(0 0% 14.9%)',
        'accent-foreground': 'hsl(0 0% 98%)',
        destructive: 'hsl(0 62.8% 30.6%)',
        'destructive-foreground': 'hsl(0 0% 98%)',
        border: 'hsl(0 0% 14.9%)',
        input: 'hsl(0 0% 14.9%)',
        ring: 'hsl(0 0% 83.1%)',
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