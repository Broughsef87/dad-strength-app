'use client'

/**
 * ForgeLoader — branded loading state. Pulsing amber disc with a
 * rotating accent arc over a steel core. Matches the forge aesthetic.
 *
 * Drop-in replacement for a plain spinner. Use on full-page loads and
 * card-level loading states.
 */
export default function ForgeLoader({
  label = 'Loading',
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
        {/* Outer amber pulse ring */}
        <span
          className="absolute inset-0 rounded-full forge-pulse"
          style={{
            background:
              'radial-gradient(circle, rgba(200,130,10,0.25) 0%, rgba(200,130,10,0) 70%)',
          }}
          aria-hidden="true"
        />
        {/* Steel core disc */}
        <span
          className="absolute rounded-full"
          style={{
            width: size * 0.62,
            height: size * 0.62,
            background:
              'radial-gradient(circle at 35% 30%, hsl(220 31% 18%) 0%, hsl(222 21% 8%) 70%)',
            border: '1px solid rgba(200,130,10,0.35)',
            boxShadow:
              '0 0 14px 1px rgba(200,130,10,0.35), inset 0 1px 0 rgba(255,220,150,0.08)',
          }}
          aria-hidden="true"
        />
        {/* Rotating amber arc */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          className="forge-spin"
          style={{ position: 'absolute', inset: 0 }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="forge-loader-arc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(200,130,10,0)" />
              <stop offset="50%" stopColor="#C8820A" />
              <stop offset="100%" stopColor="#F5A820" />
            </linearGradient>
          </defs>
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="url(#forge-loader-arc)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="40 200"
            style={{ filter: 'drop-shadow(0 0 3px rgba(200,130,10,0.6))' }}
          />
        </svg>
      </div>
      {label && (
        <p className="text-muted-foreground text-[9px] uppercase tracking-[0.24em] font-display font-semibold">
          {label}
        </p>
      )}
    </div>
  )
}
