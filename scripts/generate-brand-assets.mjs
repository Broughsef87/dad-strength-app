import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SVG_TEMPLATE = `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}">
  <path d="M 5 30 L 35 30 L 50 60 L 65 30 L 95 30 L 50 95 Z" fill="url(#orangeGrad)" style="filter: drop-shadow(0px 0px 8px rgba(255,87,34,0.6))" />
  <path d="M 50 10 L 75 45 L 50 80 L 25 45 Z" fill="url(#cyanGrad)" style="filter: drop-shadow(0px 0px 8px rgba(0,255,255,0.6))" />
  <path d="M 50 25 L 65 45 L 50 65 L 35 45 Z" fill="#0a0a0f" />
  <path d="M 50 35 L 57 45 L 50 55 L 43 45 Z" fill="url(#redGrad)" />
  <defs>
    <linearGradient id="orangeGrad" x1="5" y1="30" x2="95" y2="95" gradientUnits="userSpaceOnUse"><stop stop-color="#FF5722" /><stop offset="1" stop-color="#FF1744" /></linearGradient>
    <linearGradient id="cyanGrad" x1="25" y1="10" x2="75" y2="80" gradientUnits="userSpaceOnUse"><stop stop-color="#00FFFF" /><stop offset="1" stop-color="#00838F" /></linearGradient>
    <linearGradient id="redGrad" x1="43" y1="35" x2="57" y2="55" gradientUnits="userSpaceOnUse"><stop stop-color="#FF5252" /><stop offset="1" stop-color="#D50000" /></linearGradient>
  </defs>
</svg>`;

const SIZES = {
  'favicon': 32,
  'icon-192': 192,
  'icon-512': 512,
  'social-square': 1080,
};

const OUT_DIR = path.resolve(__dirname, '../public/branding');

for (const [name, size] of Object.entries(SIZES)) {
  const svgContent = SVG_TEMPLATE.replace(/\{SIZE\}/g, size);
  fs.writeFileSync(path.join(OUT_DIR, `forge-os-${name}.svg`), svgContent);
  console.log(`Generated forge-os-${name}.svg`);
}

const LOCKUP_TEMPLATE = `
<svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="1200" height="300">
  <rect width="400" height="100" fill="#0a0a0f" />
  <g transform="translate(20, 10) scale(0.8)">
    <path d="M 5 30 L 35 30 L 50 60 L 65 30 L 95 30 L 50 95 Z" fill="url(#orangeGrad)" />
    <path d="M 50 10 L 75 45 L 50 80 L 25 45 Z" fill="url(#cyanGrad)" />
    <path d="M 50 25 L 65 45 L 50 65 L 35 45 Z" fill="#0a0a0f" />
    <path d="M 50 35 L 57 45 L 50 55 L 43 45 Z" fill="url(#redGrad)" />
  </g>
  <text x="120" y="65" font-family="Orbitron, sans-serif" font-size="48" font-weight="900" fill="#ffffff" letter-spacing="4">FORGE <tspan fill="#FF5722">OS</tspan></text>
  <defs>
    <linearGradient id="orangeGrad" x1="5" y1="30" x2="95" y2="95" gradientUnits="userSpaceOnUse"><stop stop-color="#FF5722" /><stop offset="1" stop-color="#FF1744" /></linearGradient>
    <linearGradient id="cyanGrad" x1="25" y1="10" x2="75" y2="80" gradient, gradientUnits="userSpaceOnUse"><stop stop-color="#00FFFF" /><stop offset="1" stop-color="#00838F" /></linearGradient>
    <linearGradient id="redGrad" x1="43" y1="35" x2="57" y2="55" gradientUnits="userSpaceOnUse"><stop stop-color="#FF5252" /><stop offset="1" stop-color="#D50000" /></linearGradient>
  </defs>
</svg>
`;

fs.writeFileSync(path.join(OUT_DIR, 'forge-os-lockup-banner.svg'), LOCKUP_TEMPLATE);
console.log('Generated forge-os-lockup-banner.svg');
