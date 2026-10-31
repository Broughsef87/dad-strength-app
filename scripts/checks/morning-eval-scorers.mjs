// ── morning eval scorers (FOR-326) ───────────────────────────────────────────
// The morning routine eval (scripts/evals/morning-protocol) calls the model and
// can only run with a key. Its scorers are pure, so this proves them on every
// `npm run checks`: a good protocol passes every check, and each broken one
// fails the check named for it and no other. Also: the route sends the shared
// prompt module, so the eval scores what users get.
//
// Its own file, so a revert of the eval or of the route cannot take it along.
import { readFileSync } from 'node:fs'
import { score, sentences, names } from '../evals/morning-protocol/scorers.mjs'

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

const ROUGH_INPUT = { dayOfWeek: 'Tuesday', minutes: 20, sleepQuality: 'Rough night', energy: 'Running on fumes', objectives: ['Finish the quarterly report', 'Bench day'] }
const good = () => ({
  theme: 'Hold the Line',
  greeting: 'A rough night, and you are up anyway. Running on fumes is still running.',
  steps: [
    { pillar: 'Prayer', minutes: 6, title: 'Ask for steadiness', guidance: 'Kneel or sit. Ask for patience with the baby and with yourself.', prompt: 'Give me a steady hand today.' },
    { pillar: 'Meditation', minutes: 6, title: 'Slow breath', guidance: 'Breathe in for four, out for six. Let the tiredness be there without arguing with it.', prompt: 'Tired is a feeling, not an order.' },
    { pillar: 'Reading', minutes: 4, title: 'One short passage', guidance: 'Read one page of something light. No study today.', prompt: 'One idea is enough.' },
    { pillar: 'Goals', minutes: 4, title: 'One thing', guidance: 'Today the one objective is finishing the quarterly report. The rest can wait.', prompt: 'What does done look like by noon?' },
  ],
  closingWord: 'Do the one thing well and go home.',
})

const failing = (input, output) => {
  const r = score(input, output)
  return Object.entries(r.checks ?? {}).filter(([, v]) => !v.pass).map(([k]) => k).sort().join(',')
}
const only = (name, input, mutate, msg) => {
  const o = good(); mutate(o)
  const got = failing(input, o)
  assert(got === name, `${msg}: expected only "${name}" to fail, got "${got}"`)
}

// ── 1. a good protocol passes every check ──────────────────────────────────
{
  const r = score(ROUGH_INPUT, good())
  assert(r.pass && Object.keys(r.checks).length === 6, `the good protocol passes all 6 checks (got ${JSON.stringify(r.checks)})`)
}

// ── 2. each failure fails its own check ────────────────────────────────────
{
  const r = score(ROUGH_INPUT, { ...good(), steps: good().steps.slice(0, 3) })
  assert(!r.pass && r.checks.schema?.pass === false, 'three steps fail schema')
}
only('schema', ROUGH_INPUT, (o) => { o.steps[1].pillar = 'Prayer' }, 'two Prayer steps')
only('minutes', ROUGH_INPUT, (o) => { o.steps[0].minutes = 7 }, 'minutes adding to 21 of 20')
only('minutes', ROUGH_INPUT, (o) => { o.steps[0].minutes = 5.5; o.steps[1].minutes = 6.5 }, 'fractional minutes')
only('minutes', ROUGH_INPUT, (o) => { o.steps[0].minutes = 0; o.steps[1].minutes = 12 }, 'an empty step')
only('sleep', ROUGH_INPUT, (o) => { o.greeting = 'Good morning. Let us begin.' }, 'a greeting that ignores the night')
only('sleep', ROUGH_INPUT, (o) => { o.steps[3].guidance = 'Finish the quarterly report, then hit bench day.' }, 'rough night, Goals names every objective')
only('sleep', ROUGH_INPUT, (o) => { o.steps[3].guidance = 'Pick what matters most and do it.'; o.steps[3].title = 'One thing'; o.steps[3].prompt = 'What matters?' }, 'rough night, Goals names no objective')
// Codex P2s on #80 (head db64b48), each now caught:
{
  const three = { ...ROUGH_INPUT, sleepQuality: 'Up all night', objectives: ['Squat day', 'Send 3 outreach emails', 'Pay the daycare bill'] }
  const o = good(); o.steps[3].guidance = 'Squat today, then send the outreach emails. Focus on those two.'
  assert(failing(three, o) === 'sleep', 'rough night: two objectives named of three fails sleep')
  const dad = { ...ROUGH_INPUT, sleepQuality: 'Up all night', objectives: ['Rest day, walk with the stroller', 'Meal prep for the week', 'Call my dad'] }
  const o2 = good(); o2.steps[3].guidance = 'The one thing today is calling your dad. Everything else can wait.'
  assert(score(dad, o2).pass, '"Call my dad" is recognized when it is the one named')
  const r = score(ROUGH_INPUT, { ...good(), steps: good().steps.map((s) => (s.pillar === 'Goals' ? { ...s, pillar: 'Prayer' } : s)) })
  assert(!r.pass && r.checks.schema?.pass === false && Object.keys(r.checks).length === 1, 'a missing Goals pillar fails schema and stops, without throwing')
}
only('safety', ROUGH_INPUT, (o) => { o.closingWord = 'Skip dinner and keep working.' }, 'skipping dinner')
only('safety', ROUGH_INPUT, (o) => { o.steps[1].guidance = 'Take 5 grams of creatine. Then breathe.' }, 'grams of a supplement')
only('length', ROUGH_INPUT, (o) => { o.steps.forEach((s) => { if (s.pillar !== 'Goals') s.guidance = '' }); o.closingWord = '' }, 'empty guidance and closing word')
only('length', ROUGH_INPUT, (o) => { o.theme = '   ' }, 'a blank theme')
only('length', ROUGH_INPUT, (o) => { o.greeting = 'Rough night. You are up. That counts. Now move.' }, 'a four-sentence greeting')
only('length', ROUGH_INPUT, (o) => { o.steps[2].guidance = 'x'.repeat(451) + '.' }, 'guidance over 450 characters')
only('length', ROUGH_INPUT, (o) => { o.theme = 'A very long theme that keeps going well past the point of punch' }, 'a long theme')
only('length', ROUGH_INPUT, (o) => { o.closingWord = 'Go. Win the day.' }, 'a two-sentence closing word')
only('safety', ROUGH_INPUT, (o) => { o.steps[1].guidance = 'Take 3 mg of melatonin tonight. Breathe slowly.' }, 'a dose and a supplement')
only('safety', ROUGH_INPUT, (o) => { o.closingWord = 'Skip breakfast and push through.' }, 'skipping meals')
only('tone', ROUGH_INPUT, (o) => { o.closingWord = 'Crush it today.' }, 'hype')
only('tone', ROUGH_INPUT, (o) => { o.theme = 'Hold the Line 🔥' }, 'an emoji')
only('tone', ROUGH_INPUT, (o) => { o.steps[0].prompt = 'Stand firm!'; o.closingWord = 'Go!' }, 'two exclamation marks')

// ── 3. what is NOT a failure ───────────────────────────────────────────────
{
  const calm = { ...ROUGH_INPUT, sleepQuality: 'Slept great' }
  const o = good(); o.greeting = 'You slept well. Use it.'; o.steps[3].guidance = 'Finish the quarterly report, then bench day.'
  assert(score(calm, o).pass, 'after a good night, Goals may name every objective')
  const none = { ...ROUGH_INPUT, sleepQuality: null }
  const o2 = good(); o2.greeting = 'Morning. Twenty minutes, use them well.'
  assert(score(none, o2).pass, 'with no sleep given, the greeting need not mention it')
  const one = { ...ROUGH_INPUT, objectives: ['Get the car inspected'] }
  const o3 = good(); o3.steps[3].guidance = 'The one objective is getting the car inspected. Nothing else.'
  assert(score(one, o3).pass, 'rough night with a single objective: naming it is right')
  const o4 = good(); o4.closingWord = 'Go.'; o4.steps[0].prompt = 'Stand firm!'
  assert(score(ROUGH_INPUT, o4).pass, 'one exclamation mark is allowed')
}

// ── 4. the helpers ─────────────────────────────────────────────────────────
assert(sentences('One. Two! Three?') === 3, 'three sentences counted')
assert(sentences('No end mark') === 1, 'text with no end mark is one sentence')
assert(sentences('Wait... then go.') === 2, 'an ellipsis ends one sentence')
assert(names('finish the QUARTERLY report', 'Finish the quarterly report'), 'naming is case-blind')
assert(!names('take a walk', 'Bench day'), 'a word the objective lacks does not name it')
assert(names('calling your dad', 'Call my dad') && !names('a walk in the forest', 'Rest day'), 'naming matches a word start, not any substring')

// ── 5. the route sends the shared module, so the eval scores what users get ──
{
  const route = readFileSync(new URL('../../src/app/api/ai/morning-protocol/route.ts', import.meta.url), 'utf8')
  assert(/from '\.\.\/\.\.\/\.\.\/\.\.\/lib\/ai\/morningProtocolPrompt'/.test(route), 'the route imports the shared prompt module')
  assert(/system: MORNING_SYSTEM/.test(route) && /prompt: morningPrompt\(/.test(route) && /schema: MorningProtocolSchema/.test(route) && /anthropic\(MORNING_MODEL\)/.test(route),
    'the route sends the module\'s model, system, prompt and schema')
  assert(!/system: `/.test(route) && !/prompt: `/.test(route), 'the route has no second, inline copy of the prompt')
}

if (fails.length) {
  console.error(fails.map((f) => '  ✗ ' + f).join('\n'))
  console.error(`${fails.length} of ${checks} failed`)
  process.exit(1)
}
console.log(`${checks} checks, all green`)
