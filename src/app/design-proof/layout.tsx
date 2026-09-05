import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

// The proof harness renders every core surface with sample data outside the
// auth wall, so a branch can be judged — both grounds, phone width — before it
// merges. It renders in exactly two places, as an ALLOWLIST: local development
// (NODE_ENV is not "production") and a Vercel preview deployment (VERCEL_ENV is
// "preview" — those are production builds, so NODE_ENV alone would hide them).
// Everywhere else, including a production host that is not Vercel and so has
// no VERCEL_ENV at all, it 404s. A denylist on VERCEL_ENV === "production"
// left that host open (Codex, round 10). A server layout, not the client page:
// the gate runs before anything renders and needs no NEXT_PUBLIC_ variable.
export default function DesignProofLayout({ children }: { children: ReactNode }) {
  const allowed = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview'
  if (!allowed) notFound()
  return children
}
