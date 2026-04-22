import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createClient } from '../../../../utils/supabase/server'

// Diagnostic endpoint — hit this to see if Gemini is reachable with the
// current deployment's env vars. Returns a structured error if not so we
// can tell at a glance: wrong key, no model access, rate-limited, etc.
//
// Auth: requires a logged-in user so it's not an open oracle.
//
// DELETE this file once the auth issue is diagnosed.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const envPresence = {
    GOOGLE_GENERATIVE_AI_API_KEY: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    GOOGLE_GENERATIVE_AI_API_KEY_length: process.env.GOOGLE_GENERATIVE_AI_API_KEY?.length ?? 0,
    GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
  }

  const models = [
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ] as const

  const results: Array<{ model: string; ok: boolean; detail: unknown }> = []

  for (const m of models) {
    try {
      const { text } = await generateText({
        model: google(m),
        prompt: 'Reply with the single word: pong',
      })
      results.push({ model: m, ok: true, detail: text.slice(0, 40) })
    } catch (err) {
      const e = err as {
        name?: string
        message?: string
        statusCode?: number
        responseBody?: string
        url?: string
        cause?: unknown
      }
      results.push({
        model: m,
        ok: false,
        detail: {
          name: e?.name,
          message: e?.message,
          statusCode: e?.statusCode,
          responseBody: e?.responseBody?.slice(0, 400),
          url: e?.url,
          cause: e?.cause ? String(e.cause).slice(0, 200) : undefined,
        },
      })
    }
  }

  return NextResponse.json({ envPresence, results })
}
