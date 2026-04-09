'use client'

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react'

export type Theme = 'dark' | 'light' | 'auto'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  resolvedTheme: 'dark' | 'light'
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'auto',
  setTheme: () => {},
  resolvedTheme: 'dark',
})

export function useTheme() {
  return useContext(ThemeContext)
}

function applyToDOM(resolved: 'dark' | 'light') {
  const html = document.documentElement
  if (resolved === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

function getSavedTheme(): Theme {
  if (typeof window === 'undefined') return 'auto'
  const saved = localStorage.getItem('dad-strength-theme') as Theme | null
  return saved && ['dark', 'light', 'auto'].includes(saved) ? saved : 'auto'
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getSavedTheme)
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark)

  // resolvedTheme is pure derived state — no extra setState needed
  const resolvedTheme: 'dark' | 'light' = useMemo(
    () => (theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme),
    [theme, systemDark]
  )

  // Apply to DOM whenever resolvedTheme changes
  useEffect(() => {
    applyToDOM(resolvedTheme)
  }, [resolvedTheme])

  // Track OS preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setSystemDark(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('dad-strength-theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
