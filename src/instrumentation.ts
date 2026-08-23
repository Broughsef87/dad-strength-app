// Next.js server-side instrumentation hook — dispatches the right Sentry
// config per runtime. Stable since Next 14.0.4; this app is on 16.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Captures all unhandled server-side request errors (App Router,
// server actions, route handlers). Requires @sentry/nextjs >= 8.28.
export const onRequestError = Sentry.captureRequestError
