'use client'

// ── Cockpit chrome ─────────────────────────────────────────────────────────────
// Global HUD overlay: viewport corner brackets (looking through cockpit glass),
// a barely-there scanline texture, and a once-per-session boot sequence.
// Everything is pointer-events-none except the boot overlay (tap to skip).

import { useEffect, useState } from 'react'

const BOOT_KEY = 'ds-boot-played'

const BOOT_LINES = [
  'DS-01 // SYSTEMS ONLINE',
  'LOAD CELLS ......... CALIBRATED',
  'REACTOR ............ NOMINAL',
  'PILOT .............. AUTHENTICATED',
]

function BootSequence({ onDone }: { onDone: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0)
  const [lifting, setLifting] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    BOOT_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), 180 + i * 220))
    })
    timers.push(setTimeout(() => setLifting(true), 1350))
    timers.push(setTimeout(onDone, 1750))
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  return (
    <div
      onClick={onDone}
      className={`fixed inset-0 z-[100] bg-[#07080c] flex flex-col items-center justify-center transition-opacity duration-400 ${lifting ? 'opacity-0' : 'opacity-100'}`}
      style={{ transitionDuration: '400ms' }}
      aria-hidden="true"
    >
      {/* Reactor ring spin-up */}
      <div className="relative w-20 h-20 mb-8">
        <svg viewBox="0 0 80 80" className="w-full h-full" style={{ animation: 'spin 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}>
          <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(351 92% 48% / 0.15)" strokeWidth="2" />
          <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(351 92% 48%)" strokeWidth="2"
            strokeDasharray="60 154" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px hsl(351 92% 48% / 0.8))' }} />
          {/* Tick marks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180
            return (
              <line key={i}
                x1={40 + Math.cos(a) * 28} y1={40 + Math.sin(a) * 28}
                x2={40 + Math.cos(a) * 31} y2={40 + Math.sin(a) * 31}
                stroke="hsl(351 92% 48% / 0.5)" strokeWidth="1.5" />
            )
          })}
        </svg>
      </div>
      <div className="space-y-1.5 min-h-[88px]">
        {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
          <p key={i} className="text-[11px] tracking-[0.18em] text-[hsl(351,92%,60%)]" style={{ fontFamily: 'var(--font-telemetry)' }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

export default function CockpitChrome() {
  const [booting, setBooting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      if (!sessionStorage.getItem(BOOT_KEY)) {
        setBooting(true)
        sessionStorage.setItem(BOOT_KEY, '1')
      }
    } catch { /* private mode — skip boot */ }
  }, [])

  if (!mounted) return null

  return (
    <>
      {booting && <BootSequence onDone={() => setBooting(false)} />}

      {/* Viewport corner brackets — cockpit glass frame */}
      <div className="fixed inset-0 z-40 pointer-events-none hidden dark:block print:hidden" aria-hidden="true">
        <span className="absolute top-2 left-2 w-5 h-5 border-t border-l border-brand/50" />
        <span className="absolute top-2 right-2 w-5 h-5 border-t border-r border-brand/50" />
        <span className="absolute bottom-2 left-2 w-5 h-5 border-b border-l border-brand/50" />
        <span className="absolute bottom-2 right-2 w-5 h-5 border-b border-r border-brand/50" />
      </div>

      {/* Scanline texture — barely perceptible */}
      <div
        className="fixed inset-0 z-30 pointer-events-none hidden dark:block print:hidden"
        aria-hidden="true"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)',
        }}
      />
    </>
  )
}
