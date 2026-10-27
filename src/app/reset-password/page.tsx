'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { createClient } from '../../utils/supabase/client'

// Landing page for a password reset email. The browser client exchanges the
// link's ?code= for a session on load; this page then sets the new password.
// UserContext sends a PASSWORD_RECOVERY landing anywhere else here.
export default function ResetPassword() {
  const [supabase] = useState(() => createClient())
  const [ready, setReady] = useState<'checking' | 'yes' | 'no'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    // getSession waits for the client to finish exchanging the link's code,
    // so no session here means the link expired, was used, or was opened in
    // a different browser from the one that asked for it.
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: unknown } }) => {
      setReady(session ? 'yes' : 'no')
    })
  }, [supabase])

  const save = async () => {
    setError('')
    if (password.length < 6) return setError('use at least 6 characters.')
    if (password !== confirm) return setError("those passwords don't match.")
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) return setError(error.message)
    setDone(true)
  }

  const input = 'w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-foreground/40'

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-card border border-border p-6 space-y-4">
        <h1 className="text-2xl font-display font-semibold lowercase">set a new password</h1>

        {ready === 'checking' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> checking your reset link…
          </p>
        )}

        {ready === 'no' && (
          <>
            <p className="text-sm text-muted-foreground">
              this reset link has expired or was already used. open it in the same browser you asked from, or request a new one from the sign in form.
            </p>
            <a href="/#sign-in" className="pill-volt inline-block px-6 py-3 text-sm font-semibold">back to sign in</a>
          </>
        )}

        {ready === 'yes' && done && (
          <>
            <p className="flex items-center gap-2 text-sm text-foreground">
              <Check size={16} className="text-status-good-ink" /> password updated.
            </p>
            <a href="/dashboard" className="pill-volt inline-block px-6 py-3 text-sm font-semibold">open the app</a>
          </>
        )}

        {ready === 'yes' && !done && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save() }}>
            <label className="block text-xs text-muted-foreground">
              new password
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} mt-1`} />
            </label>
            <label className="block text-xs text-muted-foreground">
              confirm it
              <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${input} mt-1`} />
            </label>
            {error && <p className="text-xs text-status-danger-ink">{error}</p>}
            <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-medium text-sm py-2.5 rounded-lg disabled:bg-surface-2 disabled:text-muted-foreground">
              {saving ? <><Loader2 size={14} className="animate-spin" /> saving…</> : 'save password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
