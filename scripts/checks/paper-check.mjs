// The Program Card — design rules that are load-bearing, not cosmetic.
//
// Every assertion here exists because breaking it destroys MEANING, not looks.
// The reskin's whole claim is that the three inks encode engine / athlete /
// verdict. An ink applied to everything encodes nothing, so these are the
// guards on that claim.
//
// FOR-186. Source assertions — the honest way to pin a CSS contract without a
// browser, and the same approach as onboarding-check.mjs.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const css = read('../../src/app/globals.css')
const SRC = new URL('../../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const layout = read('../../src/app/layout.tsx')

let checks = 0
const fails = []
const ok = (label, cond, detail) => {
  checks++
  if (!cond) fails.push(label + (detail ? '  ->  ' + detail : ''))
}

// ── 1. Courier marks engine values, and nothing else ────────────────────────
// The rule the athlete set: if every word is typewriter, "printed" stops
// saying the engine decided this. Courier reaches text through --font-mono
// and .ink-printed only; --font-sans must NOT resolve to it.
const sans = (css.match(/--font-sans:\s*([^;]+);/) || [])[1] || ''
const mono = (css.match(/--font-mono:\s*([^;]+);/) || [])[1] || ''
ok('--font-sans is not the printed face',
  !/geist-mono|Courier/i.test(sans),
  'body prose would be typewriter, which makes "printed" meaningless: ' + sans.trim())
ok('--font-mono IS the printed face',
  /geist-mono|Courier/i.test(mono), mono.trim())
ok('--font-display is the chrome face, not the printed one',
  !/geist-mono|Courier/i.test((css.match(/--font-display:\s*([^;]+);/) || [])[1] || ''))

// ── 2. the three inks exist and are distinct ────────────────────────────────
for (const t of ['--ink-printed', '--ink-written', '--ink-stamped']) {
  ok(`${t} is defined`, new RegExp(t + ':\\s*[^;]+;').test(css))
}
const inkVals = ['--ink-printed', '--ink-written', '--ink-stamped']
  .map((t) => ((css.match(new RegExp(t + ':\\s*([^;]+);')) || [])[1] || '').trim())
ok('the three inks are three different colours',
  new Set(inkVals).size === 3, inkVals.join(' | '))

// ── 3. the legibility floor the ticket put ABOVE the ink rule ───────────────
ok('athlete values never fall below 15px',
  /\.ink-written\s*\{[^}]*font-size:\s*max\(15px/.test(css),
  '.ink-written has no 15px floor — a handwriting face at 13px is texture, not a number')
ok('columns revert to the printed face',
  /\.ink-written-col\s*\{[^}]*font-family:\s*var\(--font-mono\)/.test(css),
  'Kalam has no tabular figures; a column of logged sets will not align in it')
ok('columns keep the ballpoint colour',
  /\.ink-written-col\s*\{[^}]*color:\s*hsl\(var\(--ink-written\)\)/.test(css),
  'the column stops saying who wrote it')

// ── 4. the stamp is a verdict, not a decoration ─────────────────────────────
ok('the stamp animation is a single settle', /@keyframes ds-stamp-set\b/.test(css))
ok('the stamp animation is ~200ms', /animation:\s*ds-stamp-set\s+200ms/.test(css))
ok('reduced motion renders the stamp static, not faster',
  /prefers-reduced-motion[^}]*\{[^]*?\.ds-stamp\s*\{[^}]*animation:\s*none/.test(css),
  'a shortened animation is not the same as no animation')
ok('the stamp multiplies into the paper', /\.ds-stamp\s*\{[^}]*mix-blend-mode:\s*multiply/.test(css))
ok('multiply is disabled on the dark ground',
  /\.dark\s+\.ds-stamp\s*\{[^}]*mix-blend-mode:\s*normal/.test(css),
  'multiply darkens toward the ground — on a dark desk it buries the red')

// MAX TWO STAMPS PER SCREEN. Counted per page file, since that is the closest
// static proxy for "a screen". This is the rule that makes a stamp mean
// something; it is worth failing a build over.
const pages = []
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (e === 'page.tsx') pages.push(p)
  }
}
walk(new URL('../../src/app', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
for (const p of pages) {
  const src = readFileSync(p, 'utf8')
  const n = (src.match(/<Stamp\b/g) || []).length
  if (n > 0) {
    ok(`at most two stamps on ${p.split(/[\\/]/).slice(-3).join('/')}`,
      n <= 2, `${n} stamps — a mark that appears everywhere is just a colour`)
  }
}

// ── 4b. the palette IS the notation ─────────────────────────────────────────
// Three inks and nothing else. A raw Tailwind hue reintroduces a fourth voice
// that means nothing in this system — a green chip on a beige form is a
// sticker. State is carried by weight and by the one ink that means stop.
{
  const HUES = 'red|rose|green|emerald|lime|teal|amber|yellow|orange|blue|sky|indigo|violet|purple|fuchsia|pink|cyan'
  const re = new RegExp(`\\b(?:text|bg|border|from|to|ring)-(?:${HUES})-\\d{2,3}\\b`, 'g')
  const offenders = []
  const walkSrc = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) walkSrc(p)
      else if (/\.tsx?$/.test(e)) {
        const hits = (readFileSync(p, 'utf8').match(re) || [])
        if (hits.length) offenders.push(`${p.split(/[\\/]/).slice(-2).join('/')} (${hits.length})`)
      }
    }
  }
  walkSrc(SRC)
  ok('no raw palette hues outside the three inks',
    offenders.length === 0,
    offenders.slice(0, 6).join(', '))

  // white is not on a paper form either — it reads as a hole in the sheet
  const whites = []
  const walkWhite = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) walkWhite(p)
      else if (/\.tsx?$/.test(e) && /\btext-white\b/.test(readFileSync(p, 'utf8'))) {
        whites.push(p.split(/[\\/]/).slice(-2).join('/'))
      }
    }
  }
  walkWhite(SRC)
  ok('no pure white text', whites.length === 0, whites.slice(0, 4).join(', '))
}

// ── 4c. focus must never equal the resting border ───────────────────────────
// Collapsing the palette turned focus:border-{hue} into focus:border-border,
// which is the SAME as the resting state — an invisible focus ring.
ok('focus state is distinguishable from rest',
  !/focus:(border|ring)-border\b/.test(
    (() => { let all = ''; const w = (d) => { for (const e of readdirSync(d)) {
      const p = join(d, e); if (statSync(p).isDirectory()) w(p)
      else if (/\.tsx$/.test(e)) all += readFileSync(p, 'utf8') } }; w(SRC); return all })()),
  'focus:border-border matches the resting border — the focus ring vanishes')

// ── 4d. the mark and the browser chrome are on paper too ────────────────────
// A volt favicon on a paper app is the most visible possible inconsistency:
// it is the one piece of brand the user sees BEFORE the page renders.
const manifest = JSON.parse(read('../../public/manifest.json'))
ok('manifest theme_color is paper, not graphite',
  manifest.theme_color === '#F0EDE6', String(manifest.theme_color))
ok('manifest background_color is paper',
  manifest.background_color === '#F0EDE6', String(manifest.background_color))
const appIcon = read('../../public/logo-suite/ds_app_icon.svg')
ok('the logo mark carries no volt', !/C6FF3F|CDFF4D/i.test(appIcon))
ok('the logo tile is cut, not moulded (radius <= 32 on a 1024 box)',
  (() => { const m = appIcon.match(/rx="(\d+)"/g) || []
    return m.every(v => parseInt(v.replace(/\D/g, ''), 10) <= 32) })(),
  'a 216px radius on a 1024 viewBox is an app tile, not a printed mark')
// ── 5. the sheet casts onto the desk ────────────────────────────────────────
// Paper #EBE0C4 on desk #F0EDE6 is 1.11:1 and the 1px rule is 1.61:1, so with
// no shadow the card edge is invisible and the layout flattens to one field.
ok('the card shadow is not none',
  !/--shadow-tile:\s*none/.test(css),
  'paper-on-desk is 1.11:1 — with no shadow there is no visible card')

// ── 6. fonts come from next/font, no new dependencies ───────────────────────
for (const f of ['Oswald', 'Courier_Prime', 'Kalam', 'Saira_Stencil_One']) {
  ok(`${f.replace(/_/g, ' ')} loads via next/font`,
    new RegExp(f + '\\s*\\(').test(layout))
}
ok('no external font stylesheet', !/fonts\.googleapis\.com/.test(layout),
  'the ticket requires next/font/google only')

console.log('\n' + '='.repeat(58))
if (fails.length) {
  console.log(`FAIL ${fails.length} of ${checks}:`)
  for (const f of fails) console.log('  - ' + f)
  process.exit(1)
}
console.log(`ALL GREEN — ${checks} paper/ink contract checks`)
