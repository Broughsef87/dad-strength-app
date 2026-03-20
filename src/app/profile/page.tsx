'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Settings as SettingsIcon, Bell, Shield, Activity, Target, BookOpen, Dumbbell, Flame, Trophy, Pencil, Check, X } from 'lucide-react'
import BottomNav from '../../components/BottomNav'

export default function Profile() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
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

      if (profile?.display_name) {
        setDisplayName(profile.display_name)
      } else {
        setDisplayName(data.user.email?.split('@')[0] || 'Dad')
      }

      const { data: logs } = await supabase
        .from('workout_logs')
        .select('created_at, weight_lbs, reps, exercise_name, workout_id')
        .eq('user_id', data.user.id)
        .eq('completed', true)
        .order('created_at', { ascending: false })

      if (logs) {
        const uniqueDays = new Set(logs.map((l: any) => new Date(l.created_at).toDateString()))
        const totalVolume = logs.reduce((sum: number, l: any) => sum + (l.weight_lbs || 0) * (l.reps || 0), 0)
        const topLog = logs.reduce((best: any, l: any) =>
          (l.weight_lbs || 0) > (best?.weight_lbs || 0) ? l : best, null)

        const days = Array.from(uniqueDays)
        let streak = 0
        const today = new Date(); today.setHours(0,0,0,0)
        for (let i = 0; i < days.length; i++) {
          const d = new Date(days[i]); d.setHours(0,0,0,0)
          const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
          if (diff === i || (i === 0 && diff <= 1)) streak++; else break
        }

        setStats({
          totalSessions: uniqueDays.size,
          totalVolume: Math.round(totalVolume),
          topLift: topLog ? `${topLog.exercise_name} · ${topLog.weight_lbs}lbs` : 'None yet',
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
  }, [router, supabase])

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-background/90 px-6 py-4 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-light tracking-tight">Profile</h1>
        <button
          onClick={() => router.push('/profile/settings')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <SettingsIcon size={18} />
        </button>
      </header>

      <main className="max-w-md mx-auto p-6 pb-24 space-y-6">

        {/* User Card */}
        <div className="bg-card rounded-xl p-5 border border-border flex items-center gap-5">
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
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="p-1.5 text-green-500 hover:text-green-400 transition-colors disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-base truncate">{displayName}</h2>
                <button
                  onClick={() => { setNameInput(displayName); setEditingName(true) }}
                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email}</p>
            <span className="inline-block mt-2 text-xs font-medium text-brand uppercase tracking-[0.12em] bg-brand/10 px-2 py-0.5 rounded">Pro Member</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/profile/edit-mission')}
            className="bg-card rounded-xl p-5 border border-border hover:border-foreground/20 transition-colors flex flex-col items-center text-center group"
          >
            <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Target className="text-brand" size={20} />
            </div>
            <p className="font-medium text-sm">Edit Mission</p>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">Customize Goals</p>
          </button>

          <button
            onClick={() => router.push('/profile/growth')}
            className="bg-card rounded-xl p-5 border border-border hover:border-foreground/20 transition-colors flex flex-col items-center text-center group"
          >
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <BookOpen className="text-foreground" size={20} />
            </div>
            <p className="font-medium text-sm">Growth</p>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">Mindset & Family</p>
          </button>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="bg-card rounded-xl p-4 border border-border h-20 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border">
              <Flame className="text-brand mb-2" size={16} />
              <p className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium">Streak</p>
              <p className="font-light text-2xl mt-1">{stats.streak} <span className="text-xs text-muted-foreground">days</span></p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <Dumbbell className="text-muted-foreground mb-2" size={16} />
              <p className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium">Sessions</p>
              <p className="font-light text-2xl mt-1">{stats.totalSessions}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <Activity className="text-green-600 mb-2" size={16} />
              <p className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium">Total Volume</p>
              <p className="font-light text-xl mt-1">{stats.totalVolume.toLocaleString()} <span className="text-xs text-muted-foreground">lbs</span></p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <Trophy className="text-yellow-600 mb-2" size={16} />
              <p className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium">Top Lift</p>
              <p className="font-medium text-xs mt-1 leading-snug">{stats.topLift}</p>
            </div>
          </div>
        )}

        {/* Active Program */}
        {programName && (
          <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-brand uppercase tracking-[0.12em] font-medium">Active Protocol</p>
              <p className="font-medium text-sm mt-0.5">{programName}</p>
            </div>
            <button onClick={() => router.push('/edit-program')} className="text-xs font-medium text-brand uppercase tracking-[0.12em] hover:opacity-70 transition-opacity">
              Change →
            </button>
          </div>
        )}

        {/* Settings */}
        <div className="space-y-2">
          <h3 className="text-xs text-muted-foreground uppercase tracking-[0.15em] font-medium px-1">Settings</h3>

          <button
            onClick={() => router.push('/profile/settings')}
            className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-foreground/20 transition-colors"
          >
            <div className="p-2 bg-muted rounded-lg">
              <Bell size={16} className="text-foreground" />
            </div>
            <div className="text-left">
              <p className="font-medium text-sm">Notifications</p>
              <p className="text-xs text-muted-foreground">Workout reminders & alerts</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/profile/settings')}
            className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-foreground/20 transition-colors"
          >
            <div className="p-2 bg-muted rounded-lg">
              <Shield size={16} className="text-foreground" />
            </div>
            <div className="text-left">
              <p className="font-medium text-sm">Privacy & Security</p>
              <p className="text-xs text-muted-foreground">Password, data export</p>
            </div>
          </button>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-4 mt-4 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/5 transition-colors text-sm font-medium"
        >
          <LogOut size={16} /> Sign Out
        </button>

      </main>

      <BottomNav />
    </div>
  )
}
