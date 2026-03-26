import React from 'react';

/**
 * Dad Strength barbell + hammer icon mark.
 * Transparent background — works on any surface.
 * All colours are hardcoded to the brand palette (navy + #E8572A orange).
 */
export default function Logo({
  className = 'w-8 h-8',
}: {
  className?: string;
  color?: string; // kept for backwards compat — colour is encoded in the mark itself
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className={className}
      aria-label="Dad Strength"
    >
      <g transform="rotate(45, 100, 100)">
        {/* BARBELL */}
        <rect x="55" y="91" width="90" height="18" rx="1" fill="#1C2438" />
        <rect x="69" y="91" width="5" height="18" rx="1" fill="#243050" />
        <rect x="126" y="91" width="5" height="18" rx="1" fill="#243050" />
        <rect x="41" y="77" width="14" height="46" rx="1" fill="#1C2438" />
        <rect x="145" y="77" width="14" height="46" rx="1" fill="#1C2438" />
        <rect x="20" y="68" width="20" height="64" rx="2" fill="#1A2236" />
        <rect x="160" y="68" width="20" height="64" rx="2" fill="#1A2236" />
        <line x1="40" y1="68" x2="40" y2="132" stroke="#E8572A" strokeWidth="1.5" opacity="0.5" />
        <line x1="20" y1="68" x2="20" y2="132" stroke="#E8572A" strokeWidth="2" />
        <line x1="55" y1="77" x2="55" y2="123" stroke="#E8572A" strokeWidth="1.5" opacity="0.5" />
        <line x1="145" y1="77" x2="145" y2="123" stroke="#E8572A" strokeWidth="1.5" opacity="0.5" />
        <line x1="160" y1="68" x2="160" y2="132" stroke="#E8572A" strokeWidth="1.5" opacity="0.5" />
        <line x1="180" y1="68" x2="180" y2="132" stroke="#E8572A" strokeWidth="2" />
        {/* HAMMER */}
        <rect x="68" y="20" width="64" height="28" rx="3" fill="#1E2840" />
        <rect x="93" y="48" width="14" height="132" rx="2" fill="#1E2840" />
        <line x1="107" y1="48" x2="107" y2="180" stroke="#E8572A" strokeWidth="1.5" />
        <line x1="93" y1="48" x2="93" y2="180" stroke="#E8A44E" strokeWidth="1" opacity="0.4" />
        <line x1="70" y1="22" x2="130" y2="22" stroke="#E8A44E" strokeWidth="1.5" opacity="0.55" />
        <line x1="70" y1="22" x2="70" y2="47" stroke="#E8A44E" strokeWidth="1.5" opacity="0.45" />
        <line x1="130" y1="22" x2="130" y2="47" stroke="#E8A44E" strokeWidth="1.5" opacity="0.45" />
        <line x1="68" y1="48" x2="132" y2="48" stroke="#E8572A" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
