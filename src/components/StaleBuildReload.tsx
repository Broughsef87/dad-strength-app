'use client'

import { useEffect } from 'react'
import { CLIENT_DATA_VERSION } from '../lib/clientVersion'

const CHECK_EVERY_MS = 10 * 60_000
const RELOAD_GUARD = 'ds-stale-reload-at'

/**
 * Reloads a tab whose bundle is older than the server's data contract
 * (src/lib/clientVersion.ts). Checks on load, whenever the tab comes back into
 * view, and every ten minutes. At most one reload a minute, so a cached bundle
 * that keeps coming back cannot loop.
 */
export default function StaleBuildReload() {
  useEffect(() => {
    let stopped = false
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const { version } = (await res.json()) as { version?: number }
        if (typeof version !== 'number' || version <= CLIENT_DATA_VERSION) return
        let last = 0
        try { last = Number(sessionStorage.getItem(RELOAD_GUARD)) || 0 } catch {}
        if (Date.now() - last < 60_000) return
        try { sessionStorage.setItem(RELOAD_GUARD, String(Date.now())) } catch {}
        window.location.reload()
      } catch {
        // Offline or the check failed: try again next time.
      }
    }
    check()
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, CHECK_EVERY_MS)
    return () => { stopped = true; document.removeEventListener('visibilitychange', check); clearInterval(timer) }
  }, [])
  return null
}
