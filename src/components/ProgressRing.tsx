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
 * Animates from 0 on mount. Uses a linear-gradient via SVG defs.
 */
export default function ProgressRing({
  value,
  size = 80,
  strokeWidth = 5,
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
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5A00" />
            <stop offset="100%" stopColor="#E8920A" />
          </linearGradient>
          <filter id={`glow-amber-${size}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />

        {/* Arc */}
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
