'use client'

import { createContext, useContext, useEffect, useLayoutEffect, useState, useMemo, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { GRAPHITE_PATHS } from '../lib/publicSite'

export type Theme = 'dark' | 'light' | 'auto'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  resolvedTheme: 'dark' | 'light'
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
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
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem('dad-strength-theme') as Theme | null
  // Chalk is the ground this system is named for (:root is #FAF9F6; .dark is
  // the graphite variant). Defaulting to 'auto' handed the decision to the
  // OS, so a dark-preferring machine never showed the intended design at all.
  // 'auto' remains a user choice in settings — it is no longer the fallback.
  return saved && ['dark', 'light', 'auto'].includes(saved) ? saved : 'light'
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getSavedTheme)
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark)

  // The public site is always graphite; the saved theme is untouched and
  // applies again the moment the app opens.
  const pathname = usePathname()
  const forcedDark = GRAPHITE_PATHS.includes(pathname ?? '')

  // resolvedTheme is pure derived state — no extra setState needed
  const resolvedTheme: 'dark' | 'light' = useMemo(
    () => (forcedDark ? 'dark' : theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme),
    [forcedDark, theme, systemDark]
  )

  // Apply to DOM whenever resolvedTheme changes. A layout effect, so a client
  // navigation between the site (always graphite) and the app never paints a
  // frame in the previous route's palette.
  useLayoutEffect(() => {
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
