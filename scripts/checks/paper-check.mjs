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
// Comments in globals.css quote the old selectors while explaining why they
// were removed. A guard that trips on its own documentation is worse than no
// guard, so structural checks read the DECLARATIONS only.
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '')

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
  // Neutrals count. gray/slate/zinc/etc were absent from the first list, and
  // 49 of them survived the collapse — a grey box on a beige card is as
  // off-palette as a green one.
  const HUES = 'red|rose|green|emerald|lime|teal|amber|yellow|orange|blue|sky|indigo|violet|purple|fuchsia|pink|cyan|gray|grey|slate|zinc|neutral|stone'
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

// ── 4b-ii. the grain must not fight the layout ──────────────────────────────
// The grain lived on a ::before with `.tile > * { position: relative }` beneath
// it. That rule has the SAME specificity as Tailwind's .absolute and is emitted
// after it, so it silently un-positioned every absolutely-placed direct child
// of a card. Texture must never take a position away from content.
ok('the grain does not force positioning on card children',
  !/\.tile\s*>\s*\*|\.tile-lg\s*>\s*\*/.test(cssCode),
  'a `.tile > *` rule outranks .absolute and breaks positioned children')
ok('the grain is a background layer, not a stacking contest',
  /\.tile,\s*\n?\s*\.tile-lg\s*\{[^}]*background-image:\s*url\("data:image\/svg\+xml/.test(css) ||
  /background-image:\s*url\("data:image\/svg\+xml[^"]*"\);\s*\n\s*background-repeat/.test(css),
  'grain should paint from the card background, where it cannot outrank anything')

// ── 4b-iii. colours the sweep is prone to miss ──────────────────────────────
// The first pass covered text/bg/border/from/to/ring and missed shadow-, and
// missed hard-coded black/white entirely. Both showed up in review.
{
  const HUES2 = 'red|rose|green|emerald|lime|teal|amber|yellow|orange|blue|sky|indigo|violet|purple|fuchsia|pink|cyan|gray|grey|slate|zinc|neutral|stone'
  const extra = new RegExp(`\\b(?:shadow|fill|stroke|divide|outline|decoration|caret|accent)-(?:${HUES2})-\\d{2,3}\\b`)
  const hard = /\b(?:text|bg|border)-(?:black|white)\b/
  let all = ''
  const w = (d) => { for (const e of readdirSync(d)) {
    const p = join(d, e); if (statSync(p).isDirectory()) w(p)
    else if (/\.tsx?$/.test(e)) all += readFileSync(p, 'utf8') } }
  w(SRC)
  ok('no coloured shadows or other tinted utilities', !extra.test(all),
    'shadow-/fill-/stroke- carry hue too — the first sweep only covered six prefixes')
  ok('no hard-coded black or white', !hard.test(all),
    'neither is on the palette, and neither is theme-aware')
}

// ── 4b-iv. a fill and its text must not be the same ink ─────────────────────
// The worst bug of this reskin, and it came straight from a token decision:
// --brand used to be volt, so `bg-brand text-foreground` was near-black on
// bright green and read perfectly. Collapsing brand to INK made fill and text
// the same colour, and eleven primary CTAs became blank rectangles across ten
// files. Nothing in tsc, the build or a diff notices that.
{
  // Every pair here is CHECKED. There used to be a fourth entry — the benign
  // bg-card / text-card-foreground — kept "to document the shape" and excluded
  // by taking SAME.slice(0, 2) at the loop. That worked until a pair was added
  // in the middle, which silently pushed bg-foreground out of the slice and
  // deleted a live check without failing anything. A positional exclusion is a
  // booby trap for the next person to touch the list, so the documentation
  // moved into this comment where it cannot be indexed by accident:
  //   bg-card + text-card-foreground is the CORRECT pairing, not a collision.
  const SAME = [
    ['bg-brand', 'text-foreground'],       // both resolve to ink
    ['bg-brand', 'text-brand'],            // --brand-text is ink now, so also both
    ['bg-foreground', 'text-foreground'],
  ]
  const collisions = []
  const w = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { w(p); continue }
      if (!/\.tsx$/.test(e)) continue
      const src = readFileSync(p, 'utf8')
      // BOTH className forms. The first version of this guard scanned only
      // className="..." and passed green while seven collisions sat in
      // className={`...`} — which is where conditional state classes live, so
      // it was blind to exactly the case it existed for. A guard that reports
      // verified while the bug ships is worse than no guard.
      const spans = [
        ...[...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1]),
        ...[...src.matchAll(/className=\{`([^`]*)`\}/gs)].flatMap((m) =>
          // per quoted branch: `${on ? 'A' : 'B'}` is two independent states
          [...m[1].matchAll(/'([^']*)'/g)].map((q) => q[1]).concat(m[1].split('${')[0])
        ),
      ]
      for (const c of spans) {
        // a hover: variant that changes BOTH is not a collision
        const bare = c.replace(/\bhover:[^\s]+/g, '')
        for (const [fill, text] of SAME) {
          const hasFill = new RegExp(`(^|\\s)${fill}(\\s|$)`).test(bare)
          const hasText = new RegExp(`(^|\\s)${text}(\\s|$)`).test(bare)
          if (hasFill && hasText) {
            collisions.push(`${p.split(/[\\/]/).slice(-2).join('/')}: ${fill} + ${text}`)
          }
        }
      }
    }
  }
  w(SRC)
  ok('no fill paired with text of the same ink',
    collisions.length === 0,
    collisions.slice(0, 5).join('  |  ') + ' — invisible text')
}

// ── 4b-v. ...and a TINTED fill must not carry paper text ────────────────────
// The mirror of the check above, and it exists because the fix for that one
// created it. Repointing text on solid ink fills to --brand-ink was right; the
// script that did it matched \bbg-brand\b, which also matches bg-brand/5,
// because "/" is a word boundary. Sixteen tinted labels across eleven files
// were quietly repointed to paper-on-paper.
//
// A tint is not a fill. bg-brand/5 is five percent ink over paper, so it reads
// as paper with a wash — text on it must stay INK. Solid and tinted brand
// surfaces need opposite text colours, which makes "bg-brand" alone an
// ambiguous thing to match on, and ambiguity here is invisible in every gate
// except a human reading the rendered page.
//
// This scans ACROSS lines, not within one className. The first draft compared
// fill and text inside a single span and ran green against the real bug, where
// the tint sits on a <section> and the paper text on a <p> inside it — the
// parent/descendant shape is most of what the sweep script touched, so a
// same-span guard is green precisely where it is needed. Verified by putting
// the disclaimer regression back and watching this go red.
{
  const SOLID = /(^|[\s"'`])bg-(brand|foreground|primary|destructive)(\s|$|['"`])/
  // Tailwind writes an arbitrary opacity in brackets: bg-destructive/[0.02] is
  // a real one in profile/settings. Matching only /\d+ walked straight past it.
  const TINT = /(^|[\s"'`])bg-(brand|foreground|primary|destructive)\/(\d+|\[[^\]]*\])/
  const PAPER = /text-\[hsl\(var\(--brand-ink\)\)\]|(^|[\s"'`])text-brand-ink(\s|$|['"`])/
  const bad = []
  const w = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { w(p); continue }
      if (!/\.tsx$/.test(e)) continue
      const lines = readFileSync(p, 'utf8').split('\n')
      for (let i = 0; i < lines.length; i++) {
        const here = lines[i].replace(/\bhover:[^\s]+/g, '')
        if (!TINT.test(here)) continue

        // A ternary puts the tinted and the solid state on ONE line, and the
        // old rule skipped the whole line whenever a solid appeared anywhere on
        // it — so the tinted branch of every conditional went unchecked. Only
        // the branch that owns the tint matters, so read the branches apart.
        for (const br of [...here.matchAll(/'([^']*)'/g)].map((m) => m[1])) {
          if (TINT.test(br) && !SOLID.test(br) && PAPER.test(br)) {
            bad.push(`${p.split(/[\\/]/).slice(-2).join('/')}:${i + 1}`)
          }
        }
        // Walking into the element only makes sense when the line is
        // unambiguously a tint; with both present there is no way to tell which
        // one a descendant belongs to, and guessing is how the last sweep
        // produced fourteen false alarms.
        if (SOLID.test(here)) continue
        // the tint's own line, then into the element it opens — stop at the
        // next background, which is where this element's influence ends
        for (let j = i; j < Math.min(i + 6, lines.length); j++) {
          if (j > i && /\bbg-[a-z[]/.test(lines[j])) break
          if (PAPER.test(lines[j])) {
            bad.push(`${p.split(/[\\/]/).slice(-2).join('/')}:${j + 1}`)
            break
          }
        }
      }
    }
  }
  w(SRC)
  ok('no tinted fill paired with paper text',
    bad.length === 0,
    bad.slice(0, 6).join('  |  ') + ' — paper on paper, invisible')
}
// ── 4b-vi. solid fills must declare their own text colour ───────────────────
// The structural half of the fix, pinned so it cannot be deleted as "an odd
// rule nobody needs". Three rounds of this bug were fixed by hunting call
// sites; each round cleared the instances in the report and left the class of
// bug intact, so the next round found more. The fill declaring its own colour
// ends the class: a new `bg-brand` written next month inherits paper without
// anyone remembering this rule exists.
//
// It must stay inside :where(). That is not stylistic — :where() contributes
// ZERO specificity, so the declaration acts as a default that any explicit
// utility still beats. Promote it to a plain selector and it starts winning
// over text-brand-text, .ink-written and .ds-stamp, and the three-ink contract
// quietly collapses onto one colour inside every filled element.
//
// Deliberately NOT extended to a lookahead guard over descendants. I wrote one;
// it could not tell a child from a sibling, and flagged a progress bar, a 6px
// freshness dot, an absolutely-positioned badge and a ternary's unselected
// branch — 14 false alarms against 4 real ones. A guard with that ratio gets
// muted, and a muted guard is worse than none. Descendants that set their own
// colour explicitly stay a review question; the default handles the rest.
{
  const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')
  const m = css.match(/:where\(([^)]*)\)\s*\{\s*color:\s*hsl\(var\(--brand-ink\)\)/)
  const fills = m ? m[1].split(',').map((s) => s.trim()) : []
  ok('solid ink fills carry their own text colour (zero-specificity default)',
    !!m && ['.bg-brand', '.bg-foreground', '.bg-primary', '.bg-destructive'].every((f) => fills.includes(f)),
    `:where() default missing or incomplete — found [${fills.join(' ')}]`)
}
// ── 4b-vii. inside a fill: inks yield colour, stamps stay off entirely ───────
// Two halves of the same finding, which only showed up under a computed-style
// probe in DARK mode — no source read would have caught it, because both sides
// were "correct" tokens that happen to resolve to the same colour on lamplight.
//
//   .ink-printed inside a solid fill   1.00:1   text identical to its ground
//   .ink-written inside a solid fill   2.29:1   under the 4.5:1 floor
//   a stamp      inside a solid fill   2.61:1   under even the 3:1 floor
//
// The first two are fixed in CSS: the ink keeps its FACE and yields its colour,
// which is the standing rule that legibility wins wherever it fights the ink
// contract. Courier against Kalam still carries printed-versus-written without
// help from hue, so the contract survives the concession.
//
// The stamp cannot be fixed that way — red IS the verdict, and a recoloured
// stamp is a stencil face saying nothing — so it stays a constraint and gets a
// tripwire instead. Both currently have zero occurrences, which is what makes
// these worth having: a guard that fires zero times today is signal when it
// ever fires, unlike the descendant lookahead I rejected at 14 false alarms
// to 4 real ones.
{
  const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')
  ok('inks inside a fill yield colour, keep face',
    (() => {
      const flat = css.replace(/\s+/g, ' ')   // a selector may wrap lines
      // Every fill against every ink, in BOTH positions. Proving one pairing
      // and calling the rule verified is the same false confidence twice over:
      // descendant-only was the shipped bug, and bg-brand-only would let the
      // other three fills be dropped silently.
      const FILLS = ['bg-brand', 'bg-foreground', 'bg-primary', 'bg-destructive']
      const INKS = ['ink-printed', 'ink-written', 'text-brand']
      return FILLS.every((f) => INKS.every((k) => {
        const desc = new RegExp(`:is\\([^)]*\\.${f}[^)]*\\) :is\\([^)]*\\.${k}[^)]*\\)`)
        const same = new RegExp(`:is\\([^)]*\\.${f}[^)]*\\):is\\([^)]*\\.${k}[^)]*\\)`)
        return desc.test(flat) && same.test(flat)
      }))
    })(),
    'the fill/ink correction is missing a position — same-element bg-brand + ink-printed is 1.00:1')

  const hits = []
  const w = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { w(p); continue }
      if (!/\.tsx$/.test(e)) continue
      const L = readFileSync(p, 'utf8').split('\n')
      for (let i = 0; i < L.length; i++) {
        if (!/(^|[\s"'`])bg-(brand|foreground|primary|destructive)(\s|$|['"`])/.test(L[i])) continue
        if (L[i].trimEnd().endsWith('/>')) continue
        for (let j = i; j < Math.min(i + 8, L.length); j++) {
          if (/<Stamp\b|\bds-stamp\b/.test(L[j])) {
            hits.push(`${p.split(/[\\/]/).slice(-2).join('/')}:${j + 1}`)
            break
          }
        }
      }
    }
  }
  w(SRC)
  ok('no stamp on a filled surface',
    hits.length === 0,
    hits.join('  |  ') + ' — stamp red on a fill is 2.61:1; verdicts go on the paper')
}
// ── 4b-viii. the sign-in widget takes tokens, never literals ────────────────
// <Auth> is third-party and takes its palette as VALUES rather than classes,
// so it is the one surface a reskin cannot reach by restyling. It had been
// handed two hand-maintained lists of hex literals — one per theme — and had
// therefore been silently left behind for a whole design generation: the
// primary button still rendered #CE0928, the retired cockpit red, on paper,
// and the Google button was pure white, which the contract bans outright.
//
// Nothing caught it because nothing was wrong in the app's own CSS. The bug
// lived in a JS object that no stylesheet, token or class-based guard reads.
//
// Every value must now be hsl(var(--token)), so the widget resolves through
// the same cascade as everything else and cannot drift again. This also
// deleted the light/dark duplication that made the drift invisible: one list
// that follows the theme beats two that have to be remembered.
{
  const src = readFileSync(join(SRC, 'app', 'page.tsx'), 'utf8')
  const m = src.match(/const authColors = \{([\s\S]*?)\n  \}/)
  const body = m ? m[1].replace(/\/\/[^\n]*/g, '') : ''
  const values = [...body.matchAll(/:\s*'([^']*)'/g)].map((v) => v[1])
  const literals = values.filter((v) => !/^hsl\(var\(--[a-z0-9-]+\)\)$/.test(v))
  ok('sign-in widget palette is tokens, not literals',
    !!m && values.length >= 12 && literals.length === 0,
    !m ? 'authColors object not found in page.tsx'
       : `raw literals in the auth palette: ${literals.join(' ')} — it will drift`)
}
// ── 4b-ix. no colour smuggled in as a VALUE ─────────────────────────────────
// The class of bug that hid both of the worst finds on this branch. A colour
// written as a class is visible to every guard here; a colour written as a hex
// literal in a JS object or an inline style is invisible to all of them, and to
// the token system entirely. It cannot follow the theme, so it survives a
// redesign untouched and nobody notices:
//
//   authColors in page.tsx    #CE0928, the retired cockpit red, still painting
//                             the primary sign-in button on paper
//   RecoveryProtocol.tsx      #10B981 emerald via inline style, 1.95:1 on
//                             paper — there is no green in this design at all
//
// Both surfaced only by probing computed styles in a browser. Neither would
// ever have failed a source-based check, because neither was wrong in CSS.
//
// The one legitimate exception is the themeColor meta in layout.tsx: browser
// chrome is painted by the OS before any stylesheet exists, so it can only take
// a literal. It is allowed by path, and the paper/lamplight values there are
// asserted separately.
{
  const HEX = /['"]#[0-9a-fA-F]{3,8}['"]/g
  const offenders = []
  const w = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { w(p); continue }
      if (!/\.tsx$/.test(e)) continue
      if (/layout\.tsx$/.test(p)) continue          // themeColor, see above
      readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
        const t = l.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
        const code = l.split('//')[0]
        for (const m of code.match(HEX) || []) {
          offenders.push(`${p.split(/[\\/]/).slice(-2).join('/')}:${i + 1} ${m}`)
        }
      })
    }
  }
  w(SRC)
  ok('no colour smuggled in as a literal value',
    offenders.length === 0,
    offenders.slice(0, 5).join('  |  ') + ' — a hex cannot follow the theme')
}
// ── 4b-x. a scrim must not be keyed to a colour that flips ──────────────────
// Found by a pre-merge audit, in five modals, one commit from production.
//
// The palette sweep replaced bg-black/70 with bg-[hsl(var(--foreground))]/70.
// Banning pure black was right. Reaching for --foreground was not: it is ink on
// paper and CREAM on lamplight, so the scrim inverted. Measured in the
// production build, dark theme:
//
//   page behind the modal      L 0.007
//   scrim, before the sweep    L 0.002   (bg-black/70)   recedes the page
//   scrim, after the sweep     L 0.367   rgb(167,163,154) a grey sheet over
//                                        the entire dark UI
//
// A scrim's entire job is to push the page back, so it is the one colour in the
// system that must NOT follow the theme. --scrim is defined in :root and
// deliberately not overridden in .dark; the absence is the feature.
//
// tsc, the build, all 41 other checks and four Codex passes were green over
// this the whole time. Nothing here was wrong as CSS — it was wrong as
// meaning, and only in one theme.
{
  const FLIPPING = /bg-\[hsl\(var\(--(foreground|brand|card|popover|primary)\)\)\]\/\d+/
  const OVERLAY = /\b(fixed|absolute)\s+inset-0\b/
  const bad = []
  const w = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { w(p); continue }
      if (!/\.tsx$/.test(e)) continue
      const L = readFileSync(p, 'utf8').split('\n')
      for (let i = 0; i < L.length; i++) {
        if (!OVERLAY.test(L[i])) continue
        // the fill may sit on the overlay's own line or the className below it
        for (let j = i; j < Math.min(i + 3, L.length); j++) {
          const m = L[j].match(FLIPPING)
          if (m) {
            bad.push(`${p.split(/[\\/]/).slice(-2).join('/')}:${j + 1} ${m[0]}`)
            break
          }
        }
      }
    }
  }
  w(SRC)
  ok('no scrim keyed to a theme-flipping colour',
    bad.length === 0,
    bad.join('  |  ') + ' — use --scrim; these invert on lamplight')

  const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')
  const root = css.match(/:root\s*\{[\s\S]*?\n  \}/)
  const dark = css.match(/\.dark\s*\{[\s\S]*?\n  \}/)
  ok('--scrim is defined once and does NOT follow the theme',
    !!root && /--scrim:/.test(root[0]) && !!dark && !/--scrim:/.test(dark[0]),
    'define --scrim in :root only — overriding it in .dark is what re-inverts the scrim')
}

// ── 4b-xi. the card class must not outrank the utilities written on it ──────
// Tailwind v4 emits utilities into a LAYER, and any unlayered rule beats every
// layered one regardless of specificity. So an unlayered `.tile { border: ... }`
// silently defeats every border-* utility written on a card — no error, no
// failing test, the border simply stops responding.
//
// Master's .tile carried no border, so those utilities worked. Adding the
// hairline here broke five live sites: the accent border on the "Update Your
// Maxes" panel, and three hover:border-brand/30 states on the profile screen,
// which fail in the most deniable way there is — a hover that does nothing.
{
  const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')
  const flat = css.replace(/\r\n/g, '\n')
  const layered = /@layer components\s*\{[\s\S]{0,400}?\.tile\b[\s\S]{0,300}?border:/.test(flat)
  // an unlayered .tile block that sets a border is the bug
  const unlayered = /\n\.tile[^{]*\{[^}]*border:/.test(flat)
  ok('.tile is layered so border-* utilities still win',
    layered && !unlayered,
    'the .tile border block is unlayered — it defeats every border-* utility on a card')
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
// ── 4e. the stamp ink and the error ink are not the same red ───────────
// They were, and it failed AA. --ink-stamped only ever renders at 22px, so it
// needs 3:1; --destructive carries text-xs error copy, so it needs 4.5:1. One
// value cannot serve both, and sharing one is how the error text ended up at
// 4.23:1 on paper.
{
  const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'))
  const dest = (lightBlock.match(/--destructive:\s*([^;]+);/) || [])[1]
  const stamp = (lightBlock.match(/--ink-stamped:\s*([^;]+);/) || [])[1]
  // This used to assert `dest !== stamp` — two different STRINGS — under a name
  // that promised a lightness ordering. It stayed green the entire time the two
  // reds were deltaE 6 apart on paper and BYTE-IDENTICAL on lamplight, because
  // it never looked at the .dark block at all. A verdict stamp and an error
  // message rendered in the same ink and nothing said so.
  //
  // Now it measures. HSL -> sRGB -> CIE Lab -> deltaE76, in both themes: under
  // 10 is confusable at a glance, over 20 is clearly a different colour.
  const darkBlock = css.slice(css.indexOf('.dark {'))
  const hsl2rgb = (v) => {
    const [h, sp, lp] = (v || '').trim().split(/[\s%]+/).map(parseFloat)
    const S = sp / 100, L2 = lp / 100
    const c = (1 - Math.abs(2 * L2 - 1)) * S, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = L2 - c / 2
    const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
            : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
    return t.map((u) => (u + m) * 255)
  }
  const toLab = (rgb) => {
    const lin = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4) }
    const [r, g, b] = rgb.map(lin)
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
    const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047)
    const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b)
    const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]
  }
  const deltaE = (a, b) => {
    const A = toLab(hsl2rgb(a)), B = toLab(hsl2rgb(b))
    return Math.sqrt((A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2)
  }
  const dDest = (darkBlock.match(/--destructive:\s*([^;]+);/) || [])[1]
  const dStamp = (darkBlock.match(/--ink-stamped:\s*([^;]+);/) || [])[1]
  const dLight = dest && stamp ? deltaE(dest, stamp) : 0
  const dDark = dDest && dStamp ? deltaE(dDest, dStamp) : 0
  ok('the verdict stamp and the error red are different colours, both themes',
    dLight > 20 && dDark > 20,
    `deltaE light ${dLight.toFixed(1)}, dark ${dDark.toFixed(1)} — under 20 a DONE stamp `
    + `and an error message read as the same ink, and red is supposed to mean verdict`)
  const lightness = (v) => parseFloat((v || '').trim().split(/\s+/)[2] || '99')
  ok('the error red is dark enough for small text',
    lightness(dest) <= 40,
    `L=${lightness(dest)}% — #BE3A1D at 43% measures 4.23:1 on paper and fails AA`)
}
// ── 6. no raw palette class anywhere in src ─────────────────────────────────
// The palette IS the notation: three inks that each mean something beat twelve
// colours that mean nothing. A raw Tailwind palette class is a colour with no
// meaning attached — it cannot follow the theme, it says nothing about who
// wrote the value, and it is how twelve hues got here in the first place.
//
// Components reference the semantic tokens instead: --status-good (ballpoint,
// because paper marks a thing rather than colouring it), --status-danger (stamp
// ink), --status-warn (bold ink), --status-scale (ink weight).
//
// This currently finds ZERO — the sweep that removed them happened days ago.
// That is exactly what makes it worth having: a check that passes on the day
// you write it is a tripwire, and the next raw palette class to enter the
// codebase fails the build instead of quietly becoming the thirteenth colour.
//
// The allowlist exists so a justified exception is a deliberate, reviewable
// edit rather than a silent one. It starts empty and should stay that way.
{
  const FAMILIES = 'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue'
                 + '|indigo|violet|purple|fuchsia|pink|rose'
                 + '|slate|gray|zinc|neutral|stone'
  const PROPS = 'bg|text|border|from|via|to|ring|shadow|fill|stroke|decoration|outline|divide|accent|caret|placeholder'
  // numbered hues (bg-red-500) AND the unnumbered ones (to-white/20), which
  // the first cut missed while one was live in ActiveSessionHeader
  const RAW = new RegExp(
    `\\b(?:${PROPS})-(?:(?:${FAMILIES})-[0-9]{2,3}|white|black)(?:\\/[0-9]{1,3})?\\b`, 'g')

  let allow = []
  try {
    allow = JSON.parse(readFileSync(join(SRC, '..', 'scripts', 'checks', 'palette-allowlist.json'), 'utf8'))
  } catch { allow = [] }

  const hits = []
  const w = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { w(p); continue }
      if (!/\.(tsx|ts|css)$/.test(e)) continue
      if (/globals\.css$/.test(p)) continue          // the token layer may name hues
      const rel = p.split(/[\\/]/).slice(-2).join('/')
      readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
        const t = l.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
        for (const m of l.split('//')[0].match(RAW) || []) {
          const key = `${rel}:${m}`
          if (allow.includes(key) || allow.includes(m)) continue
          hits.push(`${rel}:${i + 1} ${m}`)
        }
      })
    }
  }
  w(SRC)
  ok('no raw palette class in src — the palette is the notation',
    hits.length === 0,
    hits.slice(0, 6).join('  |  ')
      + (hits.length > 6 ? `  (+${hits.length - 6} more)` : '')
      + ' — use --status-good / --status-danger / --status-warn / --status-scale')
}

// ── 7. no orphaned component ────────────────────────────────────────────────
// PaperCard was the component this whole design is named after — "the card
// chrome" in the ticket — and it was never rendered anywhere, for the entire
// life of the branch. It got built, reviewed, restyled, contrast-checked and
// carried through eight merges without once appearing on a screen.
//
// Nothing catches that. It compiles, it type-checks, it passes every visual
// rule in this file, because a component nobody renders trivially satisfies
// every constraint about how it should look.
//
// A file in src/components whose exports are referenced nowhere else is dead.
// The allowlist below is for the two that predate this check; anything NEW
// fails the build, which is the point.
{
  const EXPORTS = /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g
  const files = []
  const w = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { w(p); continue }
      if (/\.tsx$/.test(e)) files.push(p)
    }
  }
  w(join(SRC, 'components'))

  // every other source file, read once
  const others = []
  const wAll = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { wAll(p); continue }
      if (/\.(tsx|ts)$/.test(e)) others.push([p, readFileSync(p, 'utf8')])
    }
  }
  wAll(SRC)

  let allow = []
  try {
    allow = JSON.parse(readFileSync(join(SRC, '..', 'scripts', 'checks', 'orphan-allowlist.json'), 'utf8'))
  } catch { allow = [] }

  const orphans = []
  for (const p of files) {
    const rel = p.slice(p.indexOf('components')).replace(/\\/g, '/')
    if (allow.includes(rel)) continue
    const src = readFileSync(p, 'utf8')
    const names = [...src.matchAll(EXPORTS)].map((m) => m[1])
    if (!names.length) continue
    // Used = the name appears somewhere OTHER than an import statement.
    //
    // "rendered or called" was the first attempt and it was too narrow: it
    // immediately produced three false positives, because ui/motion exports
    // variant OBJECTS consumed as variants={fadeUp} — neither a JSX tag nor a
    // call. Stripping import lines instead catches the real case (imported and
    // never used) without assuming every export is an element.
    // Strip comments and import statements, then ask whether the name still
    // appears. Both halves are load-bearing:
    //   - an IMPORT alone is not use (SectionLabel sat imported-and-unrendered)
    //   - a COMMENT alone is not use (PremiumGate is discussed in entitlements.ts)
    //
    // Done line-by-line rather than with a regex. The regex version used
    // /import[\s\S]*?from/ which crosses newlines, so it swallowed real code
    // between one import and a later `from` and reported a rendered component
    // as an orphan. Non-greedy is not the same as line-bounded.
    const bare = (t) => {
      const out = []
      let inImport = false
      let inBlock = false
      for (let line of t.split('\n')) {
        if (inBlock) { if (line.includes('*/')) { inBlock = false; line = line.slice(line.indexOf('*/') + 2) } else continue }
        if (line.includes('/*')) { inBlock = !line.includes('*/'); line = line.slice(0, line.indexOf('/*')) }
        const t2 = line.trim()
        if (inImport) { if (/from\s*['\"]/.test(t2) || t2.endsWith(';')) inImport = false; continue }
        if (t2.startsWith('import')) { if (!/from\s*['\"]/.test(t2) && !t2.endsWith(';')) inImport = true; continue }
        if (t2.startsWith('//')) continue
        out.push(line.split('//')[0])
      }
      return out.join('\n')
    }
    const used = others.some(([q, s]) =>
      q !== p && names.some((n) => new RegExp(`\\b${n}\\b`).test(bare(s))))
    if (!used) orphans.push(`${rel} (${names.slice(0, 3).join(', ')})`)
  }

  ok('no orphaned component — everything in components/ is rendered somewhere',
    orphans.length === 0,
    orphans.join('  |  ') + ' — never imported anywhere; render it or delete it')
}

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
