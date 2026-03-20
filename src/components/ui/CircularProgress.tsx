interface CircularProgressProps {
  value: number      // 0–100
  size?: number      // px, default 64
  strokeWidth?: number
  color?: string     // tailwind color value or CSS color
  trackColor?: string
  label?: string
  sublabel?: string
}

export default function CircularProgress({
  value,
  size = 64,
  strokeWidth = 5,
  color = 'hsl(16 80% 54%)',
  trackColor = 'hsl(240 5% 90%)',
  label,
  sublabel
}: CircularProgressProps) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const clampedValue = Math.min(value, 100)
  const offset = circumference - (clampedValue / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.25,0.46,0.45,0.94)' }}
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute flex flex-col items-center justify-center text-center">
          {label && <span className="text-sm font-bold leading-none tabular-nums">{label}</span>}
          {sublabel && <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground mt-0.5">{sublabel}</span>}
        </div>
      )}
    </div>
  )
}
