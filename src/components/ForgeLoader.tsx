'use client'

/**
 * ForgeLoader — minimal chalk/volt loading state. A muted ring with a
 * single volt arc rotating over it. Quiet by design.
 *
 * Drop-in replacement for a plain spinner. Use on full-page loads and
 * card-level loading states.
 */
export default function ForgeLoader({
  label = 'loading',
  size = 48,
  className = '',
}: {
  label?: string
  size?: number
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          style={{ position: 'absolute', inset: 0 }}
          aria-hidden="true"
        >
          {/* Muted track ring */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="3"
          />
        </svg>
        {/* Rotating volt arc */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          className="forge-spin"
          style={{ position: 'absolute', inset: 0 }}
          aria-hidden="true"
        >
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="hsl(var(--brand))"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="34 200"
          />
        </svg>
      </div>
      {label && (
        <p className="eyebrow-mono">
          {label.toLowerCase()}
        </p>
      )}
    </div>
  )
}
