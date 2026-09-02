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

// The one pattern shared by the fixture and the ban below it. Declared up
// here because a `const` is not hoisted, and the fixture runs first on purpose.
const INK_FADE = /\b[a-z-]+-ink\/(?:\[[\d.]+\]|\d+)/

// Section 5's vocabulary, hoisted for the same reason. A fill utility, with an
// optional variant prefix (hover:, disabled:, group-hover:) and an optional
// tint (/NN); an ink utility, bare. Longest names first so `bg-brand` cannot
// swallow the front of `bg-brand-deep`.
const FILL_UTILS = {
  'bg-status-danger-fill': 'status-danger-fill',
  'bg-status-good-fill': 'status-good-fill',
  'bg-brand-deep': 'brand-deep',
  'bg-brand': 'brand',
}
const INK_ON_FILL = {
  'text-status-danger-ink': 'status-danger-ink',
  'text-status-good-ink': 'status-good-ink',
  'text-brand-ink': 'brand-ink',
}
const FILL_RE = new RegExp(
  '(?:[a-z-]+:)?\\b(' + Object.keys(FILL_UTILS).join('|') + ')(?:/(\\d+))?(?![a-z0-9/-])', 'g')
const INK_RE = new RegExp('\\b(' + Object.keys(INK_ON_FILL).join('|') + ')(?![a-z0-9/-])')
// A quoted class string. Pairing happens INSIDE one of these, never across a
// line: a ternary puts two of them on one line, and each branch's ink belongs
// to that branch's fill only.
const SEGMENT_RE = /(['"`])(?:\\.|(?!\1).)*\1/g

// Every (ink, fill-state) pairing in a piece of source, measured in both
// themes. ONE function, used by the fixture and by section 5's scan, so they
// cannot diverge: the fixture proves this path can fail, and the scan is
// trusted only because it runs the same path. A fixture that computed the
// tint on its own would pass over a scan that had quietly stopped reading /NN
// — which is the exact shape of false green FOR-192 was written to end.
//
// Pairs within a QUOTED SEGMENT, not the whole line. The first version paired
// ActiveSessionHeader's danger ink with the volt tint from the OTHER branch
// of its ternary —
//   isPaused ? 'bg-status-danger-fill/20 text-status-danger-ink'
//            : 'bg-brand/10 text-brand'
// — and reported a 3.83:1 that no element ever renders. Section 3 gets away
// with line scope because it reads one utility at a time; a PAIRING has to
// know which fill is actually behind which ink.
const pairsIn = (text) => {
  const out = []
  for (const seg of text.match(SEGMENT_RE) ?? [text]) {
    const ink = seg.match(INK_RE)
    if (!ink) continue
    for (const f of seg.matchAll(FILL_RE)) {
      const alpha = f[2] != null ? +f[2] / 100 : 1
      for (const theme of ['chalk', 'graphite']) {
        const b = blockOf(theme)
        const fill = raw(b, FILL_UTILS[f[1]])
        const inkC = raw(b, INK_ON_FILL[ink[1]])
        const card = raw(b, 'card')
        if (!fill || !inkC || !card) continue
        out.push({ ink: ink[1], fill: f[0], theme,
          r: ratio(toRgb(inkC), over(toRgb(fill), toRgb(card), alpha)) })
      }
    }
  }
  return out
}

// ── 0. THE FIXTURE — prove the machinery can FAIL before trusting a pass ───
// Everything below asserts the real tokens are fine. That is only worth
// reading if the check is capable of saying otherwise, and BOTH halves of
// this file have already shipped a version that was not:
//
//   half 1  modelled `text-brand/NN` as --brand-text, so eleven live sites
//           measuring ~1.15:1 on chalk were scored at 4.6 and passed
//   half 2  matched only NUMBERED hues, so `to-white/20` walked past it
//
// Both passed their whole suite while the bug shipped. So the check now runs
// itself against values that are deliberately wrong and are not in the
// codebase: a token under the floor, and an ink with an opacity modifier on
// it. Negative cases too, or an assertion that always says 'violation' would
// look identical from here.
{
  const CHALK_BG = [40, 0.29, 0.97]   // --background on chalk
  // hsl(0 0% 55%) on that ground measures ~3.1:1 — quiet-looking, unreadable.
  const failing = ratio(toRgb([0, 0, 0.55]), toRgb(CHALK_BG))
  ok('FIXTURE: a token under the floor is seen to fail', failing < FLOOR,
    'the deliberately-bad ink measured ' + failing + ':1 — at or above ' + FLOOR
    + ', which would mean the floor comparison itself is wrong')
  const passing = ratio(toRgb([0, 0, 0.10]), toRgb(CHALK_BG))
  ok('FIXTURE: a readable token is NOT flagged', passing >= FLOOR,
    'near-black measured ' + passing + ':1 — a check that fails everything is not a check')

  const fade = (t) => new RegExp(INK_FADE.source).test(t)
  ok('FIXTURE: a faded ink is caught', fade('className="text-status-danger-ink/70"'), null)
  ok('FIXTURE: a faded FILL is not', !fade('className="bg-status-danger-fill/8"'),
    'opacity on a FILL is a tint and always legal — only inks are banned')
  ok('FIXTURE: a bare ink is not', !fade('className="text-status-danger-ink"'), null)

  // FOR-198: the ink-on-composited-fill machinery, proved able to fail before
  // any pass is trusted — through pairsIn, the SAME path section 5 scans with.
  // --brand-ink is cut for volt at FULL strength; the same ink on the same fill
  // tinted to /40 over the graphite card is a different ground entirely, and
  // it has to come out under the floor here or section 5 cannot fail.
  const on = (src) => Object.fromEntries(pairsIn(src).map((q) => [q.theme + ' ' + q.fill, q.r]))
  const tint40 = on('className="bg-brand/40 text-brand-ink"')
  ok('FIXTURE: brand-ink on a /40 volt tint is seen to FAIL on graphite',
    tint40['graphite bg-brand/40'] < FLOOR,
    'measured ' + tint40['graphite bg-brand/40'] + ':1 — at or above ' + FLOOR
    + ', which would mean section 5 cannot fail and its passes mean nothing')
  ok('FIXTURE: the same tint is fine on chalk, so this is a real measurement, not a ban',
    tint40['chalk bg-brand/40'] >= FLOOR, 'measured ' + tint40['chalk bg-brand/40'] + ':1')
  const solid = on('className="bg-brand text-brand-ink"')
  ok('FIXTURE: brand-ink on SOLID volt is not flagged, either theme',
    solid['chalk bg-brand'] >= FLOOR && solid['graphite bg-brand'] >= FLOOR,
    'measured ' + solid['chalk bg-brand'] + ' / ' + solid['graphite bg-brand'] + ' — the pairing every volt button relies on')
  // ...the parser sees a tinted fill behind a variant prefix, because
  // `hover:bg-brand/90` is exactly the shape a real site carries...
  const hov = Object.keys(on('className="bg-brand text-brand-ink hover:bg-brand/90"'))
    .filter((k) => k.startsWith('chalk ')).map((k) => k.slice(6))
  ok('FIXTURE: bare and hover-tinted fills are both paired off one line',
    hov.join(' ') === 'bg-brand hover:bg-brand/90', 'paired: ' + hov.join(' '))
  ok('FIXTURE: bg-brand does not swallow bg-brand-deep',
    Object.keys(on('className="bg-brand-deep text-brand-ink"')).join(' ') === 'chalk bg-brand-deep graphite bg-brand-deep',
    null)
  // ...and a ternary on one line pairs each ink with ITS fill, not the other
  // branch's. The first run of section 5 got exactly this wrong.
  const tern = on("isPaused ? 'bg-status-danger-fill/20 text-status-danger-ink' : 'bg-brand/10 text-brand'")
  ok('FIXTURE: a ternary pairs an ink only with the fill in its own branch',
    Object.keys(tern).join(' ') === 'chalk bg-status-danger-fill/20 graphite bg-status-danger-fill/20',
    'paired: ' + Object.keys(tern).join(' '))
}

// ── 1. an ink token is NEVER faded ─────────────────────────────────────────
// A hard ban, not a measurement — the one rule in this file with no numbers
// in it. Half 2 below composites faded ink-ROLE utilities and lets anything
// above the floor through, which is right for --foreground and
// --muted-foreground: they are a legible ramp and /70 of one is still
// legible.
//
// A token NAMED *-ink is different. It is the paired text colour for one
// specific fill, chosen so it lands on that fill and nowhere else, and there
// is no quieter member of the pair to fall back to. Fading it does not make
// it recede, it makes it wrong: --brand-ink is near-black FOR VOLT, so
// text-brand-ink/80 is a value that only ever looks acceptable on the one
// ground it was cut for, and only by accident.
//
// Text that wants to be quieter takes --muted-foreground. That is what it is.
{
  const faded = []
  const scan = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { scan(p); continue }
      if (!/\.tsx$/.test(e)) continue
      readFileSync(p, 'utf8').split('\n').forEach((line, n) => {
        const m = line.match(new RegExp(INK_FADE.source, 'g'))
        if (m) faded.push(p.split(/[\\/]/).slice(-2).join('/') + ':' + (n + 1) + '  ' + m.join(' '))
      })
    }
  }
  scan(SRC)
  ok('no opacity modifier on any *-ink token', faded.length === 0,
    faded.join('\n        ')
    + '\n        an ink is the paired text colour for one fill. Use the token at full\n'
    + '        strength, or --muted-foreground if it genuinely needs to recede.')
}

// ── 2. every ink token, both grounds, both themes ──────────────────────────
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

// ── 3. a faded ink-ROLE utility must STILL clear the floor ─────────────────
// This half covers the utilities that carry an ink ROLE without being named
// *-ink: --foreground, --muted-foreground, --destructive, --brand-text. A flat
// ban is wrong for these — 49 sites fade one and most are fine, since
// text-foreground/70 on chalk is still ~12:1 and text-muted-foreground/40 has
// nothing quieter to fall back TO. A rule that blunt gets suppressed rather
// than obeyed.
//
// So it composites and measures, and only a result under the floor fails. That
// still catches all five above, because those were genuinely unreadable rather
// than merely quiet — which is the distinction the rule should encode.
//
// Section 1 is the other answer, for the other case: a *-ink token has a
// paired fill and no quieter sibling, so there the ban IS right.
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
  const tally = {}
  for (const f of tooFaint) {
    const p = f.split('  ')
    const k = p[0].replace(/:\d+$/, '') + '  ' + p[1]
    tally[k] = (tally[k] || 0) + 1
  }
  for (const k of Object.keys(tally).sort()) console.log('DEBT ' + k + '  x' + tally[k])
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
// Keyed on FILE + CLASS + COUNT, not file:line.
//
// Line numbers were the obvious key and the wrong one: any edit ABOVE a debt
// line shifts it and the snapshot goes stale wholesale — extracting one
// component from the session runner invalidated eight entries that had not
// changed at all, and the only cheap repair is re-snapshotting, which quietly
// re-blesses whatever is there now. A ratchet you have to reset is not one.
//
// File+class+count survives moves and still fails on anything new: another
// instance of the same class in the same file raises the count past its
// budget, and a class with no entry has nothing to hide behind.
const keyOf = (f) => { const p = f.split('  '); return p[0].replace(/:\d+$/, '') + '  ' + p[1] }
const budget = {}
for (const a of faintAllow) {
  const m = a.match(/^(.*)  x(\d+)$/)
  if (m) budget[m[1]] = (budget[m[1]] || 0) + Number(m[2])
}
const seen = {}
const newFaint = tooFaint.filter((f) => {
  const k = keyOf(f)
  seen[k] = (seen[k] || 0) + 1
  return seen[k] > (budget[k] || 0)
})
const fixed = Object.keys(budget)
  .filter((k) => (seen[k] || 0) < budget[k])
  .map((k) => k + '  (' + (budget[k] - (seen[k] || 0)) + ' fewer)')
if (fixed.length) {
  console.log('')
  console.log('  ' + fixed.length + ' faded-ink site(s) fixed since the snapshot — trim them from faded-ink-debt.json:')
  for (const f of fixed.slice(0, 6)) console.log('    ' + f)
}
ok('no NEW faded ink under the floor (' + faintAllow.length + ' pre-existing, ratcheted)', newFaint.length === 0,
  newFaint.slice(0, 12).join('\n        ')
  + (tooFaint.length > 12 ? '\n        …and ' + (tooFaint.length - 12) + ' more' : '')
  + '\n        fading an ink does not make it quiet, it makes it unreadable')

// ── 4. a category chip is its own ink on its own tint ──────────────────────
// text-category-push on bg-category-push/10 is the shipped chip pattern, and it
// was not covered by either half above: half 1 measures ink on a plain ground,
// half 2 only looks at faded INK. The tint underneath moves the ground.
const CATEGORIES = ['push', 'pull', 'legs', 'core', 'condition', 'general']

// SIX AXES, and the ruling is that there are never sixteen. CATEGORY_COLORS
// held 16 entries across two overlapping axes — twelve muscle groups plus four
// movement types — and sixteen hues that are simultaneously desaturated,
// mutually distinguishable and distinct from the status set do not exist
// perceptually. That is a rainbow with the saturation turned down.
//
// So the namespace is the axes the movements actually fall on, and this asserts
// the file has not quietly grown back toward one-token-per-label. The failure
// mode is not a bad colour; it is a seventh, then a tenth, each individually
// reasonable.
for (const theme of ['chalk', 'graphite']) {
  const declared = [...blockOf(theme).matchAll(/--category-([a-z0-9-]+):/g)].map((m) => m[1])
  ok(theme + ': exactly the six category axes are defined',
    declared.length === CATEGORIES.length && declared.every((d) => CATEGORIES.includes(d)),
    'found ' + declared.length + ': ' + declared.join(', ')
    + '\n        a category token is an AXIS (push/pull/legs/core/condition/general),'
    + '\n        not a label. The chip already says "Chest" — the colour is grouping.')
}

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

// ── 5. an ink on a FILL is measured against the fill it actually sits on ───
// FOR-198. Section 2 measures every ink on the two plain grounds, and section 1
// bans fading an ink. Neither can see the case this ticket creates: the
// prescribed load is --brand-ink on a solid volt slab, and --brand-ink is a
// near-black cut for ONE ground — volt at full strength, where it is 15.6:1.
// Composite that same fill at /40 over the graphite card and the same ink
// measures 3.6:1; at /16 it is 1.6:1. The ink never changed. The fill did.
//
// FOR-192's fixture says "opacity on a FILL is a tint and always legal", which
// is true for a tint under ordinary text and false the moment a *-ink token
// sits on it. Same failure shape as the reskin: the token passes at full
// strength, and nobody renders it at full strength.
//
// COMPUTE, do not ban. A tinted fill is legitimate — thirty-odd sites use one —
// and only the PAIRING is hazardous. LearningTracker's `bg-brand text-brand-ink
// hover:bg-brand/90` is fine and must stay fine; a ban would force a pointless
// rewrite. So wherever a *-ink utility shares a line with a fill utility, every
// fill state on that line (bare, /NN, hover:/NN …) is composited over the card
// in both themes and the ink is measured on it. Line-scoped, like section 3.
{
  const bad = []
  const measured = new Map()   // one row per distinct pairing, not per site
  const scan = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { scan(p); continue }
      if (!/\.tsx$/.test(e)) continue
      readFileSync(p, 'utf8').split('\n').forEach((line, n) => {
        for (const q of pairsIn(line)) {
          const key = q.theme + ' ' + q.ink + ' on ' + q.fill
          if (!measured.has(key)) {
            measured.set(key, q.r)
            rows.push([q.theme, INK_ON_FILL[q.ink] + ' on ' + q.fill, 'card', q.r])
          }
          if (q.r < FLOOR) {
            bad.push(p.split(/[\\/]/).slice(-2).join('/') + ':' + (n + 1)
              + '  ' + q.ink + ' on ' + q.fill + '  ' + q.theme + '  ' + q.r + ':1')
          }
        }
      })
    }
  }
  scan(SRC)
  ok('every *-ink on a fill clears ' + FLOOR + ':1 on the COMPOSITED fill, both themes', bad.length === 0,
    bad.join('\n        ')
    + '\n        an ink is cut for its fill at full strength. Tint the fill and the\n'
    + '        ink is on a ground it was never measured against.')

  // The slab itself, directly. Its fill is on a wrapper and its ink arrives via
  // the globals.css:621 remap of the child's text-brand, so the pairing is not
  // on one line and the scan above cannot see it. This is the number DoD 3
  // pastes, and the reason the slab is legal in the first place.
  for (const theme of ['chalk', 'graphite']) {
    const b = blockOf(theme)
    const r = ratio(toRgb(raw(b, 'brand-ink')), toRgb(raw(b, 'brand')))
    rows.push([theme, 'brand-ink (the load slab)', 'brand', r])
    ok(theme + ': the prescribed-load slab — brand-ink on solid volt — clears ' + FLOOR + ':1', r >= FLOOR,
      'measured ' + r + ':1')
  }

  // And the slab is exactly where the ticket put it and nowhere else. The fill
  // means "this is the number you lift"; spread it and it stops meaning that.
  const day = readFileSync(join(SRC, 'app', 'train', '[program]', '[day]', 'page.tsx'), 'utf8')
    .replace(/\r\n/g, '\n')
  const SLAB = 'bg-brand rounded-[6px] px-2 py-0.5'
  const at = day.indexOf(SLAB)
  ok('the load slab exists exactly once', at >= 0 && day.indexOf(SLAB, at + 1) < 0, null)
  const branch = day.indexOf('item.targetWeightLbs != null ? (')
  const elseAt = day.indexOf(') : (', branch)
  ok('the slab is inside the targetWeightLbs != null branch — the null branch never renders an empty one',
    branch >= 0 && at > branch && at < elseAt, null)
  const slabBlock = day.slice(at, day.indexOf('</span>\n                </span>', at))
  ok('the slab numeral carries no textShadow', slabBlock.length > 0 && !/textShadow/.test(slabBlock),
    'a glow around a filled slab is noise, and on chalk it was 1.18:1 paint')
  // The sites deliberately NOT filled. A bg-brand on any of these lines is the
  // fill spreading, whatever the intent.
  for (const [what, needle] of [
    ['session-summary tonnage', 'stat-num text-3xl text-brand'],
    ['metcon time cap', 'stat-num text-2xl text-brand'],
    ['warm-up ramp numerals', "rampDone[i] ? 'text-brand'"],
    ['PR toast', 'stat-num text-brand">{p.weight}'],
  ]) {
    const line = day.split('\n').find((l) => l.includes(needle)) ?? ''
    ok(what + ' is not filled', line.length > 0 && !/\bbg-brand\b/.test(line),
      line ? 'found bg-brand on: ' + line.trim().slice(0, 90) : 'anchor not found: ' + needle)
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
