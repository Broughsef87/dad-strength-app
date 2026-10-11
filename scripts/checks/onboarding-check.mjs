// Onboarding reachability — the first-week checklist and the Morning Protocol.
//
// This flow produced FIVE review findings across five Codex passes during the
// FOR-183 restructure, every one invisible to tsc and to 4,000+ program
// assertions:
//
//   1. the checklist CTA pointed at a surface that renders the checklist, so
//      "Open Protocol" looped back to itself and onboarding deadlocked
//   2. the ?protocol=1 escape hatch was read only at mount, and the CTA is a
//      query-only navigation, so the flag never fired
//   3. revealing the protocol UNMOUNTED the checklist, and the effect that
//      ticks morning_protocol off lives inside it
//   4. keeping it mounted was still not enough: that effect reads localStorage,
//      and a sibling writing localStorage fires no same-tab event
//   5. anyone who DISMISSED an unfinished checklist lost the protocol outright,
//      because /spirit had been the other way in
//
// One root cause under all five: a daily surface gated on onboarding state.
// The gate is gone, and section 2 exists to stop it coming back.
//
// These are source assertions rather than behaviour tests — the honest way to
// pin a render branch without a DOM.
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const dash = read('../../src/app/dashboard/page.tsx')
const list = read('../../src/components/FirstWeekChecklist.tsx')
const manifest = JSON.parse(read('../../public/manifest.json'))

let checks = 0
const fails = []
const ok = (label, cond, detail) => {
  checks++
  if (!cond) fails.push(label + (detail ? ' -> ' + detail : ''))
}

// -- 1. the protocol is reachable while the checklist is still running -------
ok('dashboard renders MorningProtocol', /<MorningProtocol[\s\S]*?\/>/.test(dash))
ok('dashboard wires onOpenProtocol to the checklist',
  /onOpenProtocol=\{/.test(dash))
ok('the checklist CTA calls onOpenProtocol rather than navigating',
  /item\.key === 'morning_protocol' && onOpenProtocol/.test(list))

// -- 2. the protocol must NOT be gated on onboarding state ------------------
// Five review findings came from one conditional. The protocol is a DAILY
// surface; hiding it behind checklist state produced a deadlock, a dead escape
// hatch, an unmounted watcher, and a permanent loss for anyone who dismissed an
// unfinished checklist. It renders unconditionally now, and must stay that way.
const mount = dash.match(/<MorningProtocol[\s\S]*?\/>/)
ok('dashboard renders MorningProtocol unconditionally', mount != null)
if (mount) {
  const before = dash.slice(0, dash.indexOf(mount[0]))
  const openBraces = (before.match(/\{checklistDone|\{forceProtocol|checklistDone \?|forceProtocol \?/g) ?? [])
  ok('MorningProtocol is not behind a checklistDone/forceProtocol conditional',
    openBraces.length === 0,
    'found ' + JSON.stringify(openBraces) + ' before the mount; gating this on ' +
    'onboarding state is the defect class that produced five review findings')
}

// -- 2b. completing a pillar must reach the checklist in the same session ---
// The checklist ticks morning_protocol by READING THE ROW (FOR-231 v2). A
// sibling writing the row fires no same-tab event, so without an explicit
// signal the item stays unchecked no matter how long the component stays
// mounted. The write path must signal. patchSpirit persists the protocol,
// pillar completion and gratitude, and it is the only write path this
// component has: the Goals step hands objectives to the card (FOR-231,
// 2026-10-11). It signals only once its write has LANDED in the row.
const mp = read('../../src/components/MorningProtocol.tsx')
ok('MorningProtocol reports completion upward', /onSaved/.test(mp),
  'no callback — the checklist cannot learn the protocol was run')
// Bounded by each function's own body, not by a character count. The window
// used to be 1400 characters from the declaration, which is a number with
// nothing behind it: a save path that signals correctly fails the moment a
// comment pushes the call past it, and the temptation is then to raise the
// number instead of reading the code. The closing brace is the real boundary.
const bodyOf = (src, decl) => {
  const i = src.indexOf(decl)
  if (i < 0) return ''
  const j = src.indexOf('\n  }', i)
  return j < 0 ? src.slice(i) : src.slice(i, j + 4)
}
const saveFns = ['  const patchSpirit = async (']
  .map((d) => bodyOf(mp, d))
ok('every MorningProtocol save path signals the parent',
  saveFns.length === 1 && saveFns.every((f) => f.length > 0 && /onSaved\?\.\(\)/.test(f)),
  'found ' + saveFns.filter((f) => f.length > 0).length + ' save paths, ' +
  saveFns.filter((f) => /onSaved\?\.\(\)/.test(f.slice(0, 1400))).length + ' signalling')

// Date keys across the two components must agree, or the checklist can never
// mark the item: MorningProtocol writes localDayWithCutoff(4) (YYYY-MM-DD) and
// this compared toLocaleDateString() (8/26/2026). Never equal, so the item
// could not auto-complete at all.
// Comments in that file quote the old call while explaining the bug, so this
// looks at code lines only — a guard that trips on its own documentation is
// worse than no guard.
const listCode = list.split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n')
ok('the checklist reads the same date key the protocol writes',
  /localDayWithCutoff\(4\)/.test(listCode) && !/toLocaleDateString\(\)/.test(listCode),
  'date formats diverge — YYYY-MM-DD vs a locale string')
ok('dashboard wires that report to a tick', /onSaved=\{/.test(dash))
ok('the checklist watcher depends on the tick',
  /\}, \[userId, state\.morning_protocol, protocolTick\]\)/.test(list),
  'watcher deps exclude protocolTick, so it never re-runs mid-session')

// The objectives card used to take the same signal, because the protocol's
// Goals step wrote objectives beside it. It is the ONLY writer of objectives
// now (FOR-231, 2026-10-11), so nothing changes what it shows behind its back
// and it takes no signal. What must hold instead is that the Goals step sends
// the athlete to it rather than saving anything itself.
ok('the objectives card takes no refresh key',
  !/refreshKey=/.test(dash) && /<DailyObjectivesCard \/>/.test(dash),
  'the card is fed a signal again — is there a second writer of objectives?')
ok('the protocol Goals step hands off to the card',
  /href="#daily-objectives"/.test(mp) && /id="daily-objectives"/.test(read('../../src/components/DailyObjectivesCard.tsx')),
  'the Goals step has no way to reach the only place objectives are set')

// -- 2d. objectives must be settable without AI -----------------------------
// The protocol's Goals step sits behind `if (!configured)`, which is only true
// once /api/ai/morning-protocol has succeeded. Pointing the objectives empty
// state at it dead-ended anyone with no protocol yet, out of free AI quota, or
// already past that step — on a feature that needs no AI at all.
const objCard = read('../../src/components/DailyObjectivesCard.tsx')
ok('the objectives card can set objectives itself',
  /saveDraft/.test(objCard) && /mind_state/.test(objCard),
  'no inline editor — the empty state depends on an AI-gated surface')
ok('the objectives empty state does not navigate away',
  !/<a href="\/(mind|dashboard)/.test(objCard),
  'still links out instead of editing in place')
// One editor, one shape. The protocol must not write any of it.
for (const field of ['objectives', 'completedObjectives', 'lockedIn']) {
  ok(`the one objective writer persists ${field}, and the protocol does not`,
    new RegExp(`path: \\['${field}'\\]`).test(objCard) && !new RegExp(`path: \\['${field}'\\]`).test(mp),
    'the card does not write it, or the protocol Goals step writes it again')
}

// Objectives render filtered and toggle by the FILTERED index, which writes
// completedObjectives at that index. A sparse array therefore lands a
// completion flag on the wrong objective: stored ['', 'A', 'B'] with
// [false,true,false] renders B as done when A is. Both writers store dense,
// and reads normalise legacy rows by pairing each objective with its own flag
// BEFORE compacting — compacting the strings alone is the bug, not the fix.
for (const [label, src] of [['card', objCard]]) {
  ok(`the ${label} stores objectives dense`,
    /\.map\(o => o\.trim\(\)\)\.filter\(Boolean\)/.test(src),
    'saves a sparse array; completion flags will misalign')
}
ok('the card realigns legacy sparse rows on read',
  /normalise/.test(objCard) && /\[String\(o \?\? ''\), Boolean\(\(done \?\? \[\]\)\[i\]\)\]/.test(objCard),
  'old rows keep their misalignment forever')

// -- 2c. the scroll must survive the loading branch -------------------------
// The dashboard early-returns while loading, so on a direct arrival the
// protocol div does not exist when the flag is first read. Keyed on
// forceProtocol alone the effect fires once against a null ref and never again.
const scroll = dash.match(/useEffect\(\(\) => \{[^]*?scrollIntoView[^]*?\}, \[([^\]]*)\]\)/)
ok('the protocol scroll effect exists', scroll != null)
if (scroll) {
  ok('the scroll effect re-runs once loading clears',
    /loading/.test(scroll[1]),
    'deps are [' + scroll[1] + ']; without `loading` the PWA shortcut and the ' +
    '/mind and /spirit redirects land at the top of the page')
}

// -- 3. every deleted tab still has a way in --------------------------------
for (const route of ['body', 'mind', 'spirit']) {
  let src = null
  try { src = read(`../../src/app/${route}/page.tsx`) } catch {}
  ok(`/${route} still resolves (redirect shim)`, src != null && /redirect\(/.test(src),
    'deleted without a shim — bookmarks, history and installed PWAs 404')
}

// -- 4. the PWA shortcut opens the protocol, not just the dashboard ---------
const shortcuts = manifest.shortcuts ?? []
const morning = shortcuts.find((s) => /morning/i.test(s.name ?? ''))
ok('manifest has a Morning Protocol shortcut', morning != null)
if (morning) {
  ok('the Morning shortcut opens protocol mode',
    /protocol=1/.test(morning.url),
    `points at ${morning.url}; a first-week user would get the checklist instead`)
}
const training = shortcuts.find((s) => /training/i.test(s.name ?? ''))
if (training) {
  ok('the Training shortcut targets a live route, not a shim',
    training.url.startsWith('/train'), `points at ${training.url}`)
}

console.log('\n' + '='.repeat(58))
if (fails.length) {
  console.log(`FAIL ${fails.length} of ${checks}:`)
  for (const f of fails) console.log('  - ' + f)
  process.exit(1)
}
console.log(`ALL GREEN — ${checks} onboarding-reachability checks`)
