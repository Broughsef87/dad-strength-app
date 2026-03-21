'use client'

import { createClient } from '../../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Moon, Sun, Bell, Shield, Download, Lock, Check, Loader2 } from 'lucide-react'
import BottomNav from '../../../components/BottomNav'

export default function Settings() {
  const router = useRouter()
  const supabase = createClient()

  const [isDark, setIsDark] = useState(false)
  const [notifWorkout, setNotifWorkout] = useState(false)
  const [notifCheckin, setNotifCheckin] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('dad-strength-theme')
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
      setIsDark(true)
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark')
      setIsDark(false)
    } else {
      setIsDark(document.documentElement.classList.contains('dark'))
    }

    setNotifWorkout(localStorage.getItem('dad-strength-notif-workout') === 'true')
    setNotifCheckin(localStorage.getItem('dad-strength-notif-checkin') === 'true')
    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
    }

    const loadEmail = async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user?.email) setResetEmail(data.user.email)
    }
    loadEmail()
  }, [supabase])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('dad-strength-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('dad-strength-theme', 'light')
    }
  }

  const scheduleNotification = (type: 'workout' | 'checkin') => {
    // Show an immediate confirmation notification
    if (Notification.permission === 'granted') {
      new Notification('Dad Strength', {
        body: type === 'workout'
          ? 'Workout reminders enabled. You\'ll get a daily nudge to train.'
          : 'Check-in reminders enabled. Reflect each evening.',
        icon: '/icons/icon-192x192.png',
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

      const { data: logs } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const blob = new Blob([JSON.stringify(logs || [], null, 2)], { type: 'application/json' })
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
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 border-b border-border bg-background/90 px-4 py-4 backdrop-blur-md sticky top-0 z-10">
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
          <h2 className="text-xs text-muted-foreground uppercase tracking-[0.15em] font-medium px-1">Appearance</h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="p-2 bg-muted rounded-lg">
                {isDark ? <Sun size={16} className="text-foreground" /> : <Moon size={16} className="text-foreground" />}
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-sm">Dark Mode</p>
                <p className="text-xs text-muted-foreground">{isDark ? 'Dark mode on' : 'Light mode on'}</p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${isDark ? 'bg-brand' : 'bg-muted'}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${isDark ? 'left-5' : 'left-0.5'}`} />
              </div>
            </button>
          </div>
        </section>

        {/* Notifications */}
        <section className="space-y-3">
          <h2 className="text-xs text-muted-foreground uppercase tracking-[0.15em] font-medium px-1">Notifications</h2>
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
          <h2 className="text-xs text-muted-foreground uppercase tracking-[0.15em] font-medium px-1">Data & Privacy</h2>
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
                <p className="text-xs text-muted-foreground">Download workout logs as JSON</p>
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
                      We'll send a password reset link to:
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

      </main>

      <BottomNav />
    </div>
  )
}
