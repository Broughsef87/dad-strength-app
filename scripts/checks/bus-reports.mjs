// ── Every bus report carries its frontmatter (FOR-260) ──────────────────────
// Agent Bus — Cross-Repo Spec §4.1: a report's first bytes are a block of seven
// flat `key: value` pairs. Before this check, 0 of 12 reports in this repo had
// one, so nothing downstream could count a gate, a round or a blocked minute
// without a human reading twelve files.
//
// WHY THIS IS A COPY, and how the copy is kept honest. The rules live in
// Rivet's `workspace/automation/scripts/bus-frontmatter.js`, and the reporter in
// `bus-report-validate.js` beside it. That is another repository with no remote
// this one can import from, so FOR-260 §3D says vendor it. A vendored rule is a
// second copy of a fact, which is the defect this codebase keeps producing — so
// the fingerprints of the two upstream files are recorded here, and
// `scripts/checks/bus-v2.mjs` compares them when the originals are reachable.
// Drift then shows up as a failing check rather than as two validators quietly
// disagreeing.
//
//   upstream bus-frontmatter.js      sha256:8957c0ba9fe9c414  6661 bytes (LF)
//   upstream bus-report-validate.js  sha256:5168c2d854915ccd  2234 bytes (LF)
//
// Its own file, so a revert of the frontmatter convention cannot take the check
// with it.
//
//   node scripts/checks/bus-reports.mjs            (run-all does this)
//   node scripts/checks/bus-reports.mjs --verbose
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// ── the contract, ported from bus-frontmatter.js without additions ──────────
const OUTCOMES = Object.freeze([
  'GATE', 'EMERGENT', 'DONE',
  'SPEC_WRONG', 'SPEC_INCOMPLETE', 'SPEC_IMPOSSIBLE', 'SPEC_UNVERIFIABLE',
])
const REQUIRED = Object.freeze(['ticket', 'repo', 'written', 'outcome', 'codex_rounds', 'blocked_minutes'])
const CONDITIONAL = Object.freeze(['gate_hit'])
const ALLOWED = Object.freeze([...REQUIRED, ...CONDITIONAL])
/** Spec §4.1, Lu's ruling 3 (2026-09-18). FIXED — adding a token is a spec change. */
const GATE_HITS = Object.freeze([
  'migration', 'auth-billing-secrets', 'production-deploy', 'destructive-data',
  'published-contract', 'second-reversal', 'self-modification',
  'program-content', 'client-visible', 'pricing', 'marketplace-application',
])

const TICKET_RE = /^FOR-[0-9]+$/
const KEY_RE = /^[a-z_]+$/
const INT_RE = /^(0|[1-9][0-9]*)$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** YYYY-MM-DD naming a real calendar day, so 2026-02-30 is rejected. */
function isRealIsoDate(s) {
  const m = DATE_RE.exec(s)
  if (!m) return false
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/** The block must start at byte 0 and close on its own line. A BOM and CRLF are tolerated. */
function extractBlock(text) {
  const t = String(text || '').replace(/^﻿/, '')
  const lines = t.split(/\r?\n/)
  if (lines[0] !== '---') return null
  const end = lines.indexOf('---', 1)
  if (end === -1) return { lines: lines.slice(1), unterminated: true }
  return { lines: lines.slice(1, end), unterminated: false }
}

/**
 * Deliberately not a YAML parser. The contract is seven flat pairs; a general
 * YAML reader would accept nesting, lists and anchors the spec forbids, making
 * it a looser check than the spec rather than a stricter one.
 */
export function parse(text) {
  const errors = []
  const fields = {}
  const block = extractBlock(text)
  if (!block) return { ok: false, hasBlock: false, fields, errors: ['no frontmatter block at start of file'] }
  if (block.unterminated) errors.push('frontmatter block opened with --- but never closed')

  for (const raw of block.lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf(':')
    if (eq < 1) { errors.push(`line is not key: value — "${raw}"`); continue }
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    const hash = val.indexOf(' #')
    if (hash !== -1) val = val.slice(0, hash).trim()
    val = val.replace(/^(['"])(.*)\1$/, '$2')

    if (!KEY_RE.test(key)) { errors.push(`bad key "${key}"`); continue }
    if (key in fields) { errors.push(`duplicate key "${key}"`); continue }
    if (!ALLOWED.includes(key)) { errors.push(`unrecognised field "${key}" — the contract has exactly ${ALLOWED.length} fields`); continue }
    fields[key] = val
  }

  for (const k of REQUIRED) {
    if (!(k in fields) || fields[k] === '') errors.push(`missing required field "${k}"`)
  }
  if ('ticket' in fields && !TICKET_RE.test(fields.ticket)) errors.push(`ticket "${fields.ticket}" does not match ^FOR-[0-9]+$`)
  if ('repo' in fields && (/[\\/]/.test(fields.repo) || fields.repo === '')) errors.push(`repo "${fields.repo}" must be a directory name, not a path`)
  if ('outcome' in fields && !OUTCOMES.includes(fields.outcome)) errors.push(`unrecognised outcome tag "${fields.outcome}" — must be one of ${OUTCOMES.join(', ')}`)
  for (const k of ['codex_rounds', 'blocked_minutes']) {
    if (k in fields && !INT_RE.test(fields[k])) errors.push(`${k} "${fields[k]}" must be an integer >= 0 (write 0 if unmeasured, never omit)`)
  }
  if ('written' in fields && !isRealIsoDate(fields.written)) errors.push(`written "${fields.written}" must be a real calendar date in YYYY-MM-DD form`)

  const isGate = fields.outcome === 'GATE'
  if (isGate && (!('gate_hit' in fields) || fields.gate_hit === '')) errors.push('outcome is GATE but gate_hit is missing — name the gate')
  if (!isGate && 'gate_hit' in fields) errors.push(`gate_hit is present but outcome is "${fields.outcome}" — gate_hit is only valid on GATE`)
  if (isGate && 'gate_hit' in fields && fields.gate_hit !== '' && !GATE_HITS.includes(fields.gate_hit)) {
    errors.push(`gate_hit "${fields.gate_hit}" is not in the fixed vocabulary (${GATE_HITS.join(', ')}). `
      + 'Adding a token is a spec change (Spec §4.1), not a config change — change the spec first.')
  }

  return { ok: errors.length === 0, hasBlock: true, fields, errors }
}

// ── the run ─────────────────────────────────────────────────────────────────
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const verbose = process.argv.includes('--verbose')
// `--dir` so a caller can validate a throwaway directory instead of the live
// bus. bus-v2.mjs needs it: probing malformed reports by writing them into
// .claude/bus/reports/ under fixed names raced a concurrent run and could
// overwrite a real report that happened to share the name (Codex r1). Upstream
// bus-report-validate.js takes the same flag.
const dirIdx = process.argv.indexOf('--dir')
const DIR = dirIdx !== -1 && process.argv[dirIdx + 1]
  ? process.argv[dirIdx + 1]
  : join(ROOT, '.claude', 'bus', 'reports')

// The bus is git-ignored, so a fresh clone has no reports to check. That is not
// a failure: there is nothing to be wrong about.
if (!existsSync(DIR)) {
  console.log('bus reports: no .claude/bus/reports on disk — nothing to check')
  process.exit(0)
}

const files = readdirSync(DIR).filter((n) => n.toLowerCase().endsWith('.md')).sort()
let bad = 0
const lines = []
for (const name of files) {
  const r = parse(readFileSync(join(DIR, name), 'utf8'))
  if (r.ok) { if (verbose) lines.push(`  OK      ${name}  ${r.fields.ticket} ${r.fields.outcome}`); continue }
  bad++
  for (const err of r.errors) lines.push(`  REJECT  ${name}: ${err}`)
}

if (bad > 0) {
  console.log(`\nbus reports: ${bad} of ${files.length} rejected`)
  for (const l of lines) console.log(l)
  process.exit(1)
}
if (verbose) for (const l of lines) console.log(l)
console.log(`bus reports: ${files.length} reports, every one carries its §4.1 frontmatter`)
