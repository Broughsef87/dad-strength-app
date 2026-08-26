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
// The checklist ticks morning_protocol by READING localStorage. A sibling
// writing localStorage fires no same-tab event, so without an explicit signal
// the item stays unchecked no matter how long the component stays mounted.
// Both write paths must signal. saveCache persists pillar completion;
// saveMindState persists objectives. They are separate functions, and wiring
// only the first left objectives saves invisible to the card below them.
const mp = read('../../src/components/MorningProtocol.tsx')
ok('MorningProtocol reports completion upward', /onSaved/.test(mp),
  'no callback — the checklist cannot learn the protocol was run')
const saveFns = mp.split(/const saveCache|const saveMindState/).slice(1)
ok('every MorningProtocol save path signals the parent',
  saveFns.length === 2 && saveFns.every((f) => /onSaved\?\.\(\)/.test(f.slice(0, 1400))),
  'found ' + saveFns.length + ' save paths, ' +
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

// Same signal, same reason: the objectives card loads on mount and the
// protocol writes objectives beside it. Without the key it shows "no
// objectives set" next to the ones just entered.
ok('the objectives card takes a refresh key',
  /refreshKey/.test(read('../../src/components/DailyObjectivesCard.tsx')),
  'mount-only loader with no signal — a same-page save is invisible to it')
ok('dashboard feeds the tick to the objectives card',
  /<DailyObjectivesCard[\s\S]*?refreshKey=\{protocolTick\}/.test(dash))

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
