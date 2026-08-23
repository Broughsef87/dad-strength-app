'use client'

export const dynamic = 'force-dynamic'

import { createClient } from '../../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Moon, Sun, Bell, Download, Lock, Check, Loader2, Monitor, CreditCard, FileText, Trash2 } from 'lucide-react'
import BottomNav from '../../../components/BottomNav'
import { useTheme, type Theme } from '../../../contexts/ThemeContext'
import { useSubscription } from '../../../contexts/SubscriptionContext'

export default function Settings() {
  const router = useRouter()
  const supabase = createClient()

  const { theme, setTheme } = useTheme()
  const { isPro, isFounder } = useSubscription()
  const [notifWorkout, setNotifWorkout] = useState(false)
  const [notifCheckin, setNotifCheckin] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [hasBilling, setHasBilling] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')
  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    setNotifWorkout(localStorage.getItem('dad-strength-notif-workout') === 'true')
    setNotifCheckin(localStorage.getItem('dad-strength-notif-checkin') === 'true')
    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
    }

    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user?.email) setResetEmail(data.user.email)
      if (data.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('stripe_customer_id')
          .eq('id', data.user.id)
          .maybeSingle()
        setHasBilling(!!profile?.stripe_customer_id)
      }
    }
    loadProfile()
  }, [supabase])

  const handleOpenPortal = async () => {
    setPortalLoading(true)
    setPortalError('')
    try {
      const res = await fetch('/api/billing-portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Could not open billing portal')
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Could not open billing portal')
      setPortalLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteInput.trim().toLowerCase() !== 'delete') return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'delete' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Deletion failed')
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed')
      setDeleteLoading(false)
    }
  }

  const scheduleNotification = (type: 'workout' | 'checkin') => {
    // Show an immediate confirmation notification
    if (Notification.permission === 'granted') {
      new Notification('Dad Strength', {
        body: type === 'workout'
          ? 'Workout reminders enabled. You\'ll get a daily nudge to train.'
          : 'Check-in reminders enabled. Reflect each evening.',
        icon: '/icon-192.png',
      })
    }
  }

  const toggleNotifWorkout = async () => {
    const next = !notifWorkout
    setNotifWorkout(next)
    localStorage.setItem('dad-strength-notif-workout', String(next))
    if (next && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        scheduleNotification('workout')
      }
    }
  }

  const toggleNotifCheckin = async () => {
    const next = !notifCheckin
    setNotifCheckin(next)
    localStorage.setItem('dad-strength-notif-checkin', String(next))
    if (next && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        scheduleNotification('checkin')
      }
    }
  }

  const handleExportData = async () => {
    setExportLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Everything the account owns — data portability means all of it,
      // not just the legacy workout_logs table (real sets live in
      // ares_session_logs these days).
      const tables = [
        'user_profiles',
        'ares_session_logs',
        'workout_logs',
        'generated_workouts',
        'daily_checkins',
        'body_composition',
        'user_maxes',
        'user_programs',
        'user_exercise_subs',
        'daily_objectives',
        'family_pulse',
        'brotherhood_contacts',
        'user_recovery_checks',
        'user_learning',
      ] as const

      const results = await Promise.all(
        tables.map((t) =>
          supabase
            .from(t)
            .select('*')
            .eq(t === 'user_profiles' ? 'id' : 'user_id', user.id)
        )
      )

      const payload: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        account_email: user.email,
      }
      tables.forEach((t, i) => {
        payload[t] = results[i].data ?? []
      })

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dad-strength-data-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExportLoading(false)
    }
  }

  const handleSendReset = async () => {
    if (!resetEmail) return
    setResetLoading(true)
    setResetError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
      })
      if (error) throw error
      setResetSent(true)
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to send reset email.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 border-b border-border bg-surface-2 px-4 py-4 sticky top-0 z-10">
        <button
          onClick={() => router.push('/profile')}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-light tracking-tight">Settings</h1>
      </header>

      <main className="max-w-md mx-auto p-6 pb-28 space-y-8">

        {/* Appearance */}
        <section className="space-y-3">
          <h2 className="text-xs text-muted-foreground lowercase font-medium px-1">Appearance</h2>
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Theme</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {theme === 'auto' ? 'Follows your device' : theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </p>
              </div>
            </div>
            {/* iOS-style 3-segment pill */}
            <div className="flex rounded-lg bg-muted p-1 gap-0.5">
              {([
                { value: 'auto' as Theme, label: 'Auto', Icon: Monitor },
                { value: 'light' as Theme, label: 'Light', Icon: Sun },
                { value: 'dark' as Theme, label: 'Dark', Icon: Moon },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                    theme === value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="space-y-3">
          <h2 className="text-xs text-muted-foreground lowercase font-medium px-1">Notifications</h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            <button
              onClick={toggleNotifWorkout}
              className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="p-2 bg-muted rounded-lg">
                <Bell size={16} className="text-foreground" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-sm">Workout Reminders</p>
                <p className="text-xs text-muted-foreground">Daily nudge to train</p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${notifWorkout ? 'bg-brand' : 'bg-muted'}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${notifWorkout ? 'left-5' : 'left-0.5'}`} />
              </div>
            </button>

            <button
              onClick={toggleNotifCheckin}
              className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="p-2 bg-muted rounded-lg">
                <Bell size={16} className="text-foreground" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-sm">Daily Check-in</p>
                <p className="text-xs text-muted-foreground">Evening reflection reminder</p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${notifCheckin ? 'bg-brand' : 'bg-muted'}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${notifCheckin ? 'left-5' : 'left-0.5'}`} />
              </div>
            </button>
          </div>
          <p className="text-xs text-muted-foreground px-1">
            Preferences saved locally. Native push notifications coming soon.
          </p>
          {notifPermission === 'denied' && (
            <p className="text-xs text-red-500/70 px-1">
              Notifications blocked by browser. Enable in browser settings to receive reminders.
            </p>
          )}
          {notifPermission === 'granted' && (
            <p className="text-xs text-green-600/70 px-1">
              ✓ Browser notifications enabled.
            </p>
          )}
        </section>

        {/* Data & Privacy */}
        <section className="space-y-3">
          <h2 className="text-xs text-muted-foreground lowercase font-medium px-1">Data & Privacy</h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            <button
              onClick={handleExportData}
              disabled={exportLoading}
              className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors disabled:opacity-60"
            >
              <div className="p-2 bg-muted rounded-lg">
                {exportLoading ? (
                  <Loader2 size={16} className="text-foreground animate-spin" />
                ) : (
                  <Download size={16} className="text-foreground" />
                )}
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-sm">Export My Data</p>
                <p className="text-xs text-muted-foreground">Download everything as JSON</p>
              </div>
            </button>

            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="p-2 bg-muted rounded-lg">
                <Lock size={16} className="text-foreground" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-sm">Change Password</p>
                <p className="text-xs text-muted-foreground">Send a password reset link</p>
              </div>
            </button>

            {showPasswordForm && (
              <div className="p-4 space-y-3 bg-muted/30">
                {resetSent ? (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Check size={16} className="text-green-500" />
                    Reset link sent to {resetEmail}
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll send a password reset link to:
                    </p>
                    <p className="text-sm font-medium">{resetEmail}</p>
                    {resetError && (
                      <p className="text-xs text-red-500">{resetError}</p>
                    )}
                    <button
                      onClick={handleSendReset}
                      disabled={resetLoading}
                      className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-medium text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {resetLoading ? (
                        <><Loader2 size={14} className="animate-spin" /> Sending...</>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Billing — only rendered once a Stripe customer exists */}
        {(hasBilling || (isPro && !isFounder)) && (
          <section className="space-y-3">
            <h2 className="text-xs text-muted-foreground lowercase font-medium px-1">Billing</h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <button
                onClick={handleOpenPortal}
                disabled={portalLoading}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors disabled:opacity-60"
              >
                <div className="p-2 bg-muted rounded-lg">
                  {portalLoading ? (
                    <Loader2 size={16} className="text-foreground animate-spin" />
                  ) : (
                    <CreditCard size={16} className="text-foreground" />
                  )}
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-sm">Manage Billing</p>
                  <p className="text-xs text-muted-foreground">
                    Update card, view invoices, cancel subscription
                  </p>
                </div>
              </button>
            </div>
            {portalError && <p className="text-xs text-red-500 px-1">{portalError}</p>}
            <p className="text-xs text-muted-foreground px-1">
              Opens Stripe&apos;s secure billing portal. Cancelling keeps access until the end of the
              current period.
            </p>
          </section>
        )}

        {/* Legal */}
        <section className="space-y-3">
          <h2 className="text-xs text-muted-foreground lowercase font-medium px-1">Legal</h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            {[
              { label: 'Terms of Service', href: '/terms' },
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Fitness & Medical Disclaimer', href: '/disclaimer' },
            ].map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="p-2 bg-muted rounded-lg">
                  <FileText size={16} className="text-foreground" />
                </div>
                <p className="font-medium text-sm">{label}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Danger zone */}
        <section className="space-y-3">
          <h2 className="text-xs text-muted-foreground lowercase font-medium px-1">Danger Zone</h2>
          <div className="bg-card rounded-xl border border-red-500/20 overflow-hidden">
            <button
              onClick={() => setShowDeleteForm(!showDeleteForm)}
              className="w-full flex items-center gap-4 p-4 hover:bg-red-500/5 transition-colors"
            >
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Trash2 size={16} className="text-red-500" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-sm text-red-500">Delete Account</p>
                <p className="text-xs text-muted-foreground">
                  Permanently erase your account and all data
                </p>
              </div>
            </button>

            {showDeleteForm && (
              <div className="p-4 space-y-3 border-t border-red-500/20 bg-red-500/[0.02]">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This permanently deletes your account, every workout you&apos;ve logged, your
                  check-ins, your progress — everything. Any active subscription is cancelled
                  immediately. <span className="text-foreground font-medium">This cannot be undone.</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Type <span className="font-mono font-bold text-foreground">delete</span> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="delete"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-red-500/50"
                  autoComplete="off"
                />
                {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteInput.trim().toLowerCase() !== 'delete' || deleteLoading}
                  className="w-full flex items-center justify-center gap-2 bg-red-500 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-40"
                >
                  {deleteLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Deleting…</>
                  ) : (
                    'Permanently Delete My Account'
                  )}
                </button>
              </div>
            )}
          </div>
        </section>

      </main>

      <BottomNav />
    </div>
  )
}
