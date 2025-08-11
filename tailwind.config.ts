
import type { Config } from 'tailwindcss'
import { colors, borderRadius, boxShadow, fontFamily } from './lib/design-tokens'

export default {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
  fontFamily,
  colors,
  borderRadius,
  boxShadow,
    },
  },
  plugins: [],
} satisfies Config