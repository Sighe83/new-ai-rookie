// Design System Types
export type ColorVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error'
export type Size = 'sm' | 'md' | 'lg'
export type ButtonVariant = 'primary' | 'secondary' | 'destructive'
export type AlertVariant = 'success' | 'warning' | 'error' | 'info'
export type BadgeVariant = 'success' | 'warning' | 'neutral'

// Theme tokens
export interface DesignTokens {
  colors: {
    primary: {
      DEFAULT: string
      hover: string
    }
    secondary: {
      DEFAULT: string
      hover: string
      text: string
    }
    accent: {
      DEFAULT: string
      text: string
    }
    success: {
      bg: string
      text: string
    }
    warning: {
      bg: string
      text: string
    }
    error: {
      DEFAULT: string
      bg: string
      text: string
    }
    surface: string
    base: string
    border: string
    text: {
      DEFAULT: string
      light: string
    }
  }
  spacing: Record<string, string>
  borderRadius: Record<string, string>
  fontSizes: Record<string, string>
  fontWeights: Record<string, number>
}

// Component prop interfaces
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}