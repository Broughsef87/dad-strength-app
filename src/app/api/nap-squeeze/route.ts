import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 10
const RATE_WINDOW = 60 * 1000

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW)
  if (timestamps.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 })
  }
  rateLimitMap.set(ip, [...timestamps, now])

  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const systemPrompt = `You are the 'Nap Squeeze' AI, a specialized productivity assistant for a high-performing dad and entrepreneur. Your goal is to squeeze the most valuable essence, key takeaways, and immediate action items from the provided text. Keep it extremely concise, high-impact, and actionable. No fluff. Focus on the juice that drives growth and production.`

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt,
    })

    return NextResponse.json({ content: text, cached: false })
  } catch (error) {
    console.error('Nap Squeeze Error:', error)
    return NextResponse.json({ error: 'Failed to squeeze. Try again.' }, { status: 500 })
  }
}
