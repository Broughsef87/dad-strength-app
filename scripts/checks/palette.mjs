// ═══════════════════════════════════════════════════════════════════════════
// RAW PALETTE — colour reaches the screen through a token, or it fails here.
//
// The sweep this guards was ~210 utilities across 22 files. Doing that once is
// an afternoon; doing it every time someone reaches for bg-emerald-500 is an
// archaeology exercise. The allowlist is empty and is meant to stay that way.
//
// Two rules learned by getting this wrong before:
//
//   1. UNNUMBERED COLOUR WORDS COUNT. The first version of this check matched
//      only numbered hues, so `to-white/20` and `bg-black/70` walked straight
//      past it — and one was live. A palette check that misses bg-black is not
//      a palette check.
//
//   2. NEUTRALS ARE NOT IN SCOPE. gray/slate/zinc/neutral/stone are a legitimate
//      achromatic ramp, 49 utilities of it. Sweeping those would be busywork and
//      would bury the 190 that actually encode meaning.
//
// What replaced the raw utilities, and why there are two namespaces:
//   --status-*   semantic. how a thing is DOING. fill/ink pairs.
//   --category-* identity. WHICH thing it is. A muscle group is never "good".
//   --scrim / --sheen  do not follow the theme; a scrim is dark and a sheen is
//                      light on both grounds, by definition of what they do.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('../../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

let allow = []
try {
  allow = JSON.parse(readFileSync(join(SRC, '..', 'scripts', 'checks', 'palette-allowlist.json'), 'utf8'))
} catch { allow = [] }

const PREFIX = '(?:bg|text|border|from|to|via|ring|shadow|fill|stroke|decoration|outline|divide|accent|caret|placeholder)'
const HUES = '(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
// numbered hue, or the unnumbered colour words — rule 1 above
const RAW = new RegExp('\\b' + PREFIX + '-(?:' + HUES + '-\\d{2,3}|white|black)(?:/\\[?[\\d.]+\\]?)?\\b', 'g')

const hits = []
let scanned = 0
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) { walk(p); continue }
    if (!/\.tsx$/.test(e)) continue
    const rel = p.slice(p.indexOf('src') + 4).replace(/\\/g, '/')
    if (allow.includes(rel)) continue
    scanned++
    readFileSync(p, 'utf8').split('\n').forEach((line, n) => {
      // a colour named inside a comment is prose, not a style
      const code = line.replace(/\/\/.*$/, '')
      for (const m of code.match(RAW) || []) hits.push(rel + ':' + (n + 1) + '  ' + m)
      // Colour smuggled inside an arbitrary value. shadow-[...rgba(245,158,11,.05)]
      // is a raw hue reaching the screen with no token in sight, and the
      // class-name pattern above cannot see it. Neutral rgb (all channels equal,
      // i.e. a shadow) is allowed; a HUE is not.
      for (const a of code.match(/\[[^\]]*\]/g) || []) {
        for (const col of a.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g) || []) {
          const [r, g, bl] = col.match(/\d+/g).map(Number)
          if (!(r === g && g === bl)) hits.push(rel + ':' + (n + 1) + '  ' + col + ')')
        }
        for (const hx of a.match(/#[0-9a-fA-F]{3,8}\b/g) || []) {
          hits.push(rel + ':' + (n + 1) + '  ' + hx)
        }
      }
    })
  }
}
walk(SRC)

console.log('')
console.log('  ── raw palette ' + '─'.repeat(46))
console.log('    files scanned             ' + scanned)
console.log('    allowlisted               ' + allow.length)
console.log('    raw utilities             ' + hits.length)
console.log('')

if (hits.length) {
  console.log('  ✗ ' + hits.length + ' raw palette utilit(ies) outside the token system:')
  for (const h of hits.slice(0, 20)) console.log('    - ' + h)
  if (hits.length > 20) console.log('    …and ' + (hits.length - 20) + ' more')
  console.log('')
  console.log('    Use a token: --status-*-fill / --status-*-ink for state,')
  console.log('    --category-* for identity, --scrim / --sheen for the two that')
  console.log('    must not follow the theme. Neutrals (gray/slate/zinc) are fine.')
  process.exit(1)
}
console.log('  ✓ no raw palette utilities — colour reaches the screen through tokens')
