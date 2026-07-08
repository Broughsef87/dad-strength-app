import React from 'react';

/**
 * Dad Strength DS mark v2 — chamfered plate, rosso monogram.
 * Theme-aware: the plate reads carbon in dark mode and titanium in light
 * mode via CSS tokens, so one component works on every surface.
 * Geometry matches the raster suite generator (public/logo-suite/logo-v2.mjs).
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
      <defs>
        <linearGradient id="LogoV2_rosso" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EA0B2F" />
          <stop offset="100%" stopColor="#B00822" />
        </linearGradient>
      </defs>

      {/* Plate — chamfered on TR + BL (the app's panel-cut signature) */}
      <path
        d="M28,28 H878 L996,146 V996 H146 L28,878 Z"
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth="10"
      />
      <path
        d="M52,52 H864 L972,160 V972 H160 L52,864 Z"
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="3"
        opacity="0.55"
      />

      {/* DS monogram */}
      <path
        d="M0,0 H70 L100,30 V110 L70,140 H0 Z M26,26 H60 L74,40 V100 L60,114 H26 Z"
        transform="translate(206.5,292.6) scale(3.05)"
        fill="url(#LogoV2_rosso)"
        fillRule="evenodd"
      />
      <path
        d="M24,0 H100 V26 H26 V57 H100 V116 L76,140 H0 V114 H74 V83 H0 V24 Z"
        transform="translate(567.5,292.6) scale(3.05)"
        fill="url(#LogoV2_rosso)"
        fillRule="evenodd"
      />

      {/* Chamfer accents + ground bar */}
      <path d="M878,28 L996,146 L996,104 L920,28 Z" fill="#EA0B2F" />
      <path d="M28,878 L146,996 L104,996 L28,920 Z" fill="#EA0B2F" />
      <rect
        x="206.5"
        y="765.6"
        width="611"
        height="16"
        fill="hsl(var(--foreground))"
        opacity="0.3"
      />
    </svg>
  );
}
