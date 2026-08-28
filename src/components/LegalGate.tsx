'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '../utils/supabase/client'

// Routes where the gate must never block: the auth wall itself and the
// legal pages the gate links to (a user must be able to read what they
// are being asked to accept).
const EXEMPT_PATHS = ['/', '/privacy', '/terms', '/disclaimer']

/**
 * LegalGate — first-run fitness/medical acknowledgement.
 *
 * Dad Strength prescribes heavy barbell loads; before a signed-in user
 * touches the app they acknowledge the disclaimer once. The acceptance
 * timestamp is persisted to user_profiles.disclaimer_accepted_at, so it
 * follows the account across devices and survives reinstalls.
 */
export default function LegalGate() {
  const pathname = usePathname()
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [needsAck, setNeedsAck] = useState(false)
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setUserId(null)
        setNeedsAck(false)
        return
      }
      setUserId(user.id)

      const { data: profile, error: qErr } = await supabase
        .from('user_profiles')
        .select('disclaimer_accepted_at')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return
      // On a query error, fail open — never lock a paying user out of the
      // app because a read failed. The gate re-checks on next mount.
      if (qErr) {
        setNeedsAck(false)
        return
      }
      setNeedsAck(!profile?.disclaimer_accepted_at)
    }

    check()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      check()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleAccept = async () => {
    if (!userId || !checked) return
    setSaving(true)
    setError('')
    const { error: uErr } = await supabase
      .from('user_profiles')
      .upsert(
        { id: userId, disclaimer_accepted_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
    if (uErr) {
      setError('could not save — check your connection and try again.')
      setSaving(false)
      return
    }
    setNeedsAck(false)
    setSaving(false)
  }

  if (!needsAck || !userId || EXEMPT_PATHS.includes(pathname)) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-[hsl(var(--scrim))]/70">
      <LegalGateView
        checked={checked}
        saving={saving}
        error={error}
        onCheckedChange={setChecked}
        onAccept={handleAccept}
      />
    </div>
  )
}

// ── Pure view — rendered by the container above and by /design-proof ───────

export interface LegalGateViewProps {
  checked: boolean
  saving: boolean
  error: string
  onCheckedChange: (v: boolean) => void
  onAccept: () => void
}

export function LegalGateView({ checked, saving, error, onCheckedChange, onAccept }: LegalGateViewProps) {
  return (
    <div className="tile-lg w-full max-w-md p-6 pop-in max-h-[85vh] overflow-y-auto">
        <p className="eyebrow-mono mb-2">before you train</p>
        <h2 className="font-display text-2xl lowercase leading-tight mb-4">
          read this once. it matters.
        </h2>

        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed mb-5">
          <p>
            dad strength prescribes hard training with heavy loads. that carries real risk —
            up to and including serious injury.
          </p>
          <div className="row-recessed p-4 space-y-2">
            {[
              'nothing in this app is medical advice.',
              'talk to your physician before starting, especially with any health condition or injury.',
              'you train at your own risk and within your own limits.',
              'sharp pain, chest discomfort, dizziness — stop immediately.',
            ].map((line, i) => (
              <p key={i} className="flex items-start gap-2">
                <span className="text-brand flex-shrink-0 mt-0.5">—</span>
                <span>{line}</span>
              </p>
            ))}
          </div>
          <p>
            the full{' '}
            <a href="/disclaimer" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
              fitness &amp; medical disclaimer
            </a>{' '}
            and{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
              terms of service
            </a>{' '}
            apply to everything in here.
          </p>
        </div>

        <label className="flex items-start gap-3 mb-5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--brand))] flex-shrink-0"
          />
          <span className="text-sm text-foreground leading-snug">
            i&apos;ve read this, i accept the terms and disclaimer, and i take responsibility
            for my own training.
          </span>
        </label>

        {error && <p className="text-xs text-status-danger-ink mb-3">{error}</p>}

        <button
          onClick={onAccept}
          disabled={!checked || saving}
          className="w-full pill-volt py-3.5 text-sm lowercase disabled:opacity-40 transition-opacity"
        >
          {saving ? 'saving…' : 'accept & train'}
        </button>
    </div>
  )
}
