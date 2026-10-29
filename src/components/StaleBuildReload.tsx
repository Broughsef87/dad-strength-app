'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { CLIENT_DATA_VERSION } from '../lib/clientVersion'

const RELOAD_GUARD = 'ds-stale-reload-at'
const CHECK_EVERY_MS = 10 * 60_000
// A training session in progress: rest timer, sets being typed. Never pulled
// out from under him; the check runs again when he leaves the session.
const IN_SESSION = /^\/train\/[^/]+\/[^/]+/

/**
 * Reloads a tab whose bundle is older than the server's data contract
 * (src/lib/clientVersion.ts). Checks when the app opens, when the tab comes
 * back into view, on each page change, and every ten minutes. Never while a
 * form field has focus (he is typing) or on a training session page, and
 * skipped offline. At most
 * once a minute; if the once-a-minute mark cannot be saved (storage blocked)
 * it does not reload at all, so a cached bundle cannot loop.
 */
/** Mid-work: a training session open, or a form field being typed in. */
function busy(): boolean {
  if (IN_SESSION.test(window.location.pathname)) return true
  const el = document.activeElement
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable)
}

export default function StaleBuildReload() {
  const pathname = usePathname()
  useEffect(() => {
    let stopped = false
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible' || !navigator.onLine) return
      if (busy()) return
      try {
        // A unique URL, so the offline cache can never answer for the server.
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const { version } = (await res.json()) as { version?: number }
        if (typeof version !== 'number' || version <= CLIENT_DATA_VERSION) return
        if (stopped || busy()) return
        const now = Date.now()
        try {
          if (now - (Number(sessionStorage.getItem(RELOAD_GUARD)) || 0) < 60_000) return
          sessionStorage.setItem(RELOAD_GUARD, String(now))
          if (sessionStorage.getItem(RELOAD_GUARD) !== String(now)) return
        } catch {
          return
        }
        window.location.reload()
      } catch {
        // Offline or the check failed: try again next time.
      }
    }
    check()
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, CHECK_EVERY_MS)
    return () => { stopped = true; document.removeEventListener('visibilitychange', check); clearInterval(timer) }
  }, [pathname])
  return null
}
