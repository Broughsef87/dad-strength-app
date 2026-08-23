// Sentry — browser runtime. Loaded automatically by Next.js.
// DSN comes from Vercel env (NEXT_PUBLIC_SENTRY_DSN); with no DSN set the
// SDK initializes disabled, so local dev without env vars stays silent.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 100% of traces in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Session Replay: 10% of all sessions, 100% of sessions with errors.
  // Default privacy masking stays ON — this is a health app; replays must
  // not capture bodyweight, sleep, or family data in the clear.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  integrations: [Sentry.replayIntegration()],
})

// Hook App Router navigations into tracing
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
