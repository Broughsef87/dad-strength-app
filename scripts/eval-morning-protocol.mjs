// Side-by-side test of the Dad Strength morning routine across models.
// Read-only: calls the model APIs directly, touches no database and no production code.
// Copy into the dad-strength-app repo (e.g. scripts/), npm install, then from the repo root:
//   GOOGLE_GENERATIVE_AI_API_KEY=... ANTHROPIC_API_KEY=... node scripts/eval-morning-protocol.mjs > results.json
// Pick models with MODELS=a,b,c. Claude runs at EFFORT (default low, same as the route).
import { google } from '@ai-sdk/google'
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'

const MODELS = (process.env.MODELS || 'gemini-2.5-flash,gemini-3.8-flash,gemini-4-argon,claude-haiku-5-5').split(',')
// $ per 1M tokens [input, output]; Argon is the intro price until Nov 30 (then 4/20)
const PRICE = { 'gemini-2.5-flash': [0.3, 2.5], 'gemini-3.8-flash': [0.75, 3.75], 'gemini-4-argon': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] }
const EFFORT = process.env.EFFORT || 'low'
const optionsFor = (id) => (id.startsWith('claude') ? { anthropic: { effort: EFFORT } } : undefined)
const modelFor = (id) => (id.startsWith('claude') ? anthropic(id) : google(id))

// Same system prompt, prompt and schema as src/app/api/ai/morning-protocol/route.ts
const system = `You are a high-performance coach for busy dads with young babies. Generate a morning protocol built around 4 pillars: Prayer, Meditation, Reading, and Goals. Tone: Stoic, direct, no fluff. Time must add up to exactly the requested minutes distributed across the pillars.`
const schema = z.object({
  theme: z.string().describe("A short, punchy theme for today's morning — e.g. 'The Quiet Before the War'"),
  greeting: z.string().describe("1-2 sentence personal greeting acknowledging last night's sleep and energy level. Direct, warm, stoic."),
  steps: z.array(z.object({
    pillar: z.enum(['Prayer', 'Meditation', 'Reading', 'Goals']),
    minutes: z.number().describe('Minutes allocated to this pillar'),
    title: z.string().describe('Short action title for this pillar'),
    guidance: z.string().describe('2-3 sentence guidance for this block'),
    prompt: z.string().describe('A single focus prompt or intention for this block'),
  })).length(4),
  closingWord: z.string().describe('One final sentence to send them into the day — stoic, motivating'),
})

const CASES = [
  { dayOfWeek: 'Tuesday', minutes: 20, sleepQuality: 'rough, baby up 3 times', energy: 'low', objectives: ['Send 3 outreach emails', 'Squat day'] },
  { dayOfWeek: 'Saturday', minutes: 30, sleepQuality: 'solid 7 hours', energy: 'high', objectives: ['Take the kids to the park', 'Plan next week'] },
  { dayOfWeek: 'Monday', minutes: 10, sleepQuality: 'not given', energy: 'medium', objectives: [] },
  { dayOfWeek: 'Thursday', minutes: 45, sleepQuality: 'ok', energy: 'medium', objectives: ['Client call at 9', 'Finish proposal', 'Date night'] },
  { dayOfWeek: 'Sunday', minutes: 15, sleepQuality: 'terrible', energy: 'low', objectives: ['Mass with family'] },
]

const promptFor = (c) => {
  const list = c.objectives.length ? c.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n') : 'No objectives set'
  return `Today is ${c.dayOfWeek}.
Available time: ${c.minutes} minutes
Last night's sleep: ${c.sleepQuality ?? 'not given'}
Energy level: ${c.energy}
Today's objectives:
${list}

Generate a morning protocol with exactly 4 steps — one for each pillar. Distribute the ${c.minutes} minutes wisely based on energy. Low energy = more Prayer/Meditation. High energy = more Reading/Goals.`
}

const rows = []
for (const model of MODELS) {
  for (const [i, c] of CASES.entries()) {
    const t0 = Date.now()
    try {
      const { object, usage } = await generateObject({ model: modelFor(model), providerOptions: optionsFor(model), system, prompt: promptFor(c), schema })
      const ms = Date.now() - t0
      const total = object.steps.reduce((s, x) => s + x.minutes, 0)
      const [pi, po] = PRICE[model] || [0, 0]
      const cost = ((usage.inputTokens ?? 0) * pi + (usage.outputTokens ?? 0) * po) / 1e6
      rows.push({ model, case: i + 1, ok: true, ms, minutesAddUp: total === c.minutes, usage, costUsd: +cost.toFixed(5), object })
    } catch (e) {
      rows.push({ model, case: i + 1, ok: false, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 300) })
    }
  }
}

// Summary to stderr, full outputs (for reading side by side) to stdout
for (const model of MODELS) {
  const r = rows.filter((x) => x.model === model)
  const ok = r.filter((x) => x.ok)
  const avg = (k) => ok.length ? Math.round(ok.reduce((s, x) => s + x[k], 0) / ok.length) : '-'
  console.error(`${model}: ${ok.length}/${r.length} ok, avg ${avg('ms')} ms, minutes add up ${ok.filter((x) => x.minutesAddUp).length}/${ok.length}, total $${ok.reduce((s, x) => s + x.costUsd, 0).toFixed(4)}`)
}
console.log(JSON.stringify(rows, null, 2))
