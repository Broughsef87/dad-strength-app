'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LogOut, Settings as SettingsIcon, Bell, Shield,
  Activity, Target, BookOpen, Dumbbell, Flame, Trophy,
  Pencil, Check, X, Zap
} from 'lucide-react'
import BottomNav from '../../components/BottomNav'
import DadOfMonth from '../../components/DadOfMonth'
import StreakShield from '../../components/StreakShield'
import { useSubscription } from '../../contexts/SubscriptionContext'
import UpgradeModal from '../../components/UpgradeModal'
import BodyVitals from '../../components/BodyVitals';
import RecoveryProtocol from '../../components/RecoveryProtocol';

export default function Profile() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const { isPro, isFounder, loading: subLoading } = useSubscription()
  const [showUpgrade, setShowUpgrade] = useState(false)

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [stats, setStats] = useState({ totalSessions: 0, totalVolume: 0, topLift: '', streak: 0 })
  const [programName, setProgramName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/'); return }
      setUser(data.user)

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', data.user.id)
        .maybeSingle()

      setDisplayName(profile?.display_name || data.user.email?.split('@')[0] || 'Dad')

      // Session days + streak come from the workout_logs streak shims (one
      // row per completed session). Volume and top lift come from
      // ares_session_logs — the shims are always 0 lbs × 0 reps, so summing
      // workout_logs here reported 0 volume forever.
      const [{ data: logs }, { data: sets }] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('created_at')
          .eq('user_id', data.user.id)
          .eq('completed', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('ares_session_logs')
          .select('block_name, weight_lbs, reps, log_type, completed')
          .eq('user_id', data.user.id)
          .eq('log_type', 'strength_set'),
      ])

      if (logs) {
        const uniqueDays = new Set<string>(logs.map((l: { created_at: string }) => new Date(l.created_at).toDateString()))

        const strengthSets = (sets ?? []).filter(
          (s: { completed?: boolean | null }) => s.completed !== false
        )
        const totalVolume = strengthSets.reduce(
          (sum: number, s: { weight_lbs?: number | null; reps?: number | null }) =>
            sum + (Number(s.weight_lbs) || 0) * (s.reps || 0),
          0
        )
        const topLog = strengthSets.reduce(
          (best: { weight_lbs?: number | null; block_name?: string } | null, s: { weight_lbs?: number | null; block_name?: string }) =>
            (Number(s.weight_lbs) || 0) > (Number(best?.weight_lbs) || 0) ? s : best,
          null
        )

        const days: string[] = Array.from(uniqueDays)
        let streak = 0
        const today = new Date(); today.setHours(0, 0, 0, 0)
        for (let i = 0; i < days.length; i++) {
          const d = new Date(days[i]); d.setHours(0, 0, 0, 0)
          const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
          if (diff === i || (i === 0 && diff <= 1)) streak++; else break
        }

        setStats({
          totalSessions: uniqueDays.size,
          totalVolume: Math.round(totalVolume),
          topLift: topLog ? `${topLog.block_name} · ${topLog.weight_lbs}lbs` : 'None yet',
          streak,
        })
      }

      const activeId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkoutId') : null
      if (activeId) {
        const { data: workout } = await supabase.from('workouts').select('name').eq('id', activeId).maybeSingle()
        if (workout) setProgramName(workout.name)
      }

      setLoading(false)
    }
    load()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleSaveName = async () => {
    if (!user) return
    setSavingName(true)
    await supabase.from('user_profiles').upsert({ id: user.id, display_name: nameInput }, { onConflict: 'id' })
    setDisplayName(nameInput)
    setEditingName(false)
    setSavingName(false)
  }

  // Subscription badge config
  const badgeLabel = isFounder ? 'founder' : isPro ? 'dad strong+' : 'free'
  const badgeClass = isPro
    ? 'text-brand bg-brand/10'
    : 'text-muted-foreground bg-muted'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-surface-2 px-6 py-4 sticky top-0 z-10">
        <h1 className="font-display text-3xl">profile</h1>
        <button onClick={() => router.push('/profile/settings')} className="text-muted-foreground hover:text-foreground transition-colors">
          <SettingsIcon size={18} />
        </button>
      </header>

      <main className="max-w-md mx-auto p-6 pb-28 space-y-6">

        {/* User Card */}
        <div className="tile p-5 flex items-center gap-5">
          <div className="h-14 w-14 rounded-full bg-foreground flex items-center justify-center font-medium text-lg text-background shrink-0">
            {user?.email?.charAt(0).toUpperCase() || 'D'}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:border-brand min-w-0"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                />
                <button onClick={handleSaveName} disabled={savingName} className="p-1.5 text-status-good-ink hover:text-status-good-ink transition-colors disabled:opacity-50">
                  <Check size={16} />
                </button>
                <button onClick={() => setEditingName(false)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-base truncate">{displayName}</h2>
                <button onClick={() => { setNameInput(displayName); setEditingName(true) }} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  <Pencil size={13} />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email}</p>

            {/* Real subscription badge */}
            {!subLoading && (
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-block eyebrow-mono px-2 py-0.5 rounded-full ${badgeClass}`}>
                  {badgeLabel}
                </span>
                {!isPro && (
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="inline-flex items-center gap-1 eyebrow-mono text-brand hover:text-brand/70 transition-colors"
                  >
                    <Zap size={9} /> upgrade
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/profile/mission')}
            className="tile p-5 hover:border-brand/30 transition-colors flex flex-col items-center text-center group"
          >
            <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Target className="text-brand" size={20} />
            </div>
            <p className="font-medium text-sm">My Mission</p>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">Goal & Progress</p>
          </button>

        </div>


        {/* Body composition and recovery live here rather than on Train: Train is
            what you do, this is what you are. BodyVitals is also the actual
            body-comp surface the Pro tier advertises. */}
        <BodyVitals />

        <RecoveryProtocol />

        <DadOfMonth />

        <StreakShield />

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="bg-card rounded-xl p-4 border border-border h-20 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="tile p-4">
              <Flame className="text-brand mb-2" size={16} />
              <p className="text-xs text-muted-foreground lowercase font-medium font-display">Streak</p>
              <p className="font-light text-2xl mt-1 font-display">{stats.streak} <span className="text-xs text-muted-foreground">days</span></p>
            </div>
            <div className="tile p-4">
              <Dumbbell className="text-muted-foreground mb-2" size={16} />
              <p className="text-xs text-muted-foreground lowercase font-medium font-display">Sessions</p>
              <p className="font-light text-2xl mt-1 font-display">{stats.totalSessions}</p>
            </div>
            <div className="tile p-4">
              <Activity className="text-status-good-ink mb-2" size={16} />
              <p className="text-xs text-muted-foreground lowercase font-medium font-display">Total Volume</p>
              <p className="font-light text-xl mt-1 font-display">{stats.totalVolume.toLocaleString()} <span className="text-xs text-muted-foreground">lbs</span></p>
            </div>
            <div className="tile p-4">
              <Trophy className="text-brand-text mb-2" size={16} />
              <p className="text-xs text-muted-foreground lowercase font-medium font-display">Top Lift</p>
              <p className="font-medium text-xs mt-1 leading-snug">{stats.topLift}</p>
            </div>
          </div>
        )}

        {/* Active Program */}
        {programName && (
          <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-brand lowercase font-medium font-display">Active Protocol</p>
              <p className="font-medium text-sm mt-0.5">{programName}</p>
            </div>
            <button onClick={() => router.push('/build')} className="text-xs font-medium text-brand lowercase hover:opacity-70 transition-opacity">
              Change →
            </button>
          </div>
        )}

        {/* Settings */}
        <div className="space-y-2">
          <h3 className="text-xs text-muted-foreground lowercase font-medium px-1 font-display">Settings</h3>

          <button
            onClick={() => router.push('/profile/settings')}
            className="w-full flex items-center gap-4 p-4 tile hover:border-brand/30 transition-colors"
          >
            <div className="p-2 bg-muted rounded-lg"><Bell size={16} className="text-foreground" /></div>
            <div className="text-left">
              <p className="font-medium text-sm">Notifications</p>
              <p className="text-xs text-muted-foreground">Workout reminders & alerts</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/profile/settings')}
            className="w-full flex items-center gap-4 p-4 tile hover:border-brand/30 transition-colors"
          >
            <div className="p-2 bg-muted rounded-lg"><Shield size={16} className="text-foreground" /></div>
            <div className="text-left">
              <p className="font-medium text-sm">Privacy & Security</p>
              <p className="text-xs text-muted-foreground">Password, data export</p>
            </div>
          </button>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-4 mt-4 rounded-xl border border-status-danger-fill/20 text-status-danger-ink hover:bg-status-danger-fill/5 transition-colors text-sm font-medium"
        >
          <LogOut size={16} /> Sign Out
        </button>

        <p className="text-center text-[10px] tracking-[0.15em] text-muted-foreground/50 lowercase mt-6">
          Dad Strength · Powered by Forge OS
        </p>

      </main>

      <BottomNav />

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  )
}
