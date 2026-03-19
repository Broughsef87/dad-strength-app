import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

export async function POST(req: Request) {
  try {
    const { energy, focus, mood, bodyStatus } = await req.json()
    
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
      console.error('Missing Google/Gemini API key in environment');
      return Response.json({ error: 'AI configuration missing' }, { status: 500 });
    }

    const { object: protocol } = await generateObject({
      model: google('gemini-1.5-flash'),
      system: `You are a high-performance coach for busy dads. Based on the user status, generate a morning protocol. Tone: Stoic, encouraging, direct. No fluff.`,
      prompt: `Status:
      - Energy: ${energy}
      - Focus: ${focus}
      - Mood: ${mood}
      - Body Status: ${bodyStatus}`,
      schema: z.object({
        title: z.string().describe("A short, motivating title for today's protocol"),
        primaryObjective: z.string().describe("The single most important goal for the morning"),
        mindsetShift: z.string().describe("A one-sentence mental frame to adopt"),
        actions: z.array(z.object({
          task: z.string(),
          duration: z.string(),
          benefit: z.string()
        })),
        warning: z.string().describe("One thing to avoid today")
      })
    })

    return Response.json({ protocol })
  } catch (error) {
    console.error('AI Morning Protocol Error:', error);
    return Response.json({ error: 'Failed to generate protocol' }, { status: 500 })
  }
}
