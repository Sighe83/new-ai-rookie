import type { Config } from 'tailwindcss'

export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#4A55A2', // Deep, friendly blue
          hover: '#3A4480',   // Darker blue
        },
        secondary: {
          DEFAULT: '#F5EFE6', // Warm Beige
          hover: '#E8E0D5',   // Darker Beige
          text: '#57534E',    // Dark Warm Gray Text
        },
        accent: {
          DEFAULT: '#A27B5C', // Burnt Orange/Brown
          text: '#44403C',    // Warm Dark Gray
        },
        success: {
          bg: '#F0FDF4',      // Soft Green BG
          text: '#166534',    // Dark Green Text
        },
        warning: {
          bg: '#FEFCE8',      // Soft Yellow BG
          text: '#854D0E',    // Dark Yellow Text
        },
        error: {
          DEFAULT: '#DC2626', // Red 600
          bg: '#FEF2F2',      // Soft Red BG
          text: '#991B1B',    // Dark Red Text
        },
        surface: '#FBF9F6', // Creamy page background
        base: '#FFFFFF',    // White for cards
        border: '#E7E5E4',  // Soft border color
        text: {
          DEFAULT: '#44403C', // Warm Dark Gray for headings
          light: '#57534E',   // Dark Warm Gray for body
        }
      },
      borderRadius: {
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
        'full': '9999px'
      },
      boxShadow: {
        'soft': '0 6px 16px rgba(0, 0, 0, 0.06)'
      }
    },
  },
  plugins: [],
} satisfies Config