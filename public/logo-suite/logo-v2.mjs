// ── Dad Strength logo v2 generator ─────────────────────────────────────────────
// Cockpit-era mark: chamfered carbon plate, rosso DS monogram, steel hairline.
// Pure geometry — zero font dependencies, so sharp/librsvg renders it
// identically everywhere. Blocky industrial letterforms drawn as paths.
//
// Run: node public/logo-suite/logo-v2.mjs   (from repo root)

import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const dir = dirname(fileURLToPath(import.meta.url))

// ── Palette ────────────────────────────────────────────────────────────────────
const ROSSO = '#EA0B2F'
const ROSSO_DEEP = '#B00822'
const CARBON = '#10141B'
const CARBON_EDGE = '#2A3442'
const STEEL_HI = '#E3EAF2'
const TITANIUM = '#E3EAF2'
const TITANIUM_EDGE = '#B8C4D2'
const INK = '#131826'

// ── Blocky letter engine ───────────────────────────────────────────────────────
// Each glyph is a path on a 100×140 cell, stroke ≈26, chamfered where cut.
const GLYPHS = {
  D: 'M0,0 H70 L100,30 V110 L70,140 H0 Z M26,26 H60 L74,40 V100 L60,114 H26 Z',
  A: 'M0,140 V40 L40,0 H60 L100,40 V140 H74 V92 H26 V140 Z M26,44 L46,26 H54 L74,44 V66 H26 Z',
  S: 'M24,0 H100 V26 H26 V57 H100 V116 L76,140 H0 V114 H74 V83 H0 V24 Z',
  T: 'M0,0 H100 V26 H63 V140 H37 V26 H0 Z',
  R: 'M0,0 H70 L100,30 V72 L80,90 L100,122 V140 H74 L46,96 H26 V140 H0 Z M26,26 H60 L74,38 V60 L60,70 H26 Z',
  E: 'M0,0 H100 V26 H26 V57 H88 V83 H26 V114 H100 V140 H0 Z',
  N: 'M0,140 V0 H28 L72,82 V0 H100 V140 H72 L28,58 V140 Z',
  G: 'M100,26 H26 V114 H74 V88 H48 V62 H100 V140 H0 V0 H100 Z',
  H: 'M0,0 H26 V57 H74 V0 H100 V140 H74 V83 H26 V140 H0 Z',
  ' ': '',
}
const ADV = 122 // 100 wide + 22 gap
const SPACE_ADV = 58

function word(text, x, y, scale, fill) {
  let cursor = 0
  const parts = []
  for (const ch of text) {
    if (ch === ' ') { cursor += SPACE_ADV; continue }
    const d = GLYPHS[ch]
    if (!d) throw new Error(`no glyph: ${ch}`)
    parts.push(`<path d="${d}" transform="translate(${x + cursor * scale},${y}) scale(${scale})" fill="${fill}" fill-rule="evenodd"/>`)
    cursor += ADV
  }
  return { svg: parts.join('\n  '), width: (cursor - 22) * scale }
}
function wordWidth(text, scale) {
  let c = 0
  for (const ch of text) c += ch === ' ' ? SPACE_ADV : ADV
  return (c - 22) * scale
}

// ── The mark: chamfered plate + DS monogram ────────────────────────────────────
// 1024 grid. Plate cut on TR + BL corners (the app's panel-cut signature).
function mark({ plate, edge, mono, size = 1024, transparent = false }) {
  const C = 118 // chamfer
  const platePath = `M28,28 H${1024 - C - 28} L${1024 - 28},${C + 28} V${1024 - 28} H${C + 28} L28,${1024 - C - 28} Z`
  // DS monogram: two glyphs at scale 3.05 → height 427, width 2*100*3.05 + 60
  const s = 3.05
  const w = 2 * 100 * s + 56
  const x0 = (1024 - w) / 2
  const y0 = (1024 - 140 * s) / 2 + 8
  const D = `<path d="${GLYPHS.D}" transform="translate(${x0},${y0}) scale(${s})" fill="url(#rosso)" fill-rule="evenodd"/>`
  const S = `<path d="${GLYPHS.S}" transform="translate(${x0 + 100 * s + 56},${y0}) scale(${s})" fill="url(#rosso)" fill-rule="evenodd"/>`
  // Corner accents at the two chamfers + underline bar (the barbell)
  const accents = `
  <path d="M${1024 - C - 28},28 L${1024 - 28},${C + 28} L${1024 - 28},${C - 14} L${1024 - C + 14},28 Z" fill="${ROSSO}"/>
  <path d="M28,${1024 - C - 28} L${C + 28},${1024 - 28} L${C - 14},${1024 - 28} L28,${1024 - C + 14} Z" fill="${ROSSO}"/>
  <rect x="${x0}" y="${y0 + 140 * s + 46}" width="${w}" height="16" fill="${mono === 'light' ? INK : STEEL_HI}" opacity="0.35"/>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}">
  <defs>
    <linearGradient id="rosso" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${ROSSO}"/><stop offset="100%" stop-color="${ROSSO_DEEP}"/>
    </linearGradient>
    <linearGradient id="plate" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${plate[0]}"/><stop offset="100%" stop-color="${plate[1]}"/>
    </linearGradient>
  </defs>
  ${transparent ? '' : `<path d="${platePath}" fill="url(#plate)" stroke="${edge}" stroke-width="10"/>
  <path d="M52,52 H${1024 - C - 42} L${1024 - 52},${C + 42} V${1024 - 52} H${C + 42} L52,${1024 - C - 42} Z" fill="none" stroke="${edge}" stroke-width="3" opacity="0.55"/>`}
  ${D}
  ${S}
  ${transparent ? '' : accents}
</svg>`
}

// ── Banner (OG image): mark + geometric wordmark on carbon ─────────────────────
function banner() {
  const markSize = 300
  const gap = 72
  const margin = 70
  const avail = 1500 - margin * 2 - markSize - gap
  const scale = avail / wordWidth('DAD STRENGTH', 1)
  const wordW = wordWidth('DAD STRENGTH', scale)
  const x0 = margin
  const wm = word('DAD STRENGTH', x0 + markSize + gap, 195, scale, STEEL_HI)
  // re-color the DS inside the small mark by inlining a scaled mark group
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" width="1500" height="500">
  <defs>
    <linearGradient id="rosso" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${ROSSO}"/><stop offset="100%" stop-color="${ROSSO_DEEP}"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#151A23"/><stop offset="100%" stop-color="#0B0E14"/>
    </linearGradient>
    <linearGradient id="plate" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1A212C"/><stop offset="100%" stop-color="${CARBON}"/>
    </linearGradient>
  </defs>
  <rect width="1500" height="500" fill="url(#bg)"/>
  <rect x="0" y="0" width="1500" height="3" fill="${ROSSO}" opacity="0.85"/>
  <rect x="0" y="497" width="1500" height="3" fill="${ROSSO}" opacity="0.85"/>
  <g transform="translate(${x0},${(500 - markSize) / 2}) scale(${markSize / 1024})">
    ${mark({ plate: ['#1A212C', CARBON], edge: CARBON_EDGE, mono: 'dark' }).replace(/^[\s\S]*?<defs>[\s\S]*?<\/defs>/, '').replace('</svg>', '')}
  </g>
  ${wm.svg}
  <rect x="${x0 + markSize + gap}" y="335" width="${wordW}" height="6" fill="${ROSSO}"/>
</svg>`
}

// ── Emit ───────────────────────────────────────────────────────────────────────
const darkMark = mark({ plate: ['#1A212C', CARBON], edge: CARBON_EDGE, mono: 'dark' })
const lightMark = mark({ plate: [TITANIUM, '#CBD5E1'], edge: TITANIUM_EDGE, mono: 'light' })

writeFileSync(join(dir, 'ds_mark.svg'), darkMark)
writeFileSync(join(dir, 'ds_mark_light.svg'), lightMark)
writeFileSync(join(dir, 'ds_app_icon.svg'), darkMark)
writeFileSync(join(dir, 'ds_banner_dark.svg'), banner())

const jobs = [
  ['ds_mark.svg', 'ds_mark.png', 800],
  ['ds_app_icon.svg', 'ds_app_icon.png', 1024],
  ['ds_banner_dark.svg', 'ds_banner_dark.png', null],
]
for (const [src, out, size] of jobs) {
  const svg = join(dir, src)
  let p = sharp(svg, { density: 300 })
  if (size) p = p.resize(size, size)
  await p.png().toFile(join(dir, out))
  console.log('✓', out)
}

// App-router icon + favicon source
await sharp(join(dir, 'ds_app_icon.svg'), { density: 300 }).resize(512, 512).png()
  .toFile(join(dir, '..', '..', 'src', 'app', 'icon.png'))
console.log('✓ src/app/icon.png')
await sharp(join(dir, 'ds_app_icon.svg'), { density: 300 }).resize(64, 64).png()
  .toFile(join(dir, 'favicon-64.png'))
console.log('✓ favicon-64.png (wrap into .ico next)')
