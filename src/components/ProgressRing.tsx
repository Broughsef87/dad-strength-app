'use client'

import { useEffect, useState } from 'react'

interface ProgressRingProps {
  /** 0–100 */
  value: number
  size?: number
  strokeWidth?: number
  /** Center top label */
  label?: string
  /** Center bottom micro-label */
  sublabel?: string
  className?: string
}

/**
 * Animated SVG progress ring — glowing amber arc on a dark track.
 * Animates from 0 on mount. Uses a linear-gradient + glow filter.
 * Track is warm steel (amber-tinted) so it reads as part of the forge
 * aesthetic instead of a generic grey ring.
 */
export default function ProgressRing({
  value,
  size = 80,
  strokeWidth = 6,
  label,
  sublabel,
  className = '',
}: ProgressRingProps) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(Math.min(100, Math.max(0, value))), 120)
    return () => clearTimeout(t)
  }, [value])

  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (animated / 100) * circ
  const id = `fg-amber-${size}`

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <defs>
          {/* Main amber arc — dark→bright for lit-from-above look */}
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6B4500" />
            <stop offset="55%" stopColor="#C8820A" />
            <stop offset="100%" stopColor="#F5A820" />
          </linearGradient>
          {/* Inner highlight — thin brighter amber layered on top */}
          <linearGradient id={`${id}-hi`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,220,150,0)" />
            <stop offset="60%" stopColor="rgba(255,220,150,0.35)" />
            <stop offset="100%" stopColor="rgba(255,240,200,0.7)" />
          </linearGradient>
          <filter id={`glow-amber-${size}`}>
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track — warm steel, amber-tinted */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(200,130,10,0.10)"
          strokeWidth={strokeWidth}
        />

        {/* Main arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          filter={`url(#glow-amber-${size})`}
          style={{
            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        />

        {/* Inner highlight — thin lit accent on top of main arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#${id}-hi)`}
          strokeWidth={Math.max(1, strokeWidth / 3)}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        />
      </svg>

      {/* Center text */}
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          {label && (
            <span className="font-display leading-none text-foreground" style={{ fontSize: size * 0.26 }}>
              {label}
            </span>
          )}
          {sublabel && (
            <span className="uppercase tracking-widest text-muted-foreground" style={{ fontSize: size * 0.1 }}>
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
