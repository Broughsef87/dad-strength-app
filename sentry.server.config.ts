// Sentry — Node.js server runtime. Imported by src/instrumentation.ts.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Local variables ride along on stack frames — in this app that means
  // workout data, Supabase rows, request bodies and Stripe objects would be
  // shipped to Sentry on every server exception, defeating the PII masking
  // configured on the client. Dev only.
  includeLocalVariables: process.env.NODE_ENV === 'development',

  enableLogs: true,
})
