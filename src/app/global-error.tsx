'use client'

// Root error boundary — catches render errors in the root layout that
// error.tsx boundaries can't reach, and reports them to Sentry.
import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
import { useEffect } from 'react'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
