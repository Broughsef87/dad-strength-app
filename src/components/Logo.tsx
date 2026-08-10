import React from 'react';

/**
 * Dad Strength DS mark — chalk/volt.
 * A soft-cornered tile with the DS monogram in volt. No chamfer, no gradient,
 * no glow: the mark follows the same rules as the UI (shadows not borders,
 * one accent, nothing mech). Theme-aware — the tile reads graphite in dark
 * mode and white in light mode via CSS tokens, so one component works on
 * every surface. Geometry is mirrored by scripts/generate-logo-suite.mjs.
 */
export default function Logo({
  className = 'w-8 h-8',
}: {
  className?: string;
  color?: string; // kept for backwards compat
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      className={className}
      aria-label="Dad Strength"
    >
      {/* Tile — generous radius, same language as the app's cards */}
      <rect x="32" y="32" width="960" height="960" rx="216" fill="hsl(var(--card))" />
      <rect
        x="32" y="32" width="960" height="960" rx="216"
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.06"
        strokeWidth="4"
      />

      {/* DS monogram — the one volt element */}
      <path
        d="M0,0 H70 L100,30 V110 L70,140 H0 Z M26,26 H60 L74,40 V100 L60,114 H26 Z"
        transform="translate(206.5,292.6) scale(3.05)"
        fill="hsl(var(--brand))"
        fillRule="evenodd"
      />
      <path
        d="M24,0 H100 V26 H26 V57 H100 V116 L76,140 H0 V114 H74 V83 H0 V24 Z"
        transform="translate(567.5,292.6) scale(3.05)"
        fill="hsl(var(--brand))"
        fillRule="evenodd"
      />

      {/* Ground bar — quiet, carries the mark's weight */}
      <rect
        x="206.5"
        y="765.6"
        width="611"
        height="16"
        rx="8"
        fill="hsl(var(--foreground))"
        opacity="0.22"
      />
    </svg>
  );
}
