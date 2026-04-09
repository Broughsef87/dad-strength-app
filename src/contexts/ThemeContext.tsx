'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'

export type Theme = 'dark' | 'light' | 'red'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  resolvedTheme: 'dark' | 'light' | 'red'
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  resolvedTheme: 'dark',
})

export function useTheme() {
  return useContext(ThemeContext)
}

function applyToDOM(resolved: 'dark' | 'light' | 'red') {
  const html = document.documentElement
  html.classList.remove('dark', 'see-red')
  if (resolved === 'dark') html.classList.add('dark')
  else if (resolved === 'red') html.classList.add('dark', 'see-red')
  // light: no class needed
}

function getSavedTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem('dad-strength-theme') as Theme | null
  return saved && ['dark', 'light', 'red'].includes(saved) ? saved : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('dad-strength-theme', t)
    applyToDOM(t)
  }, [])

  // Mount: read saved preference and apply immediately (no flash)
  useEffect(() => {
    const initial = getSavedTheme()
    setThemeState(initial)
    applyToDOM(initial)
    setMounted(true)
  }, [])

  const resolvedTheme = theme

  if (!mounted) return null

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
