// ── The Program Card brand asset generator ─────────────────────────────────
// Writes the SVG suite from ONE source of truth so the mark can never drift
// between the app component and the raster assets. Geometry here mirrors
// src/components/Logo.tsx; the difference is that these bake literal colors
// (CSS vars don't resolve inside a favicon or an OG image).
//
//   node scripts/generate-logo-suite.mjs
//
// PNG/ICO rasterization is a separate step — see rasterize-logo-suite.html,
// which renders these SVGs to canvas and downloads the bitmaps.
//
// FOR-186: the mark is now a LETTERHEAD. Ink monogram on paper, corner cut
// rather than moulded. The monogram is deliberately NOT stamp red: the logo
// appears in the header of every screen, and red on every screen is exactly
// how the stamp stops meaning verdict. A letterhead is single-ink anyway.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/logo-suite');
const C = {
  graphite:  '#141310',   // the desk, unlit
  tileDark:  '#23201A',   // paper under the lamp
  chalk:     '#F0EDE6',   // the desk
  tileLight: '#EBE0C4',   // paper
  inkDark:   '#E7E2D6',
  inkLight:  '#221F18',
  voltDark:  '#E7E2D6',   // the monogram is ink now, not an accent
  voltLight: '#221F18',
};

// Monogram paths, shared with the component.
const DS = (fill) => `
  <path d="M0,0 H70 L100,30 V110 L70,140 H0 Z M26,26 H60 L74,40 V100 L60,114 H26 Z"
        transform="translate(206.5,292.6) scale(3.05)" fill="${fill}" fill-rule="evenodd" />
  <path d="M24,0 H100 V26 H26 V57 H100 V116 L76,140 H0 V114 H74 V83 H0 V24 Z"
        transform="translate(567.5,292.6) scale(3.05)" fill="${fill}" fill-rule="evenodd" />`;

const mark = ({ tile, volt, ink, transparent = false }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${transparent ? '' : `<rect x="32" y="32" width="960" height="960" rx="24" fill="${tile}" />`}
  ${DS(volt)}
  <rect x="206.5" y="765.6" width="611" height="16" rx="8" fill="${ink}" opacity="0.22" />
</svg>`;

// App icon: never transparent — home screens need an opaque tile.
//
// PAPER, not the dark tile. The old comment argued graphite "reads on both iOS
// light and dark wallpapers", which is true and is also why every icon on the
// device is dark. A cream sheet with an ink monogram is the one thing on that
// home screen that looks like paper, and this app's entire claim is that it is
// a printed card. Distinctiveness beats safety for a mark you are asking
// someone to pick out of a grid of forty.
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" rx="24" fill="${C.tileLight}" />
  ${DS(C.voltLight)}
  <rect x="206.5" y="765.6" width="611" height="16" rx="8" fill="${C.inkLight}" opacity="0.22" />
</svg>`;

// Favicon: no ground bar, bigger monogram — detail dies at 32px.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="512" height="512">
  <rect width="1024" height="1024" rx="24" fill="${C.tileLight}" />
  <g transform="translate(512,512) scale(1.18) translate(-512,-512)">${DS(C.voltLight)}</g>
</svg>`;

const horizontal = ({ bg, ink, volt, tile }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" width="1200" height="300">
  <rect width="1200" height="300" fill="${bg}" />
  <g transform="translate(60,42) scale(0.212)">
    <rect x="32" y="32" width="960" height="960" rx="24" fill="${tile}" />
    ${DS(volt)}
  </g>
  <text x="330" y="178" font-family="Space Grotesk, Segoe UI, system-ui, sans-serif"
        font-size="96" font-weight="700" letter-spacing="-4" fill="${ink}">dad strength</text>
</svg>`;

const banner = ({ bg, ink, volt, tile }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" width="1500" height="500">
  <rect width="1500" height="500" fill="${bg}" />
  <g transform="translate(180,140) scale(0.229)">
    <rect x="32" y="32" width="960" height="960" rx="24" fill="${tile}" />
    ${DS(volt)}
  </g>
  <text x="450" y="268" font-family="Space Grotesk, Segoe UI, system-ui, sans-serif"
        font-size="104" font-weight="700" letter-spacing="-4" fill="${ink}">dad strength</text>
  <text x="452" y="330" font-family="Geist Mono, ui-monospace, monospace"
        font-size="30" letter-spacing="2" fill="${ink}" opacity="0.55">built for the long haul</text>
</svg>`;

const files = {
  'ds_app_icon.svg': appIcon,
  'ds_favicon.svg': favicon,
  'ds_mark_dark.svg': mark({ tile: C.tileDark, volt: C.voltDark, ink: C.inkDark }),
  'ds_mark_light.svg': mark({ tile: C.tileLight, volt: C.voltLight, ink: C.inkLight }),
  'ds_mark_transparent.svg': mark({ volt: C.voltDark, ink: C.inkDark, transparent: true }),
  'ds_horizontal_dark.svg': horizontal({ bg: C.graphite, ink: C.inkDark, volt: C.voltDark, tile: C.tileDark }),
  'ds_horizontal_light.svg': horizontal({ bg: C.chalk, ink: C.inkLight, volt: C.voltLight, tile: C.tileLight }),
  'ds_banner_dark.svg': banner({ bg: C.graphite, ink: C.inkDark, volt: C.voltDark, tile: C.tileDark }),
  'ds_banner_light.svg': banner({ bg: C.chalk, ink: C.inkLight, volt: C.voltLight, tile: C.tileLight }),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, svg] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), svg.trim() + '\n');
  console.log('wrote', name);
}
console.log(`\n${Object.keys(files).length} SVGs → public/logo-suite`);
console.log('Rasterize next: open scripts/rasterize-logo-suite.html');
