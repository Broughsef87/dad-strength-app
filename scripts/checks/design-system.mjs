// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — the app implements /design-system, and this measures that.
//
// /design-system is a vendored copy of the Claude Design project "dad strength
// — chalk / volt". It is the specification; src/app/globals.css is the
// implementation. Two files describing one system drift the first time anyone
// nudges a value in only one of them, so this check reads BOTH and compares:
//
//   1. every colour the DS names, both themes, resolved to rgb on each side
//   2. shape, motion and type roles — radii, cells, curves, durations, weights
//   3. what the DS prohibits, as source bans: gradients, blur, glows, pulsing,
//      serif, uppercase, and an ink-role utility sitting on a volt fill
//   4. the vendored copy itself is whole, and carries none of the viewer's
//      injected runtime
//
// Colours are compared in rgb with a ±2 tolerance per channel, because the DS
// speaks hex and globals.css speaks hsl triplets, and the round trip rounds.
// The fixture at the top proves the comparator can fail before any pass counts.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { componentSources, sourcesDigest } from './design-system-sources.mjs'

// fileURLToPath, not URL.pathname: a checkout under a path with a space or a
// non-ASCII character keeps its percent-escapes in pathname and every read fails.
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DS = join(ROOT, 'design-system')
const SRC = join(ROOT, 'src')
const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8').replace(/\r\n/g, '\n')
const ds = (rel) => readFileSync(join(DS, rel), 'utf8').replace(/\r\n/g, '\n')

let checks = 0
const fails = []
const ok = (label, cond, detail) => {
  checks++
  if (!cond) fails.push(label + (detail ? '\n        ' + detail : ''))
}

// ── colour plumbing ─────────────────────────────────────────────────────────
const hexToRgb = (h) => {
  const m = h.trim().match(/^#([0-9a-f]{6})$/i)
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null
}
const hslToRgb = ([h, s, l]) => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [r + m, g + m, b + m].map((v) => Math.round(v * 255))
}
const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
const TOL = 2
const sameColour = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= TOL)

// ── the DS side: tokens/colors.css, hex, two blocks, var() by reference ──────
const dsColors = ds('tokens/colors.css')
const dsBlock = (theme) => {
  const re = theme === 'chalk' ? /:root\s*\{([\s\S]*?)\n\}/ : /\[data-theme="graphite"\]\s*\{([\s\S]*?)\n\}/
  const m = dsColors.match(re)
  if (!m) throw new Error('no ' + theme + ' block in design-system/tokens/colors.css')
  return m[1]
}
// graphite overrides fall back to the chalk block for the base palette
const dsVar = (theme, name, seen = new Set()) => {
  const blocks = theme === 'chalk' ? [dsBlock('chalk')] : [dsBlock('graphite'), dsBlock('chalk')]
  for (const b of blocks) {
    const m = b.match(new RegExp('(^|\\n)\\s*' + name.replace(/[-]/g, '\\-') + ':\\s*([^;]+);'))
    if (!m) continue
    const v = m[2].trim()
    const ref = v.match(/^var\((--[a-z0-9-]+)\)$/)
    if (ref) {
      if (seen.has(ref[1])) return null
      seen.add(ref[1])
      return dsVar(theme, ref[1], seen)
    }
    return v
  }
  return null
}
const dsRgb = (theme, name) => {
  const v = dsVar(theme, name)
  if (!v) return null
  const rgba = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/)
  if (rgba) return { rgb: [+rgba[1], +rgba[2], +rgba[3]], alpha: rgba[4] == null ? 1 : +rgba[4] }
  const rgb = hexToRgb(v)
  return rgb ? { rgb, alpha: 1 } : null
}

// ── the app side: globals.css, hsl triplets, :root and .dark ────────────────
const appBlock = (theme) => {
  const re = theme === 'chalk' ? /:root\s*\{([\s\S]*?)\n  \}/ : /\.dark\s*\{([\s\S]*?)\n  \}/
  const m = css.match(re)
  if (!m) throw new Error('no ' + theme + ' block in globals.css')
  return m[1]
}
const appVar = (theme, name, seen = new Set()) => {
  const m = appBlock(theme).match(new RegExp('--' + name + ':\\s*([^;]+);'))
  if (!m) return null
  const v = m[1].trim()
  const ref = v.match(/^var\(--([a-z0-9-]+)\)$/)
  if (ref) {
    if (seen.has(ref[1])) return null
    seen.add(ref[1])
    return appVar(theme, ref[1], seen)
  }
  return v
}
const appRgb = (theme, name) => {
  const v = appVar(theme, name)
  if (!v) return null
  const m = v.match(/^([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%(?:\s*\/\s*([\d.]+))?$/)
  if (!m) return null
  return { rgb: hslToRgb([+m[1], +m[2] / 100, +m[3] / 100]), alpha: m[4] == null ? 1 : +m[4] }
}

// ── 0. THE FIXTURE — the comparator can fail, and both parsers read values ──
ok('fixture: the colour comparator accepts a hex/hsl round trip',
  sameColour(hexToRgb('#C6FF3F'), hslToRgb([78, 1, 0.62])), null)
ok('fixture: the colour comparator REJECTS a lightness ten points off',
  !sameColour(hexToRgb('#C6FF3F'), hslToRgb([78, 1, 0.52])),
  'a comparator that cannot fail certifies nothing')
ok('fixture: the DS parser follows var() — --ds-volt-fill resolves to the chalk volt',
  dsVar('chalk', '--ds-volt-fill') === '#C6FF3F', 'got ' + dsVar('chalk', '--ds-volt-fill'))
ok('fixture: the DS parser reads the graphite override — --ds-volt-fill is #CDFF4D there',
  dsVar('graphite', '--ds-volt-fill') === '#CDFF4D', 'got ' + dsVar('graphite', '--ds-volt-fill'))
ok('fixture: the app parser follows var() — --status-good-fill resolves to a triplet',
  /^\d+ \d+% \d+%/.test(appVar('chalk', 'status-good-fill') || ''), 'got ' + appVar('chalk', 'status-good-fill'))

// ── 1. every colour the DS names, both themes ───────────────────────────────
// DS semantic name → app token. The app's names predate the DS and stay: the
// 240+ call sites read bg-brand and text-muted-foreground, not --ds-volt-fill.
// What must agree is the VALUE.
const COLOUR_MAP = [
  ['--ds-background', 'background', 'the ground'],
  ['--ds-tile', 'card', 'the tile'],
  ['--ds-recessed', 'surface-2', 'the recessed row'],
  ['--ds-line', 'muted', 'line / fill'],
  ['--ds-ink', 'foreground', 'ink'],
  ['--ds-concrete', 'muted-foreground', 'concrete'],
  ['--ds-volt-fill', 'brand', 'volt'],
  ['--ds-volt-fill-pressed', 'brand-deep', 'volt-deep (pressed)'],
  ['--ds-on-volt', 'brand-ink', 'the ink on a volt fill'],
  ['--ds-brand-text', 'brand-text', 'volt as text'],
  ['--ds-brand-muted', 'brand-muted', 'the live-chip tint'],
  ['--ds-good-fill', 'status-good-fill', 'good, fill'],
  ['--ds-good-ink', 'status-good-ink', 'good, ink'],
  ['--ds-danger-fill', 'status-danger-fill', 'danger, fill'],
  ['--ds-danger-ink', 'status-danger-ink', 'danger, ink'],
  ...['push', 'pull', 'legs', 'core', 'condition', 'general']
    .map((a) => ['--ds-cat-' + a + '-ink', 'category-' + a, 'category ' + a]),
]
const rows = []
for (const theme of ['chalk', 'graphite']) {
  for (const [dsName, appName, what] of COLOUR_MAP) {
    const d = dsRgb(theme, dsName)
    const a = appRgb(theme, appName)
    if (!d) { ok(theme + ': DS defines ' + dsName, false, 'missing from design-system/tokens/colors.css'); continue }
    if (!a) { ok(theme + ': app defines --' + appName, false, 'missing from globals.css'); continue }
    rows.push([theme, what, hex(d.rgb) + (d.alpha < 1 ? ' @' + d.alpha : ''), hex(a.rgb) + (a.alpha < 1 ? ' @' + a.alpha : '')])
    ok(theme + ': --' + appName + ' is the DS ' + dsName + ' (' + what + ')',
      sameColour(d.rgb, a.rgb) && Math.abs(d.alpha - a.alpha) < 0.005,
      'DS ' + hex(d.rgb) + (d.alpha < 1 ? ' @' + d.alpha : '') + ' vs app ' + hex(a.rgb) + (a.alpha < 1 ? ' @' + a.alpha : '')
      + '\n        the DS is the source of truth: change design-system/tokens/colors.css first, then here')
  }
}

// ── 2. shape, motion, type ──────────────────────────────────────────────────
const dsDecl = (file, name) => {
  const m = ds('tokens/' + file).match(new RegExp(name.replace(/-/g, '\\-') + ':\\s*([^;]+);'))
  return m ? m[1].trim() : null
}
const rule = (selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s*,\s*/g, ',\\s*')
  const m = css.match(new RegExp('(?:^|\\n)' + esc + '\\s*\\{([^}]*)\\}'))
  return m ? m[1] : null
}
const decl = (block, prop) => {
  if (block == null) return null
  const m = block.match(new RegExp('(?:^|\\n|;)\\s*' + prop.replace(/-/g, '\\-') + ':\\s*([^;]+);'))
  return m ? m[1].trim() : null
}
const px = (v) => {
  if (v == null) return null
  const m = v.match(/^([\d.]+)(px|rem)$/)
  return m ? (m[2] === 'rem' ? +m[1] * 16 : +m[1]) : null
}
const themeDecl = (name) => {
  const m = css.match(/@theme\s*\{([\s\S]*?)\n\}/)
  return m ? decl(m[1], name) : null
}
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()

// radii: the DS names six; the kit classes must render them
const RADII = [
  ['--ds-radius-tile', '.tile', 'border-radius'],
  ['--ds-radius-tile-lg', '.tile-lg', 'border-radius'],
  ['--ds-radius-row', '.row-recessed', 'border-radius'],
]
for (const [dsName, sel, prop] of RADII) {
  const want = px(dsDecl('shape.css', dsName))
  const got = px(decl(rule(sel), prop))
  ok(sel + ' radius is the DS ' + dsName + ' (' + want + 'px)', want != null && got === want, 'got ' + got + 'px')
}
ok('@theme --radius-slab is the DS --ds-radius-slab', px(themeDecl('--radius-slab')) === px(dsDecl('shape.css', '--ds-radius-slab')),
  'DS ' + dsDecl('shape.css', '--ds-radius-slab') + ' vs @theme ' + themeDecl('--radius-slab'))
ok('@theme --radius-cell is the DS --ds-radius-cell', px(themeDecl('--radius-cell')) === px(dsDecl('shape.css', '--ds-radius-cell')),
  'DS ' + dsDecl('shape.css', '--ds-radius-cell') + ' vs @theme ' + themeDecl('--radius-cell'))
ok('.slab-volt rounds with var(--radius-slab) and pads 2px 8px — the highlighter, not a button',
  decl(rule('.slab-volt'), 'border-radius') === 'var(--radius-slab)' && norm(decl(rule('.slab-volt'), 'padding')) === '2px 8px', null)
ok('.slab-volt is volt with brand-ink on it',
  decl(rule('.slab-volt'), 'background') === 'hsl(var(--brand))' && decl(rule('.slab-volt'), 'color') === 'hsl(var(--brand-ink))', null)

// cells: 20×7 led, 10×18 ammo, 36 day dot
const cellRule = rule('.day-pill, .led-cell')
ok('.led-cell is the DS cell: ' + dsDecl('shape.css', '--ds-cell-width') + ' × ' + dsDecl('shape.css', '--ds-cell-height') + ' at var(--radius-cell)',
  px(decl(cellRule, 'width')) === px(dsDecl('shape.css', '--ds-cell-width'))
  && px(decl(cellRule, 'height')) === px(dsDecl('shape.css', '--ds-cell-height'))
  && decl(cellRule, 'border-radius') === 'var(--radius-cell)',
  'got ' + decl(cellRule, 'width') + ' × ' + decl(cellRule, 'height') + ' radius ' + decl(cellRule, 'border-radius'))
ok('a lit led cell is volt', /\.led-cell\.lit\s*\{\s*background:\s*hsl\(var\(--brand\)\)/.test(css), null)
{
  // the day header's block strip is the one strip that can hold eight cells
  // (Dad Built Upper A/B) inside phone chrome: 8 × 20px + gaps is 202px beside
  // the day name at the 390px design width, and the name truncates. That strip
  // is bounded — its cells flex inside a fixed width — and only that one:
  // every other strip is seven cells or fewer. Codex, round 1.
  const day = readFileSync(join(SRC, 'app', 'train', '[program]', '[day]', 'page.tsx'), 'utf8')
  ok('the day header block strip is bounded (led-bar led-bar-fit) — it can hold eight cells inside phone chrome',
    /className="led-bar led-bar-fit">\s*\{Array\.from\(\{ length: Math\.max\(plan\.items\.length, 1\) \}\)/.test(day), null)
  const fit = rule('.led-bar-fit')
  const fitPx = px(decl(fit, 'width'))
  ok('.led-bar-fit is a fixed width no wider than 6rem, and its cells flex to fit it',
    fitPx != null && fitPx <= 96 && /\.led-bar-fit \.led-cell[^{]*\{[^}]*flex:\s*1 1 0[^}]*width:\s*auto/.test(css),
    'width ' + decl(fit, 'width'))
}
ok('.ammo-cell is 10 × 18 at var(--radius-cell), no border',
  px(decl(rule('.ammo-cell'), 'width')) === 10 && px(decl(rule('.ammo-cell'), 'height')) === 18
  && decl(rule('.ammo-cell'), 'border-radius') === 'var(--radius-cell)' && decl(rule('.ammo-cell'), 'border') == null, null)
ok('.day-dot is the DS --ds-day-pill-size (' + dsDecl('shape.css', '--ds-day-pill-size') + ')',
  px(decl(rule('.day-dot'), 'width')) === px(dsDecl('shape.css', '--ds-day-pill-size'))
  && px(decl(rule('.day-dot'), 'height')) === px(dsDecl('shape.css', '--ds-day-pill-size')), null)

// elevation: the exact shadow strings, both themes
for (const theme of ['chalk', 'graphite']) {
  const want = ds('tokens/elevation.css')
  const block = theme === 'chalk' ? want.match(/:root\s*\{([\s\S]*?)\n\}/)[1] : want.match(/\[data-theme="graphite"\]\s*\{([\s\S]*?)\n\}/)[1]
  ok(theme + ': --shadow-tile is the DS --ds-shadow-tile', norm(decl(block, '--ds-shadow-tile')) === norm(appVar(theme, 'shadow-tile')),
    'DS ' + norm(decl(block, '--ds-shadow-tile')) + '\n        app ' + norm(appVar(theme, 'shadow-tile')))
  ok(theme + ': --shadow-tile-lg is the DS --ds-shadow-tile-raised', norm(decl(block, '--ds-shadow-tile-raised')) === norm(appVar(theme, 'shadow-tile-lg')),
    'DS ' + norm(decl(block, '--ds-shadow-tile-raised')) + '\n        app ' + norm(appVar(theme, 'shadow-tile-lg')))
}

// motion: curves in @theme, durations in :root, and the moves use them
ok('@theme --ease-spring is the DS --ds-ease-spring', norm(themeDecl('--ease-spring')) === norm(dsDecl('motion.css', '--ds-ease-spring')),
  'DS ' + dsDecl('motion.css', '--ds-ease-spring') + ' vs app ' + themeDecl('--ease-spring'))
ok('@theme --ease-out is the DS --ds-ease-out', norm(themeDecl('--ease-out')) === norm(dsDecl('motion.css', '--ds-ease-out')),
  'DS ' + dsDecl('motion.css', '--ds-ease-out') + ' vs app ' + themeDecl('--ease-out'))
for (const d of ['press', 'mount', 'stamp']) {
  ok('--dur-' + d + ' is the DS --ds-dur-' + d, appVar('chalk', 'dur-' + d) === dsDecl('motion.css', '--ds-dur-' + d),
    'DS ' + dsDecl('motion.css', '--ds-dur-' + d) + ' vs app ' + appVar('chalk', 'dur-' + d))
}
ok('a card mounts with var(--dur-mount) on var(--ease-spring)',
  /\.animate-float-up,\s*\.rise\s*\{\s*animation:\s*rise var\(--dur-mount\) var\(--ease-spring\) both;/.test(css), null)
ok('a stamp lands with var(--dur-stamp) on var(--ease-spring)',
  /\.stamp\s*\{\s*animation:\s*stamp var\(--dur-stamp\) var\(--ease-spring\) both;/.test(css), null)
ok('a press changes the fill over var(--dur-press); nothing scales',
  /button, a, \[role="button"\]\s*\{[^}]*transition-duration:\s*var\(--dur-press\);/.test(css) && !/transform:\s*scale\(0\.97\)/.test(css), null)
{
  // nothing loops. The loader is the one accepted exception, and it is named.
  const loops = [...css.matchAll(/animation:\s*([a-z-]+)[^;]*\binfinite\b/g)].map((m) => m[1])
  const allowed = new Set(['forge-pulse', 'forge-spin'])
  ok('nothing in globals.css loops except the loader (forge-pulse, forge-spin)',
    loops.every((k) => allowed.has(k)), 'looping: ' + loops.join(', ') + '\n        the DS: no skeleton shimmer, no pulsing dots — nothing loops')
  ok('the skeleton is a static block — no shimmer keyframes', !/@keyframes shimmer/.test(css) && decl(rule('.skeleton'), 'animation') == null, null)
}

// type roles
const stat = rule('.stat-num')
ok('.stat-num is the mono at the DS weight (' + dsDecl('typography.css', '--ds-stat-num-weight') + ')',
  decl(stat, 'font-family') === 'var(--font-mono)' && decl(stat, 'font-weight') === dsDecl('typography.css', '--ds-stat-num-weight'),
  'got ' + decl(stat, 'font-family') + ' ' + decl(stat, 'font-weight') + '\n        the hero numeral is Geist Mono 600 — numerals are heroes, and they are set in the data face')
ok('.stat-num tracks ' + dsDecl('typography.css', '--ds-stat-num-tracking') + ' at ' + dsDecl('typography.css', '--ds-stat-num-leading') + ' leading, tabular',
  decl(stat, 'letter-spacing') === dsDecl('typography.css', '--ds-stat-num-tracking')
  && decl(stat, 'line-height') === dsDecl('typography.css', '--ds-stat-num-leading')
  && decl(stat, 'font-variant-numeric') === 'tabular-nums', null)
{
  // .font-display is declared later than .stat-num at the same specificity, so a
  // numeral carrying both classes fell back to the sans (Codex, round 3). The
  // compound rule has to exist, be the mono, and come AFTER .font-display.
  const compound = css.indexOf('.stat-num.font-display {')
  const display = css.indexOf('\n.font-display {')
  ok('.stat-num.font-display restores the mono and -0.045em after .font-display — the stat role outranks the display face',
    compound > display && display > 0
    && decl(rule('.stat-num.font-display'), 'font-family') === 'var(--font-mono)'
    && decl(rule('.stat-num.font-display'), 'letter-spacing') === '-0.045em', null)
}
const eyebrow = rule('.eyebrow-mono')
ok('.eyebrow-mono is ' + dsDecl('typography.css', '--ds-eyebrow-size') + ' at ' + dsDecl('typography.css', '--ds-eyebrow-tracking') + ', mono, lowercase',
  decl(eyebrow, 'font-size') === dsDecl('typography.css', '--ds-eyebrow-size')
  && decl(eyebrow, 'letter-spacing') === dsDecl('typography.css', '--ds-eyebrow-tracking')
  && decl(eyebrow, 'font-family') === 'var(--font-mono)' && decl(eyebrow, 'text-transform') === 'lowercase', null)
const body = rule('  body')
ok('body copy is weight ' + dsDecl('typography.css', '--ds-body-weight') + ' at ' + dsDecl('typography.css', '--ds-body-leading') + ' — light on purpose',
  decl(body, 'font-weight') === dsDecl('typography.css', '--ds-body-weight') && decl(body, 'line-height') === dsDecl('typography.css', '--ds-body-leading'),
  'got ' + decl(body, 'font-weight') + ' / ' + decl(body, 'line-height'))
const data = rule('.data-mono')
ok('.data-mono is weight ' + dsDecl('typography.css', '--ds-data-weight') + ' at no less than the DS xs size (' + dsDecl('typography.css', '--ds-data-size-xs') + '), tabular',
  decl(data, 'font-weight') === dsDecl('typography.css', '--ds-data-weight')
  && px(decl(data, 'font-size')) >= px(dsDecl('typography.css', '--ds-data-size-xs'))
  && decl(data, 'font-variant-numeric') === 'tabular-nums', 'got ' + decl(data, 'font-weight') + ' ' + decl(data, 'font-size'))
ok('.pill-volt is 600 and presses to volt-deep; .pill-quiet is 500 on the recessed fill (components/core/Pill.jsx)',
  decl(rule('.pill-volt'), 'font-weight') === '600' && /\.pill-volt:active\s*\{\s*background:\s*hsl\(var\(--brand-deep\)\)/.test(css)
  && decl(rule('.pill-quiet'), 'font-weight') === '500' && decl(rule('.pill-quiet'), 'background') === 'hsl(var(--surface-2))', null)
ok('.chip-live is the mono with a volt dot (components/core/ChipLive.jsx)',
  decl(rule('.chip-live'), 'font-family') === 'var(--font-mono)' && /\.chip-live::before\s*\{[^}]*background:\s*hsl\(var\(--brand\)\)/.test(css), null)
ok('there is no serif in the system', !/serif/.test(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/sans-serif/g, '')), 'globals.css names a serif (comments excluded)')
{
  // the faces the roles need are actually loaded
  const layout = readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8')
  const geist = layout.match(/Geist_Mono\(\{[\s\S]*?weight:\s*\[([^\]]*)\]/)
  const weights = geist ? geist[1].match(/\d+/g) : []
  ok('layout.tsx loads Geist Mono at the DS data weight (500) and stat weight (600)',
    weights.includes('500') && weights.includes('600'), 'loaded: ' + weights.join(', '))
  const grot = layout.match(/Space_Grotesk\(\{[\s\S]*?weight:\s*\[([^\]]*)\]/)
  ok('layout.tsx loads Space Grotesk 300 for body copy', grot && grot[1].includes("'300'"), null)
}

// ── 3. what the DS prohibits, in the source ─────────────────────────────────
const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(f)) out.push(p)
  }
  return out
}
const files = walk(SRC)
const BANS = [
  [/\bbg-gradient-/, 'a gradient', 'there is no gradient anywhere in this system — a volt fill or a larger numeral carries emphasis'],
  [/\bbackdrop-blur\b/, 'a frosted surface', 'no blur anywhere: no frosted nav, no blurred scrim'],
  [/(?:^|[\s"'`])blur-(?:\[|sm\b|md\b|lg\b|xl\b|2xl\b|3xl\b)/, 'a blur', 'no blur anywhere'],
  [/\bdrop-shadow\b/, 'a drop shadow', 'nothing glows — depth is tile shadow, and only tiles have it'],
  [/\bshadow-\[0_0_/, 'a glow-shaped shadow', 'nothing glows'],
  [/\banimate-(?:pulse|ping|bounce)\b/, 'a looping utility', 'nothing loops: no pulsing dots, no skeleton shimmer'],
  [/\bfont-serif\b/, 'a serif', 'Space Grotesk and Geist Mono, nothing else'],
  [/(?:^|[\s"'`])(?:[a-z-]+(?:\/[a-z]+)?:)+scale-/, 'a scale on hover or press', 'no lift, no scale — a press changes a fill (readme: hover and press states)'],
  [/\b(?:disabled|hover|group-hover|focus|active):opacity-/, 'a state that fades a control', 'inks never fade — a disabled control desaturates its fill or recedes to concrete, never drops opacity'],
  [/\buppercase\b/, 'an uppercase utility', 'lowercase voice — never uppercase an eyebrow'],
]
for (const [re, what, why] of BANS) {
  const hits = []
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    text.split('\n').forEach((line, i) => { if (re.test(line)) hits.push(f.slice(SRC.length + 1) + ':' + (i + 1)) })
  }
  ok('no src file renders ' + what, hits.length === 0, why + '\n        ' + hits.slice(0, 8).join('\n        '))
}
{
  // glows in the forms a utility ban cannot see: style objects in tsx, and
  // rules in globals.css itself. A text-shadow is a halo; a box-shadow that
  // starts at 0 0 is a glow; an inset highlight is a sheen. FOR-198 took one
  // halo off the slab, and the session summary still carried a 14px volt halo
  // on the tonnage numeral — found by Codex, not by the first version of this.
  const inlineHits = []
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/\btextShadow\s*:/.test(line)
        || /\bboxShadow\s*:\s*['"`]\s*0(?:px)? 0(?:px)? /.test(line)
        || /\bfilter\s*:\s*['"`][^'"`]*(?:blur|drop-shadow)\(/.test(line)) inlineHits.push(f.slice(SRC.length + 1) + ':' + (i + 1))
    })
  }
  ok('no src file carries an inline glow (textShadow, a 0 0 boxShadow, a blur/drop-shadow filter)', inlineHits.length === 0,
    'nothing glows\n        ' + inlineHits.slice(0, 8).join('\n        '))
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const cssGlows = [...code.matchAll(/(?:text-shadow|box-shadow)\s*:\s*[^;]+;/g)].map((m) => m[0].trim())
    .filter((d) => !/:\s*none;$/.test(d) && !/:\s*var\(/.test(d))
    .filter((d) => /^text-shadow/.test(d) || /^box-shadow\s*:\s*(?:0(?:px)? 0(?:px)? |inset\b)/.test(d))
  ok('globals.css has no glow — no text-shadow, no 0 0 box-shadow, no inset sheen', cssGlows.length === 0,
    cssGlows.join('\n        '))
}
{
  // a sweep that strips `hover:opacity-100` out of `group-hover:opacity-100` leaves
  // `group-` behind — the first pass of the round-4 sweep did exactly that at four
  // sites. Class lists live on className lines, so only those are read: `active:`
  // in an object literal (`{ active: false }`) is not a variant.
  const dangling = []
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (!/className/.test(line)) return
      for (const seg of line.matchAll(/(["'`])([^"'`]*)\1/g)) {
        if (/(?:^|\s)(?:group-|peer-|hover:|focus:|active:|disabled:)(?=\s|$)/.test(seg[2])) dangling.push(f.slice(SRC.length + 1) + ':' + (i + 1))
      }
    })
  }
  ok('no class list carries a dangling variant prefix (a bare group-, hover:, active:…)', dangling.length === 0,
    'a sweep cut a utility in half\n        ' + dangling.slice(0, 8).join('\n        '))
}
{
  // an ink-ROLE utility on a solid volt fill. bg-brand pairs with text-brand-ink
  // (or text-brand, which the remap flips to brand-ink inside a fill) — never
  // with text-foreground, which is near-white on volt in graphite (1.02:1).
  const hits = []
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    text.split('\n').forEach((line, i) => {
      for (const seg of line.matchAll(/(["'`])([^"'`]*)\1/g)) {
        // every ink-role or surface token that is light on at least one ground.
        // text-background is chalk's near-white; three sites had it on volt (Codex, round 3).
        if (/\bbg-brand(?![-/\w])/.test(seg[2])
          && /\btext-(?:(?:muted-)?foreground|background|card|popover|primary-foreground|secondary|muted|accent|surface-[123])\b/.test(seg[2])) hits.push(f.slice(SRC.length + 1) + ':' + (i + 1))
      }
    })
  }
  ok('no ink-role or surface utility sits on a solid volt fill (bg-brand wants text-brand-ink)', hits.length === 0,
    'text-foreground on bg-brand measured 1.02:1 on graphite\n        ' + hits.slice(0, 8).join('\n        '))
}

// ── 4. the vendored copy is whole, and clean ────────────────────────────────
const MUST = [
  'readme.md', 'SKILL.md', 'styles.css', 'support.js', 'Dad Strength Design System.dc.html',
  'tokens/colors.css', 'tokens/elevation.css', 'tokens/fonts.css', 'tokens/motion.css', 'tokens/shape.css', 'tokens/spacing.css', 'tokens/typography.css',
  ...['ChipLive', 'Eyebrow', 'Pill', 'RecessedRow', 'StatNum', 'Tile', 'VoltSlab'].map((c) => 'components/core/' + c + '.jsx'),
  ...['AmmoCells', 'DayPills', 'LedBar'].map((c) => 'components/progress/' + c + '.jsx'),
  ...['CategoryChip', 'SessionCard', 'SignInCard', 'StatusMessage', 'WeekList'].map((c) => 'components/training/' + c + '.jsx'),
  'ui_kits/app/index.html', 'ui_kits/app/AppShell.jsx', 'assets/ds-mark-volt.svg', 'IMPLEMENTATION.md',
]
for (const rel of MUST) ok('design-system/' + rel + ' is vendored', existsSync(join(DS, rel)), null)
ok('design-system/guidelines holds the 19 specimen cards',
  existsSync(join(DS, 'guidelines')) && readdirSync(join(DS, 'guidelines')).filter((f) => f.endsWith('.html')).length === 19, null)
ok('design-system/styles.css imports exactly the seven token files',
  (ds('styles.css').match(/@import "tokens\/[a-z]+\.css";/g) || []).length === 7 && !/[^\s@"a-z./;]/.test(ds('styles.css').replace(/@import "tokens\/[a-z]+\.css";/g, '')), null)
{
  const walkAll = (dir, out = []) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) walkAll(p, out); else out.push(p)
    }
    return out
  }
  const dirty = walkAll(DS).filter((p) => /\.html$/.test(p) && /data-omelette-injected/.test(readFileSync(p, 'utf8')))
  ok('no vendored HTML carries the viewer\'s injected runtime', dirty.length === 0,
    'the Claude Design viewer injects a 20KB script into every served HTML file; the vendored copy is the design, not the viewer\n        '
    + dirty.map((p) => p.slice(DS.length + 1)).slice(0, 6).join('\n        '))
  ok('the readme is the chalk / volt readme', /chalk \/ volt/.test(ds('readme.md')) && /volt is a FILL/.test(ds('readme.md')), null)

  // The demo pages load _ds_bundle.js, which Claude Design generates at view
  // time and does not store. scripts/design-system-bundle.mjs builds it here and
  // stamps the component sources' hash into its banner: the bundle must exist,
  // expose every component, and have been built from THESE sources. Codex, round 2.
  const sources = componentSources(DS)
  const compNames = sources.map((f) => f.split('/').pop().replace(/\.jsx$/, ''))
  const bundlePath = join(DS, '_ds_bundle.js')
  ok('design-system/_ds_bundle.js is built — the demo pages load it (npm run design-system:bundle)', existsSync(bundlePath), null)
  if (existsSync(bundlePath)) {
    const bundle = readFileSync(bundlePath, 'utf8')
    ok('the bundle assigns a DadStrength* global and exposes all ' + compNames.length + ' components',
      /var DadStrengthDS\s*=/.test(bundle) && compNames.every((c) => new RegExp('\\b' + c + '\\b').test(bundle)),
      'missing: ' + compNames.filter((c) => !new RegExp('\\b' + c + '\\b').test(bundle)).join(', '))
    // the pages load React 18 from a CDN; a bundled jsx-runtime would be node_modules' React 19
    ok('the bundle renders through window.React.createElement — no bundled jsx-runtime',
      !/jsx[-_]runtime/.test(bundle) && /\.createElement\(/.test(bundle), null)
    const stamped = (bundle.match(/^\/\/ sources: ([0-9a-f]{16})/m) || [])[1]
    const digest = sourcesDigest(DS, sources)
    ok('the bundle was built from the current component sources — stale means npm run design-system:bundle',
      stamped === digest, 'stamped ' + stamped + ' vs sources ' + digest)
  }

  // React 19 removed the global JSX namespace; the originals returned JSX.Element.
  const dts = walkAll(join(DS, 'components')).filter((p) => p.endsWith('.d.ts'))
  const bareJsx = dts.filter((p) => /(?<![.\w])JSX\./.test(readFileSync(p, 'utf8')))
  ok('the vendored .d.ts files use React.JSX, not the global JSX namespace React 19 removed', bareJsx.length === 0,
    bareJsx.map((p) => p.slice(DS.length + 1)).join(', '))
  const widened = dts.filter((p) => {
    const t = readFileSync(p, 'utf8')
    return /title\?:\s*React\.ReactNode/.test(t) && !/Omit<React\.HTMLAttributes<HTMLDivElement>, 'title'>/.test(t)
  })
  ok('a declaration that takes a ReactNode title omits the inherited HTML title attribute (TS2430)', widened.length === 0,
    widened.map((p) => p.slice(DS.length + 1)).join(', '))
  ok('Tile.d.ts is generic over `as` — attributes follow the rendered element (ComponentPropsWithoutRef<T>)',
    /TileProps<T extends keyof React\.JSX\.IntrinsicElements = "div">/.test(ds('components/core/Tile.d.ts'))
    && /ComponentPropsWithoutRef<T>/.test(ds('components/core/Tile.d.ts')) && /as\?: T;/.test(ds('components/core/Tile.d.ts')), null)
  ok('Tile takes --ds-shadow-tile-raised at size="lg", as .tile-lg does',
    /boxShadow: size === "lg" \? "var\(--ds-shadow-tile-raised\)" : "var\(--ds-shadow-tile\)"/.test(ds('components/core/Tile.jsx')), null)
  const skill = join(ROOT, '.claude', 'skills', 'dad-strength-design', 'SKILL.md')
  ok('.claude/skills/dad-strength-design/SKILL.md points at design-system/readme.md',
    existsSync(skill) && /design-system\/readme\.md/.test(readFileSync(skill, 'utf8')), null)
}

// ── report ──────────────────────────────────────────────────────────────────
if (process.env.VERBOSE) {
  for (const [theme, what, d, a] of rows) console.log('  ' + theme.padEnd(9) + what.padEnd(26) + 'DS ' + d.padEnd(18) + 'app ' + a)
}
if (fails.length) {
  console.log('design system: ' + fails.length + ' of ' + checks + ' checks FAILED\n')
  for (const f of fails) console.log('  - ' + f)
  process.exit(1)
}
console.log('design system: ' + checks + ' checks passed — the app is the DS, measured')
