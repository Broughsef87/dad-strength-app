/**
 * BarbellMark — Olympic barbell silhouette with circular disc plates.
 * Absolute-positioned inside overflow:hidden containers as a watermark.
 * All strokes are translucent AMG amber — purely decorative.
 */
export function BarbellMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* ── LEFT SIDE ─────────────────────────────────────────────── */}

      {/* Outer disc — large Olympic plate */}
      <ellipse cx="42" cy="70" rx="40" ry="64"
        stroke="rgba(200,130,10,0.18)" strokeWidth="1.5" />
      {/* Inner ring on disc */}
      <ellipse cx="42" cy="70" rx="28" ry="46"
        stroke="rgba(200,130,10,0.11)" strokeWidth="1.2" />
      {/* Center hub hole */}
      <circle cx="42" cy="70" r="7"
        stroke="rgba(200,130,10,0.20)" strokeWidth="1.5" />

      {/* Thin bumper plate */}
      <ellipse cx="86" cy="70" rx="9" ry="26"
        stroke="rgba(200,130,10,0.13)" strokeWidth="1.5" />

      {/* Collar */}
      <rect x="97" y="55" width="9" height="30" rx="2"
        fill="rgba(200,130,10,0.07)"
        stroke="rgba(200,130,10,0.22)" strokeWidth="1" />

      {/* ── BAR ───────────────────────────────────────────────────── */}
      <line x1="106" y1="70" x2="294" y2="70"
        stroke="rgba(200,130,10,0.26)" strokeWidth="3.5"
        strokeLinecap="round" />

      {/* Knurling — cross-hatch marks at center section */}
      {[130, 148, 166, 184, 200, 218, 234, 252, 270].map(x => (
        <line key={x} x1={x} y1="63" x2={x} y2="77"
          stroke="rgba(200,130,10,0.09)" strokeWidth="1" />
      ))}

      {/* ── RIGHT SIDE ────────────────────────────────────────────── */}

      {/* Collar */}
      <rect x="294" y="55" width="9" height="30" rx="2"
        fill="rgba(200,130,10,0.07)"
        stroke="rgba(200,130,10,0.22)" strokeWidth="1" />

      {/* Thin bumper plate */}
      <ellipse cx="314" cy="70" rx="9" ry="26"
        stroke="rgba(200,130,10,0.13)" strokeWidth="1.5" />

      {/* Center hub hole */}
      <circle cx="358" cy="70" r="7"
        stroke="rgba(200,130,10,0.20)" strokeWidth="1.5" />
      {/* Inner ring on disc */}
      <ellipse cx="358" cy="70" rx="28" ry="46"
        stroke="rgba(200,130,10,0.11)" strokeWidth="1.2" />
      {/* Outer disc — large Olympic plate */}
      <ellipse cx="358" cy="70" rx="40" ry="64"
        stroke="rgba(200,130,10,0.18)" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * ForgeDiamond — concentric diamond emblem. Use as a section watermark.
 */
export function ForgeDiamond({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <polygon points="100,8 192,100 100,192 8,100"
        stroke="rgba(200,130,10,0.18)" strokeWidth="1.5" />
      <polygon points="100,36 164,100 100,164 36,100"
        stroke="rgba(200,130,10,0.12)" strokeWidth="1.5" />
      <polygon points="100,64 136,100 100,136 64,100"
        stroke="rgba(200,130,10,0.08)" strokeWidth="1.5" />
      <line x1="100" y1="80" x2="100" y2="120" stroke="rgba(200,130,10,0.12)" strokeWidth="1" />
      <line x1="80"  y1="100" x2="120" y2="100" stroke="rgba(200,130,10,0.12)" strokeWidth="1" />
      <circle cx="100" cy="100" r="4" fill="rgba(200,130,10,0.22)" />
    </svg>
  )
}

/**
 * SectionLabel — editorial chapter marker for dashboard sections.
 * Renders: [I] — ACTIVE PROTOCOL ──────────
 * Pair with cards carrying matching 01/02/03 depth numerals.
 */
export function SectionLabel({
  numeral,
  title,
  className = '',
}: {
  numeral: string
  title: string
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2 px-1 ${className}`}>
      <span
        className="text-[11px] font-display tracking-[0.3em] text-brand"
        style={{ textShadow: '0 0 6px rgba(200,130,10,0.4)' }}
      >
        {numeral}
      </span>
      <span
        className="h-px w-3"
        style={{
          background:
            'linear-gradient(90deg, rgba(200,130,10,0.55) 0%, rgba(200,130,10,0.1) 100%)',
        }}
      />
      <span className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground font-display font-semibold">
        {title}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

/**
 * SectionDivider — thin hairline with a centered diamond mark.
 * Use between major content sections.
 */
export function SectionDivider({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <line x1="0" y1="10" x2="136" y2="10"
        stroke="rgba(200,130,10,0.15)" strokeWidth="0.75" />
      <polygon points="150,4 157,10 150,16 143,10"
        fill="rgba(200,130,10,0.28)" />
      <line x1="164" y1="10" x2="300" y2="10"
        stroke="rgba(200,130,10,0.15)" strokeWidth="0.75" />
    </svg>
  )
}
