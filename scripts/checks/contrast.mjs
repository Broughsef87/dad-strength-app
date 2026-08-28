// ═══════════════════════════════════════════════════════════════════════════
// CONTRAST — every ink token stays readable on every ground, in both themes.
//
// This exists because two tokens shipped sitting within 0.5 of the 4.5 floor
// (--brand-text at 4.6:1 on chalk, --status-danger-ink at 4.96:1 on the dark
// card). Tokens that close to the line drop under it the first time anyone
// nudges a ground colour, and nothing would catch it. A measurement is an
// audit; this is the invariant.
//
// Two halves, and the second is the one that matters, because the first alone
// certifies a token nobody renders at full strength. Five instances of exactly
// that shipped and were fixed in a single session — the raw token passed every
// time, the faded one did not:
//
//     text-destructive/60   sign out               2.58:1
//     text-destructive/70   notifications warning  3.07:1
//     text-destructive/80   log-failure Dismiss    3.52:1
//     text-foreground/50    workout "Set" caption  3.05:1
//     brand at opacity-60   completed objective    2.69:1
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('../../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')

const FLOOR = 4.5

let checks = 0
const fails = []
const ok = (label, cond, detail) => {
  checks++
  if (!cond) fails.push(label + (detail ? '\n        ' + detail : ''))
}

const blockOf = (theme) => {
  const re = theme === 'chalk' ? /:root\s*\{([\s\S]*?)\n  \}/ : /\.dark\s*\{([\s\S]*?)\n  \}/
  const m = css.match(re)
  if (!m) throw new Error('no ' + theme + ' block in globals.css')
  return m[1]
}

// follows `--x: var(--y)` one hop at a time, so pairs defined by reference resolve
const raw = (block, name, seen = new Set()) => {
  const m = block.match(new RegExp('--' + name + ':\\s*([^;]+);'))
  if (!m) return null
  const v = m[1].trim()
  const ref = v.match(/^var\(--([a-z0-9-]+)\)$/)
  if (ref) {
    if (seen.has(ref[1])) return null
    seen.add(ref[1])
    return raw(block, ref[1], seen)
  }
  const hsl = v.match(/^([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%/)
  return hsl ? [+hsl[1], +hsl[2] / 100, +hsl[3] / 100] : null
}

const toRgb = ([h, s, l]) => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [r + m, g + m, b + m].map((v) => Math.round(v * 255))
}
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return +((x + 0.05) / (y + 0.05)).toFixed(2)
}
const over = (fg, bg, a) => fg.map((c, k) => Math.round(c * a + bg[k] * (1 - a)))

// ── 1. every ink token, both grounds, both themes ──────────────────────────
const INKS = ['brand-text', 'status-good-ink', 'status-danger-ink', 'muted-foreground', 'foreground']
const rows = []
for (const theme of ['chalk', 'graphite']) {
  const b = blockOf(theme)
  for (const ground of ['background', 'card']) {
    const g = raw(b, ground)
    for (const ink of INKS) {
      const i = raw(b, ink)
      if (!i || !g) {
        ok(theme + ': --' + ink + ' resolves', false, '--' + ink + ' or --' + ground + ' is missing')
        continue
      }
      const r = ratio(toRgb(i), toRgb(g))
      rows.push([theme, ink, ground, r])
      ok(theme + ': --' + ink + ' on --' + ground + ' clears ' + FLOOR + ':1', r >= FLOOR,
        'measured ' + r + ':1 — an ink below the floor is unreadable text, not a subtle one')
    }
  }
}

// ── 2. a faded ink must STILL clear the floor ──────────────────────────────
// Written first as a flat ban on opacity modifiers. The data said otherwise: 59
// sites use one and most are fine — text-foreground/70 on chalk is still ~12:1,
// and text-muted-foreground/40 has nothing quieter to fall back TO. A ban would
// have meant 59 edits to fix maybe a dozen real problems, and a rule that blunt
// gets suppressed rather than obeyed.
//
// So it composites and measures. Only a result under the floor fails. That still
// catches all five above, because those were genuinely unreadable rather than
// merely quiet — which is the distinction the rule should encode.
const INK_UTILS = {
  'text-brand-text': 'brand-text',
  'text-status-good-ink': 'status-good-ink',
  'text-status-danger-ink': 'status-danger-ink',
  'text-muted-foreground': 'muted-foreground',
  'text-foreground': 'foreground',
  'text-destructive': 'destructive',
  // NOT brand-text: `.text-brand` is a manual override that matches only the
  // BARE class. Tailwind emits `.text-brand\/70` separately, from --color-brand,
  // so an opacity variant resolves to raw volt. Modelling it as brand-text is
  // how this check passed over invisible text.
  'text-brand': 'brand',
}
const tooFaint = []
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) { walk(p); continue }
    if (!/\.tsx$/.test(e)) continue
    const lines = readFileSync(p, 'utf8').split('\n')
    for (let n = 0; n < lines.length; n++) {
      for (const util of Object.keys(INK_UTILS)) {
        const m = lines[n].match(new RegExp('\\b' + util + '/(\\d+)\\b'))
        if (!m) continue
        const alpha = +m[1] / 100
        let worst = null
        for (const theme of ['chalk', 'graphite']) {
          const b = blockOf(theme)
          const ink = raw(b, INK_UTILS[util])
          if (!ink) continue
          for (const ground of ['background', 'card']) {
            const g = raw(b, ground)
            if (!g) continue
            const r = ratio(over(toRgb(ink), toRgb(g), alpha), toRgb(g))
            if (r < FLOOR && (!worst || r < worst.r)) worst = { r, theme, ground }
          }
        }
        if (worst) {
          const rel = p.split(/[\\/]/).slice(-2).join('/')
          tooFaint.push(rel + ':' + (n + 1) + '  ' + m[0] + '  ' + worst.theme + '/' + worst.ground + '  ' + worst.r + ':1')
        }
      }
    }
  }
}
walk(SRC)

// The debt snapshot is generated FROM this check, never hand-written:
//   EMIT_DEBT=1 npx tsx scripts/checks/contrast.mjs
if (process.env.EMIT_DEBT) {
  for (const f of tooFaint) console.log('DEBT ' + f.split('  ').slice(0, 2).join('  '))
}

// A RATCHET, not an amnesty. These 53 predate the check and are a real
// accessibility debt — 1.7:1 to 2.8:1, under even the 3:1 large-text floor —
// but they are a bigger job than this ticket and hiding them in a silent pass
// would be worse than listing them. The count is the point: it may go down and
// must never go up. Anything NEW fails the build.
let faintAllow = []
try {
  faintAllow = JSON.parse(readFileSync(join(SRC, '..', 'scripts', 'checks', 'faded-ink-debt.json'), 'utf8'))
} catch { faintAllow = [] }
// keyed on file:line AND the class, so editing a debt line in place revokes
// its amnesty — the old key let a line change meaning and stay allowed
const keyOf = (f) => { const p = f.split('  '); return p[0] + '  ' + p[1] }
const newFaint = tooFaint.filter((f) => !faintAllow.includes(keyOf(f)))
const fixed = faintAllow.filter((a) => !tooFaint.some((f) => keyOf(f) === a))
if (fixed.length) {
  console.log('')
  console.log('  ' + fixed.length + ' faded-ink site(s) fixed since the snapshot — trim them from faded-ink-debt.json:')
  for (const f of fixed.slice(0, 6)) console.log('    ' + f)
}
ok('no NEW faded ink under the floor (' + faintAllow.length + ' pre-existing, ratcheted)', newFaint.length === 0,
  newFaint.slice(0, 12).join('\n        ')
  + (tooFaint.length > 12 ? '\n        …and ' + (tooFaint.length - 12) + ' more' : '')
  + '\n        fading an ink does not make it quiet, it makes it unreadable')

// ── 3. a category chip is its own ink on its own tint ──────────────────────
// text-category-push on bg-category-push/10 is the shipped chip pattern, and it
// was not covered by either half above: half 1 measures ink on a plain ground,
// half 2 only looks at faded INK. The tint underneath moves the ground.
const CATEGORIES = ['push', 'pull', 'legs', 'core', 'condition', 'general']
for (const theme of ['chalk', 'graphite']) {
  const b = blockOf(theme)
  const card = raw(b, 'card')
  for (const c of CATEGORIES) {
    const t = raw(b, 'category-' + c)
    if (!t || !card) { ok(theme + ': --category-' + c + ' resolves', false, 'missing'); continue }
    const ground = over(toRgb(t), toRgb(card), 0.10)   // the /10 tint
    const r = ratio(toRgb(t), ground)
    rows.push([theme, 'category-' + c + ' on /10', 'card', r])
    ok(theme + ': --category-' + c + ' on its own 10% tint clears ' + FLOOR + ':1', r >= FLOOR,
      'measured ' + r + ':1 — the chip pattern is the ink on its own tint, not on the bare card')
  }
}

// ── report ─────────────────────────────────────────────────────────────────
console.log('')
console.log('  ── ink contrast ' + '─'.repeat(45))
for (const [theme, ink, ground, r] of rows) {
  console.log('  ' + (r >= FLOOR ? ' ' : '✗') + ' ' + theme.padEnd(9)
    + ' --' + ink.padEnd(20) + ' on ' + ground.padEnd(11) + String(r).padStart(6) + ':1')
}
console.log('')
if (fails.length) {
  console.log('  ✗ ' + fails.length + ' of ' + checks + ' contrast checks FAILED:')
  for (const f of fails) console.log('    - ' + f)
  process.exit(1)
}
console.log('  ✓ ' + checks + ' contrast checks — every ink clears ' + FLOOR + ':1, both grounds, both themes')
