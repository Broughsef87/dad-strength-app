// ── Chalk/Volt brand asset generator ───────────────────────────────────────
// Writes the SVG suite from ONE source of truth so the mark can never drift
// between the app component and the raster assets. The mark is the design
// system's plate stack — design-system/assets/ds-mark-volt.svg — and the
// geometry below is that file's, verbatim: a 64-unit tile with a 20 radius and
// three bars of decreasing width. src/components/Logo.tsx renders the same
// rects from CSS tokens; scripts/checks/design-system.mjs asserts all three
// (the DS file, this script, the component) agree.
//
// Colours here are literal — CSS vars do not resolve inside a favicon or an
// OG image — and they are the DS's: tokens/colors.css.
//
//   node scripts/generate-logo-suite.mjs        → SVGs in public/logo-suite
//   node scripts/rasterize-logo-suite.mjs       → PNGs, favicon.ico, PWA icons

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/logo-suite');

// The palette, literal. design-system/tokens/colors.css.
export const C = {
  graphite: '#0E0F10',
  chalk: '#FAF9F6',
  inkDark: '#EDEDEA',   // ink on graphite
  inkLight: '#141412',  // ink on chalk
  voltDark: '#CDFF4D',  // --ds-volt-graphite
  voltLight: '#C6FF3F', // --ds-volt-chalk
  onVolt: '#131608',    // --ds-on-volt — the only ink on a volt fill
  concreteDark: '#8B8B85',
  concreteLight: '#6F6F68',
};

// The plate stack, in the DS's 64-unit space. Shared with the component.
export const BARS = [
  { x: 14, y: 18, width: 36, height: 7, rx: 2 },
  { x: 14, y: 29, width: 25, height: 7, rx: 2 },
  { x: 14, y: 40, width: 16, height: 7, rx: 2 },
];
const stack = (fill) => BARS.map((b) =>
  `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${b.rx}" fill="${fill}" />`).join('\n  ');

// The mark: the field and the stack, 64 units. `field` null → the bare stack.
const markGroup = ({ field, bars }) => `${field ? `<rect width="64" height="64" rx="20" fill="${field}" />\n  ` : ''}${stack(bars)}`;

const mark = ({ field, bars }, size = 1024) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  ${markGroup({ field, bars })}
</svg>`;

// Lockups: mark at 34 beside "dad strength" in Space Grotesk 600 at -0.03em,
// gap 12 (readme, "Brand marks"). Scaled up for the raster sizes.
const horizontal = ({ bg, ink, volt }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" width="1200" height="300">
  <rect width="1200" height="300" fill="${bg}" />
  <g transform="translate(90,54) scale(3)">
  ${markGroup({ field: volt, bars: C.onVolt })}
  </g>
  <text x="330" y="186" font-family="Space Grotesk, Segoe UI, system-ui, sans-serif"
        font-size="104" font-weight="600" letter-spacing="-3.1" fill="${ink}">dad strength</text>
</svg>`;

const banner = ({ bg, ink, volt, concrete }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" width="1500" height="500">
  <rect width="1500" height="500" fill="${bg}" />
  <g transform="translate(180,138) scale(3.5)">
  ${markGroup({ field: volt, bars: C.onVolt })}
  </g>
  <text x="450" y="268" font-family="Space Grotesk, Segoe UI, system-ui, sans-serif"
        font-size="112" font-weight="600" letter-spacing="-3.4" fill="${ink}">dad strength</text>
  <text x="452" y="332" font-family="Geist Mono, Space Mono, ui-monospace, monospace"
        font-size="26" letter-spacing="4.2" fill="${concrete}">DS-01 // built for the long haul</text>
</svg>`;

export const files = {
  // the app icon is the primary mark: chalk volt, and the DS says it reads on
  // both grounds. Opaque, as a home-screen icon must be.
  'ds_app_icon.svg': mark({ field: C.voltLight, bars: C.onVolt }),
  // the favicon is the same mark — the stack survives at 20px, and at 16 the
  // volt tile carries it
  'ds_favicon.svg': mark({ field: C.voltLight, bars: C.onVolt }, 512),
  'ds_mark_light.svg': mark({ field: C.voltLight, bars: C.onVolt }),
  'ds_mark_dark.svg': mark({ field: C.voltDark, bars: C.onVolt }),
  // one-colour, ink field — print and monochrome (ds-mark-ink.svg)
  'ds_mark_ink.svg': mark({ field: C.inkLight, bars: C.chalk }),
  // the glyph alone, for use inside an existing volt fill (ds-mark-bare.svg)
  'ds_mark_transparent.svg': mark({ field: null, bars: C.inkLight }),
  'ds_horizontal_dark.svg': horizontal({ bg: C.graphite, ink: C.inkDark, volt: C.voltDark }),
  'ds_horizontal_light.svg': horizontal({ bg: C.chalk, ink: C.inkLight, volt: C.voltLight }),
  'ds_banner_dark.svg': banner({ bg: C.graphite, ink: C.inkDark, volt: C.voltDark, concrete: C.concreteDark }),
  'ds_banner_light.svg': banner({ bg: C.chalk, ink: C.inkLight, volt: C.voltLight, concrete: C.concreteLight }),
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, svg] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT, name), svg.trim() + '\n');
    console.log('wrote', name);
  }
  console.log(`\n${Object.keys(files).length} SVGs → public/logo-suite`);
  console.log('Rasterize next: node scripts/rasterize-logo-suite.mjs');
}
