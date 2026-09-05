import React from 'react';

/**
 * Dad Strength mark — the design system's plate stack.
 *
 * Three bars of decreasing width in brand-ink on a volt field: plates on a
 * bar, a log, progress. Pure geometry, no letterforms, and it survives at
 * 20px (design-system/readme.md, "Brand marks"; the file is
 * design-system/assets/ds-mark-volt.svg). The volt field is the ONE volt
 * fill the mark has, and it is a fill — brand-ink sits on it, as on every
 * volt fill in the app.
 *
 * Theme-aware through the tokens: --brand is the chalk volt on the light
 * ground and the graphite volt on the dark one, which is exactly the DS's
 * ds-mark-volt.svg / ds-mark-volt-graphite.svg pair. Geometry is mirrored by
 * scripts/generate-logo-suite.mjs, and scripts/checks/design-system.mjs
 * asserts both against the DS file — the mark cannot drift.
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
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Dad Strength"
    >
      {/* the field — volt, 20px radius at 64 */}
      <rect width="64" height="64" rx="20" fill="hsl(var(--brand))" />
      {/* the plate stack — brand-ink, the only ink that sits on volt */}
      <rect x="14" y="18" width="36" height="7" rx="2" fill="hsl(var(--brand-ink))" />
      <rect x="14" y="29" width="25" height="7" rx="2" fill="hsl(var(--brand-ink))" />
      <rect x="14" y="40" width="16" height="7" rx="2" fill="hsl(var(--brand-ink))" />
    </svg>
  );
}
