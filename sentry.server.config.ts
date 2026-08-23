// Sentry — Node.js server runtime. Imported by src/instrumentation.ts.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Attach local variable values to server stack frames
  includeLocalVariables: true,

  enableLogs: true,
})
