import React from 'react';

/**
 * Dad Strength DS lettermark — chrome steel ring with gold center bar.
 * Transparent background — works on any surface.
 * All SVG IDs are prefixed Logo_ to prevent conflicts when rendered multiple times.
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
      viewBox="0 0 2000 2000"
      className={className}
      aria-label="Dad Strength"
    >
      <defs>
        <linearGradient id="Logo_ringGrad" x1="300" y1="300" x2="1700" y2="1700" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f4f6f8"/>
          <stop offset="12%" stopColor="#bcc3c9"/>
          <stop offset="26%" stopColor="#59626b"/>
          <stop offset="39%" stopColor="#e8ecef"/>
          <stop offset="56%" stopColor="#5d6670"/>
          <stop offset="73%" stopColor="#c2c9cf"/>
          <stop offset="88%" stopColor="#3f474f"/>
          <stop offset="100%" stopColor="#d7dde1"/>
        </linearGradient>
        <linearGradient id="Logo_innerSteel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d7dbe0"/>
          <stop offset="20%" stopColor="#8e969f"/>
          <stop offset="50%" stopColor="#5d6670"/>
          <stop offset="80%" stopColor="#b8bfc7"/>
          <stop offset="100%" stopColor="#717a84"/>
        </linearGradient>
        <radialGradient id="Logo_faceGrad" cx="45%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#22272d"/>
          <stop offset="45%" stopColor="#15191e"/>
          <stop offset="100%" stopColor="#0d1014"/>
        </radialGradient>
        <linearGradient id="Logo_letterGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d8dde2"/>
          <stop offset="15%" stopColor="#a9b0b7"/>
          <stop offset="40%" stopColor="#6f7780"/>
          <stop offset="70%" stopColor="#b4bbc2"/>
          <stop offset="100%" stopColor="#7a838c"/>
        </linearGradient>
        <linearGradient id="Logo_goldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1d088"/>
          <stop offset="25%" stopColor="#c79228"/>
          <stop offset="50%" stopColor="#8d6218"/>
          <stop offset="75%" stopColor="#d9ac46"/>
          <stop offset="100%" stopColor="#7e5913"/>
        </linearGradient>
        <filter id="Logo_shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#000000" floodOpacity="0.65"/>
        </filter>
        <filter id="Logo_softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#000000" floodOpacity="0.45"/>
        </filter>
        <filter id="Logo_bevel">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
          <feSpecularLighting in="blur" surfaceScale={4} specularConstant={0.8} specularExponent={30} lightingColor="#ffffff" result="spec">
            <fePointLight x={500} y={350} z={250}/>
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip"/>
          <feBlend in="SourceGraphic" in2="specClip" mode="screen"/>
        </filter>
        <filter id="Logo_grain">
          <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={8} result="noise"/>
          <feColorMatrix type="saturate" values="0" in="noise" result="mono"/>
          <feComponentTransfer in="mono" result="grainAlpha">
            <feFuncA type="table" tableValues="0 0.03"/>
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="grainAlpha" mode="screen"/>
        </filter>
        <clipPath id="Logo_faceClip"><circle cx="1000" cy="1000" r="695"/></clipPath>
      </defs>

      <g filter="url(#Logo_shadow)">
        <circle cx="1000" cy="1000" r="705" fill="none" stroke="url(#Logo_ringGrad)" strokeWidth="44"/>
        <circle cx="1000" cy="1000" r="705" fill="none" stroke="#f2f4f7" strokeOpacity="0.55" strokeWidth="4"/>
        <circle cx="1000" cy="1000" r="683" fill="none" stroke="#222831" strokeWidth="10"/>
      </g>

      <g clipPath="url(#Logo_faceClip)">
        <circle cx="1000" cy="1000" r="695" fill="url(#Logo_faceGrad)"/>
        <rect x="305" y="305" width="1390" height="1390" fill="#11151a" opacity="0.18" filter="url(#Logo_grain)"/>
        <ellipse cx="890" cy="720" rx="430" ry="300" fill="#3a414a" opacity="0.10"/>
        <ellipse cx="1190" cy="1320" rx="520" ry="410" fill="#000000" opacity="0.25"/>
        <path d="M1000 305 L1000 1695" stroke="#080a0d" strokeWidth="10" opacity="0.8"/>
      </g>

      {/* center divider */}
      <g filter="url(#Logo_softShadow)">
        <rect x="970" y="350" width="60" height="1300" rx="16" fill="url(#Logo_innerSteel)" stroke="#d5dbe0" strokeOpacity="0.4" strokeWidth="3"/>
        <rect x="993" y="350" width="14" height="1300" rx="7" fill="url(#Logo_goldGrad)"/>
        <path d="M970 350 L1030 350" stroke="#eef2f5" strokeOpacity="0.35" strokeWidth="2"/>
      </g>

      {/* central hub */}
      <g filter="url(#Logo_shadow)">
        <circle cx="1000" cy="1000" r="126" fill="url(#Logo_innerSteel)" stroke="#d7dde1" strokeOpacity="0.45" strokeWidth="4"/>
        <circle cx="1000" cy="1000" r="92" fill="#0c1014"/>
        <circle cx="1000" cy="1000" r="92" fill="none" stroke="#232830" strokeWidth="3"/>
      </g>

      {/* D */}
      <g filter="url(#Logo_softShadow)">
        <path fill="url(#Logo_letterGrad)" stroke="#d5dbe0" strokeOpacity="0.45" strokeWidth="3" fillRule="evenodd"
          d="
          M 585 745
          L 785 745
          C 866 745, 907 787, 907 870
          L 907 1130
          C 907 1213, 866 1255, 785 1255
          L 585 1255
          Z

          M 660 815
          L 779 815
          C 820 815, 837 833, 837 874
          L 837 1126
          C 837 1167, 820 1185, 779 1185
          L 660 1185
          Z" />
        <path d="M585 745 L785 745 C866 745, 907 787, 907 870 L907 1130 C907 1213, 866 1255, 785 1255 L585 1255 Z"
          fill="none" stroke="#49515a" strokeWidth="1.5" opacity="0.7"/>
      </g>

      {/* S */}
      <g filter="url(#Logo_softShadow)">
        <path fill="url(#Logo_letterGrad)" stroke="#d5dbe0" strokeOpacity="0.45" strokeWidth="3" fillRule="evenodd"
          d="
          M 1115 760
          L 1372 760
          L 1372 838
          L 1218 838
          C 1188 838, 1175 851, 1175 882
          L 1175 903
          C 1175 934, 1188 947, 1218 947
          L 1328 947
          C 1392 947, 1430 984, 1430 1045
          L 1430 1157
          C 1430 1218, 1392 1255, 1328 1255
          L 1115 1255
          L 1115 1177
          L 1295 1177
          C 1332 1177, 1352 1159, 1352 1126
          L 1352 1074
          C 1352 1040, 1332 1022, 1295 1022
          L 1205 1022
          C 1140 1022, 1100 985, 1100 922
          L 1100 862
          C 1100 799, 1148 760, 1215 760
          Z"/>
      </g>

      {/* highlights */}
      <path d="M470 830 A700 700 0 0 1 820 420" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="18" strokeLinecap="round"/>
      <path d="M1180 1580 A700 700 0 0 0 1525 1170" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="14" strokeLinecap="round"/>
      <circle cx="1000" cy="1000" r="705" fill="none" stroke="#000000" strokeOpacity="0.35" strokeWidth="12"/>
    </svg>
  );
}
