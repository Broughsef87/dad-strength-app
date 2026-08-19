'use client'

// ── Chart primitives ──────────────────────────────────────────────────────────
// Hand-drawn SVG, no chart library. The house rules, baked in so no caller can
// get them wrong:
//   · lines 2px, round cap/join · end markers r>=4 with a 2px SURFACE ring
//   · columns <=24px, 4px rounded data-end, SQUARE at the baseline, 2px gap
//   · gridlines hairline and SOLID (never dashed), one step off the surface
//   · marks carry the accent; text never does — labels wear ink tokens
//   · every value is reachable without hovering; tooltips only enhance
// Colour comes from CSS custom properties, so chalk and graphite are both
// correct without authoring a second palette.

import { useCallback, useEffect, useRef, useState } from 'react'

/** Actual pixel width of a block element. Sparklines draw in pixel space so
 *  strokes and end-dots never distort the way preserveAspectRatio="none" does. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width))
    ro.observe(el)
    setW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const toPath = (pts: { x: number; y: number }[]) =>
  pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')

// ── Sparkline ─────────────────────────────────────────────────────────────────
// The trend inside a stat tile: the series recedes in muted ink and only the
// CURRENT point wears volt. One series, so no legend — the tile's label already
// says what is plotted.

export interface SparkPoint { y: number; label: string }

export function Sparkline({
  points, height = 40, ariaLabel,
}: { points: SparkPoint[]; height?: number; ariaLabel: string }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const PAD = 7 // room for the end dot plus its surface ring
  const inner = Math.max(w - PAD * 2, 1)
  const ys = points.map(p => p.y)
  const lo = ys.length ? Math.min(...ys) : 0
  const hi = ys.length ? Math.max(...ys) : 0
  const span = hi - lo || 1

  // A flat series sits mid-band rather than pinned to the floor.
  const xy = points.map((p, i) => ({
    x: PAD + (points.length === 1 ? inner / 2 : (i / (points.length - 1)) * inner),
    y: hi === lo ? height / 2 : PAD + (1 - (p.y - lo) / span) * (height - PAD * 2),
  }))

  const onMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - box.left
    let best = 0
    let bestD = Infinity
    xy.forEach((p, i) => {
      const d = Math.abs(p.x - x)
      if (d < bestD) { bestD = d; best = i }
    })
    setHover(best)
  }, [xy])

  if (!points.length) return <div ref={ref} style={{ height }} />

  const last = xy[xy.length - 1]
  const act = hover != null ? xy[hover] : null

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {w > 0 && (
        <svg
          width={w} height={height} role="img" aria-label={ariaLabel}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}
          style={{ touchAction: 'pan-y', display: 'block' }}
        >
          {points.length > 1 && (
            <path
              d={toPath(xy)} fill="none"
              stroke="hsl(var(--muted-foreground))" strokeOpacity={0.55}
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            />
          )}
          {act && (
            <line
              x1={act.x} x2={act.x} y1={0} y2={height}
              stroke="hsl(var(--muted-foreground))" strokeOpacity={0.35} strokeWidth={1}
            />
          )}
          <circle cx={last.x} cy={last.y} r={5.5} fill="hsl(var(--card))" />
          <circle cx={last.x} cy={last.y} r={3.5} fill="hsl(var(--brand))" />
          {act && hover !== points.length - 1 && (
            <>
              <circle cx={act.x} cy={act.y} r={5} fill="hsl(var(--card))" />
              <circle cx={act.x} cy={act.y} r={3} fill="hsl(var(--foreground))" />
            </>
          )}
        </svg>
      )}
      {hover != null && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md px-2 py-1 text-[11px] shadow-lg"
          style={{
            left: Math.min(Math.max(xy[hover].x - 34, 0), Math.max(w - 76, 0)),
            top: -6,
            transform: 'translateY(-100%)',
            background: 'hsl(var(--foreground))',
            color: 'hsl(var(--background))',
          }}
        >
          <span className="font-semibold">{Math.round(points[hover].y)}</span>
          <span className="opacity-70"> · {points[hover].label}</span>
        </div>
      )}
    </div>
  )
}

// ── Column chart ──────────────────────────────────────────────────────────────
// Magnitude across a handful of named categories: one hue, value on the cap, no
// legend. The container includes the label band, so the card never grows its own
// little scrollbar.

export interface Column { label: string; value: number; sub?: string }

export function ColumnChart({
  data, height = 104, format = (v: number) => String(v), ariaLabel,
}: {
  data: Column[]
  height?: number
  format?: (v: number) => string
  ariaLabel: string
}) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const GAP = 2
  const CAP = 24
  const LABEL_BAND = 18
  const max = Math.max(...data.map(d => d.value), 1)
  const band = data.length ? w / data.length : 0
  const bw = Math.min(CAP, Math.max(band - GAP * 2, 2))
  const plot = height - LABEL_BAND

  return (
    <div ref={ref} style={{ height }} className="relative select-none">
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
          <line x1={0} x2={w} y1={plot} y2={plot} stroke="hsl(var(--border))" strokeWidth={1} />
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max((d.value / max) * (plot - 16), 3) : 0
            const x = i * band + (band - bw) / 2
            const y = plot - h
            const on = hover === i
            const r = Math.min(4, bw / 2)
            return (
              <g
                key={d.label}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                tabIndex={0}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ outline: 'none' }}
              >
                {/* hit target spans the whole band — never just the painted bar */}
                <rect x={i * band} y={0} width={band} height={height} fill="transparent" />
                {h > 0 && (
                  <path
                    d={
                      'M' + x + ',' + plot +
                      ' L' + x + ',' + (y + r) +
                      ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
                      ' L' + (x + bw - r) + ',' + y +
                      ' Q' + (x + bw) + ',' + y + ' ' + (x + bw) + ',' + (y + r) +
                      ' L' + (x + bw) + ',' + plot + ' Z'
                    }
                    fill="hsl(var(--brand))"
                    fillOpacity={on ? 1 : 0.82}
                  />
                )}
                <text
                  x={i * band + band / 2} y={plot - h - 5} textAnchor="middle"
                  fontSize={10} fontWeight={600} fill="hsl(var(--foreground))"
                >
                  {format(d.value)}
                </text>
                <text
                  x={i * band + band / 2} y={height - 5} textAnchor="middle"
                  fontSize={10} fill="hsl(var(--muted-foreground))"
                >
                  {d.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      {hover != null && data[hover]?.sub && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md px-2 py-1 text-[11px] shadow-lg"
          style={{
            left: Math.min(Math.max(hover * band + band / 2 - 40, 0), Math.max(w - 88, 0)),
            top: -4,
            transform: 'translateY(-100%)',
            background: 'hsl(var(--foreground))',
            color: 'hsl(var(--background))',
          }}
        >
          {data[hover].sub}
        </div>
      )}
    </div>
  )
}
