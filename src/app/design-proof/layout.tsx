import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

// The proof harness renders every core surface with sample data outside the
// auth wall, so a branch can be judged — both grounds, phone width — before it
// merges. It exists on localhost and on Vercel PREVIEW deployments, where
// VERCEL_ENV is "preview", and 404s on the production deployment, where it is
// "production". A server layout, not the client page: the gate runs before
// anything renders and does not depend on a NEXT_PUBLIC_ variable being exposed.
export default function DesignProofLayout({ children }: { children: ReactNode }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  return children
}
