#!/usr/bin/env node
// ── Morning routine eval (FOR-326) ───────────────────────────────────────────
// Ten realistic mornings through the production prompt, schema and model, each
// scored pass/fail by scorers.mjs. Rerun after ANY change to the model or the
// prompt (src/lib/ai/morningProtocolPrompt.ts) and commit the results file.
//
//   EVAL_ANTHROPIC_API_KEY=... npx tsx scripts/evals/morning-protocol/run.mjs
//   (ANTHROPIC_API_KEY also works; the EVAL_ name keeps a cloud environment's
//   own Claude session from picking the key up)
//   EVAL_ANTHROPIC_WORKSPACE_ID=wrkspc_...  only for a key not scoped to a workspace
//   MODEL=claude-sonnet-5-5 ...   to score a candidate model on the same cases
//
// Calls the model once per case, touches no database and no
// production code. Writes results/<date>-<model>.json: every input, output and
// score, so a reader can check a verdict against the text it was given.
// Exits 1 unless every case passes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { MORNING_CALL, MORNING_MODEL, MORNING_SYSTEM, MorningProtocolSchema, morningPrompt } from '../../../src/lib/ai/morningProtocolPrompt.ts'
import { score } from './scorers.mjs'

const apiKey = process.env.EVAL_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.error('EVAL_ANTHROPIC_API_KEY (or ANTHROPIC_API_KEY) is not set. This eval calls the model; there is nothing to score without it.')
  process.exit(2)
}
// The public API, named outright: a session's ANTHROPIC_BASE_URL may point elsewhere.
// A key made at the organization level (not inside a workspace) is refused
// unless the request names a workspace: set EVAL_ANTHROPIC_WORKSPACE_ID for that.
const workspaceId = process.env.EVAL_ANTHROPIC_WORKSPACE_ID
const anthropic = createAnthropic({
  apiKey,
  baseURL: 'https://api.anthropic.com/v1',
  ...(workspaceId ? { headers: { 'anthropic-workspace-id': workspaceId } } : {}),
})

const model = process.env.MODEL || MORNING_MODEL
const { cases } = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'))

const rows = []
for (const c of cases) {
  const t0 = Date.now()
  try {
    const { object, usage } = await generateObject({
      model: anthropic(model),
      abortSignal: AbortSignal.timeout(25_000), // the route's own limit
      ...MORNING_CALL,
      system: MORNING_SYSTEM,
      prompt: morningPrompt(c.input),
      schema: MorningProtocolSchema,
    })
    const s = score(c.input, object)
    rows.push({ id: c.id, tier: c.tier, input: c.input, ms: Date.now() - t0, usage, output: object, ...s })
  } catch (e) {
    // A call that fails or returns something the schema refuses is what a user
    // sees as an error: it fails the case.
    rows.push({ id: c.id, tier: c.tier, input: c.input, ms: Date.now() - t0, pass: false, error: String(e?.message || e).slice(0, 500) })
  }
  const r = rows.at(-1)
  const failed = r.error ? `error: ${r.error.slice(0, 120)}` : Object.entries(r.checks).filter(([, v]) => !v.pass).map(([k, v]) => `${k} (${v.why})`).join(', ')
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${c.id.padEnd(34)} ${r.ms} ms${failed ? '  ' + failed : ''}`)
}

const passed = rows.filter((r) => r.pass).length
const date = new Date().toISOString().slice(0, 10)
const out = new URL(`./results/${date}-${model}.json`, import.meta.url)
mkdirSync(new URL('./results/', import.meta.url), { recursive: true })
writeFileSync(out, JSON.stringify({ model, date, passed, of: rows.length, rows }, null, 2) + '\n')

const tokens = rows.reduce((t, r) => [t[0] + (r.usage?.inputTokens ?? 0), t[1] + (r.usage?.outputTokens ?? 0)], [0, 0])
console.log(`\n${model}: ${passed} of ${rows.length} passed · ${tokens[0]} input / ${tokens[1]} output tokens · ${out.pathname.split('/scripts/')[1]}`)
process.exit(passed === rows.length ? 0 : 1)
