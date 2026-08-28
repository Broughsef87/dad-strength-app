// ═══════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENTS — a file in src/components whose exports are referenced
// nowhere else is dead code, and dead code is where retired palettes go to hide.
//
// Why this exists, three times over:
//   · PaperCard was the component an entire design was named after — "the card
//     chrome" — and was never rendered once, across eight merges.
//   · A sweep found twelve more dead components in one pass.
//   · BarbellMark had five exports, zero importers, and the last 25
//     rgba(234,11,47) literals of the retired cockpit red. Three separate
//     palette sweeps reported the codebase clean while it sat in the tree.
//
// Nothing else catches this. Dead components compile, type-check, and satisfy
// every visual rule trivially, because a component nobody renders cannot
// violate a constraint about how it looks.
//
// This check previously lived inside a design-specific suite, so reverting that
// design deleted it. It is standalone now: it is about hygiene, not palette,
// and it must outlive whatever the app currently looks like.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('../../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const ALLOWLIST = join(SRC, '..', 'scripts', 'checks', 'orphan-allowlist.json')

const EXPORTS = /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g

const walk = (dir, test, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, test, out)
    else if (test(e)) out.push(p)
  }
  return out
}

// Used = the name appears somewhere OTHER than an import statement or a comment.
// Both exclusions are load-bearing, and each was learned by getting it wrong:
//
//   · An IMPORT alone is not use. The dashboard imported SectionLabel and
//     HeroAccent and rendered neither.
//   · A COMMENT alone is not use. The only `<HeroAccent` in the whole codebase
//     is a note in layout.tsx, and PremiumGate is discussed in prose in
//     entitlements.ts — either one was enough to mark a dead file "used".
//
// "Rendered or called" was the first attempt and was too narrow: three false
// positives immediately, because ui/motion exports variant OBJECTS consumed as
// variants={fadeUp}, which is neither a JSX tag nor a call.
//
// Line-bounded on purpose. The regex version used /import[\s\S]*?from/, which
// crosses newlines, swallowed real code between one import and a later `from`,
// and reported a rendered component as dead. Non-greedy is not line-bounded.
const bare = (text) => {
  const out = []
  let inImport = false
  let inBlock = false
  for (let line of text.split('\n')) {
    if (inBlock) {
      if (!line.includes('*/')) continue
      inBlock = false
      line = line.slice(line.indexOf('*/') + 2)
    }
    if (line.includes('/*')) {
      inBlock = !line.includes('*/')
      line = line.slice(0, line.indexOf('/*'))
    }
    const t = line.trim()
    if (inImport) {
      if (/from\s*['"]/.test(t) || t.endsWith(';')) inImport = false
      continue
    }
    if (t.startsWith('import')) {
      if (!/from\s*['"]/.test(t) && !t.endsWith(';')) inImport = true
      continue
    }
    if (t.startsWith('//')) continue
    out.push(line.split('//')[0])
  }
  return out.join('\n')
}

let allow = []
try {
  allow = JSON.parse(readFileSync(ALLOWLIST, 'utf8'))
} catch {
  allow = []
}

const components = walk(join(SRC, 'components'), (e) => /\.tsx$/.test(e))
const others = walk(SRC, (e) => /\.(tsx|ts)$/.test(e)).map((p) => [p, bare(readFileSync(p, 'utf8'))])

const orphans = []
let inspected = 0
for (const p of components) {
  const rel = p.slice(p.indexOf('components')).replace(/\\/g, '/')
  if (allow.includes(rel)) continue
  const names = [...readFileSync(p, 'utf8').matchAll(EXPORTS)].map((m) => m[1])
  if (!names.length) continue
  inspected++
  const used = others.some(([q, s]) => q !== p && names.some((n) => new RegExp(`\\b${n}\\b`).test(s)))
  if (!used) orphans.push(`${rel}  (${names.slice(0, 4).join(', ')}${names.length > 4 ? ', …' : ''})`)
}

console.log('')
console.log('  ── orphaned components ' + '─'.repeat(38))
console.log(`    components inspected      ${inspected}`)
console.log(`    allowlisted               ${allow.length}`)
console.log(`    orphaned                  ${orphans.length}`)
console.log('')

if (orphans.length) {
  console.log(`  ✗ ${orphans.length} component file(s) are never referenced anywhere:`)
  for (const o of orphans) console.log('    - ' + o)
  console.log('')
  console.log('    Render it, or delete it. If it is deliberately kept, add the path')
  console.log('    to scripts/checks/orphan-allowlist.json with a reason in the PR.')
  process.exit(1)
}
console.log('  ✓ every component in src/components is referenced somewhere')
