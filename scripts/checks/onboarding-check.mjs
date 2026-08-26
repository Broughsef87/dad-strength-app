// Onboarding reachability — the first-week checklist and the Morning Protocol.
//
// This flow broke three times across four Codex passes during the FOR-183
// restructure, every time in a way tsc and the program suites could not see:
//
//   1. the checklist CTA pointed at a surface that renders the checklist,
//      so "Open Protocol" looped back to itself and onboarding deadlocked
//   2. the ?protocol=1 escape hatch was read only at mount, and the CTA is a
//      query-only navigation, so the flag never fired
//   3. revealing the protocol UNMOUNTED the checklist, and the effect that
//      ticks morning_protocol off lives inside it — so running the protocol
//      never marked the item
//
// All three are structural: who renders what, and when. These are source
// assertions rather than behaviour tests, which is the honest way to pin a
// render branch without a DOM.
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
ok('dashboard renders MorningProtocol', /<MorningProtocol\s*\/>/.test(dash))
ok('dashboard wires onOpenProtocol to the checklist',
  /onOpenProtocol=\{/.test(dash))
ok('the checklist CTA calls onOpenProtocol rather than navigating',
  /item\.key === 'morning_protocol' && onOpenProtocol/.test(list))

// -- 2. revealing the protocol must NOT unmount the checklist ---------------
// The bug shape: `checklistDone || forceProtocol ? <MorningProtocol/> : <FirstWeekChecklist/>`.
// forceProtocol must not appear in the branch that chooses between them.
const branch = dash.match(/\{checklistDone[^]*?<\/motion\.div>/)
ok('dashboard has the checklist/protocol branch', branch != null)
if (branch) {
  const head = branch[0].slice(0, branch[0].indexOf('?') + 1)
  ok('forceProtocol does not gate the checklist away',
    !/forceProtocol/.test(head),
    'forceProtocol is in the ternary head; revealing the protocol would unmount ' +
    'FirstWeekChecklist, and its localStorage effect is the only thing that marks ' +
    'morning_protocol done')
  ok('both render together while the checklist is unfinished',
    /<FirstWeekChecklist[^]*?forceProtocol && <MorningProtocol/.test(branch[0]) ||
    /forceProtocol && <MorningProtocol[^]*?<FirstWeekChecklist/.test(branch[0]))
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
