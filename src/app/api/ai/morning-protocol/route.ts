import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export async function POST(req: Request) {
  try {
    const { energy, focus, mood, bodyStatus } = await req.json()
    
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
      console.error('Missing Google/Gemini API key in environment');
      return Response.json({ error: 'AI configuration missing' }, { status: 500 });
    }

    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      prompt: `You are a high-performance coach for busy dads. Based on the following user status, generate a morning protocol.
      
      Status:
      - Energy: ${energy}
      - Focus: ${focus}
      - Mood: ${mood}
      - Body Status: ${bodyStatus}
      
      Return a JSON object with this exact structure:
      {
        "title": "A short, motivating title for today's protocol",
        "primaryObjective": "The single most important goal for the morning",
        "mindsetShift": "A one-sentence mental frame to adopt",
        "actions": [
          { "task": "specific action", "duration": "e.g. 5 min", "benefit": "why do this" }
        ],
        "warning": "One thing to avoid today"
      }
      
      Tone: Stoic, encouraging, direct. No fluff. Use valid JSON only.`,
    })

    console.log('Morning Protocol Raw Text:', text);
    const cleaned = text.replace(/```json|```/g, '').trim()
    const protocol = JSON.parse(cleaned)
    return Response.json({ protocol })
  } catch (error) {
    console.error('AI Morning Protocol Error:', error);
    return Response.json({ error: 'Failed to generate protocol' }, { status: 500 })
  }
}