'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'

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

function getSystemPreference(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyToDOM(resolved: 'dark' | 'light') {
  const html = document.documentElement
  if (resolved === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('auto')
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  const resolve = useCallback((t: Theme): 'dark' | 'light' => {
    return t === 'auto' ? getSystemPreference() : t
  }, [])

  // Mount: read saved preference and apply immediately
  useEffect(() => {
    const saved = localStorage.getItem('dad-strength-theme') as Theme | null
    const initial: Theme = (saved && ['dark', 'light', 'auto'].includes(saved)) ? saved : 'auto'
    const resolved = resolve(initial)
    setThemeState(initial)
    setResolvedTheme(resolved)
    applyToDOM(resolved)
    setMounted(true)
  }, [resolve])

  // When theme changes after mount
  useEffect(() => {
    if (!mounted) return
    const resolved = resolve(theme)
    setResolvedTheme(resolved)
    applyToDOM(resolved)
  }, [theme, mounted, resolve])

  // Listen for OS preference changes when in auto mode
  useEffect(() => {
    if (!mounted) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'auto') {
        const resolved = getSystemPreference()
        setResolvedTheme(resolved)
        applyToDOM(resolved)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme, mounted])

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
