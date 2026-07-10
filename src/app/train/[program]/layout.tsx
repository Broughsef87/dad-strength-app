import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'

// ═══════════════════════════════════════════════════════════════════════════════
// Server-side guard for /train/[program]/*
//
// The training pages are client components that compute the day plan in-browser
// from static config, so neither RLS nor a client check can gate them — RLS has
// no row to protect, and a client check is trivially bypassed. This layout is a
// SERVER component, so the redirect happens before any training UI is sent.
//
// The rule: you may only train the program you have activated. `user_programs`
// has a UNIQUE user_id, so program_slug IS your program. Free users claim one
// and keep it; Pro users may switch (enforced in the DB by the
// user_programs_tier_gate trigger).
//
// NOTE: this gates *use* of a program, not knowledge of it. The percentage
// tables live in src/lib/programs and ship in the client bundle, so a motivated
// user can read the numbers regardless. Moving buildDay behind a server route
// would be required to protect the content itself.
// ═══════════════════════════════════════════════════════════════════════════════

export default async function TrainProgramLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ program: string }>
}) {
  const { program } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: row } = await supabase
    .from('user_programs')
    .select('program_slug')
    .eq('user_id', user.id)
    .maybeSingle()

  // No program claimed yet — go pick one.
  if (!row?.program_slug) redirect('/build')

  // Trying to train a program that isn't theirs.
  if (row.program_slug !== program) redirect(`/build?locked=${encodeURIComponent(program)}`)

  return <>{children}</>
}
