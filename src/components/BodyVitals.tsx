'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { Dumbbell, Flame, TrendingUp, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

const WEEKLY_TARGET = 4

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getSundayOfWeek(monday: Date): Date {
  const d = new Date(monday)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

export default function BodyVitals() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const monday = getMondayOfWeek(new Date())
      const sunday = getSundayOfWeek(monday)

      const { data: weekLogs } = await supabase
        .from('workout_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('created_at', monday.toISOString())
        .lte('created_at', sunday.toISOString())

      setSessionsThisWeek(weekLogs?.length ?? 0)

      const { data: allLogs } = await supabase
        .from('workout_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('created_at', { ascending: false })

      if (allLogs && allLogs.length > 0) {
        const uniqueDays = [...new Set(
          allLogs.map((l: any) => new Date(l.created_at).toLocaleDateString('en-CA'))
        )] as string[]

        let s = 0
        const today = new Date()
        for (let i = 0; i < uniqueDays.length; i++) {
          const expected = new Date(today)
          expected.setDate(today.getDate() - i)
          const expectedStr = expected.toLocaleDateString('en-CA')
          if (uniqueDays[i] === expectedStr) {
            s++
          } else {
            break
          }
        }
        setStreak(s)
      }

      setLoading(false)
    }
    load()
  }, [])

  const onTrack = sessionsThisWeek >= Math.floor(WEEKLY_TARGET * 0.5)
  const crushing = sessionsThisWeek >= WEEKLY_TARGET

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-5 border border-border animate-pulse">
        <div className="h-3 bg-muted rounded w-1/2 mb-3" />
        <div className="h-7 bg-muted rounded w-1/3" />
      </div>
    )
  }

  return (
    <div
      className="bg-card rounded-xl p-5 border border-border hover:border-foreground/20 transition-colors cursor-pointer group"
      onClick={() => router.push('/body')}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-brand/10 rounded-lg text-brand">
            <Dumbbell size={16} />
          </div>
          <h3 className="font-medium text-sm">Body Vitals</h3>
        </div>
        <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-background rounded-lg p-3.5 border border-border">
          <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
            <TrendingUp size={12} />
            <span className="text-[9px] uppercase tracking-[0.12em] font-medium">This Week</span>
          </div>
          <p className={`text-xl font-light tabular-nums ${crushing ? 'text-green-600' : onTrack ? 'text-yellow-600' : 'text-red-500'}`}>
            {sessionsThisWeek}<span className="text-sm text-muted-foreground">/{WEEKLY_TARGET}</span>
          </p>
          <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-[0.1em]">
            {crushing ? 'On fire' : onTrack ? 'On track' : 'Behind'}
          </p>
        </div>

        <div className="bg-background rounded-lg p-3.5 border border-border">
          <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
            <Flame size={12} />
            <span className="text-[9px] uppercase tracking-[0.12em] font-medium">Streak</span>
          </div>
          <p className={`text-xl font-light tabular-nums ${streak >= 5 ? 'text-green-600' : streak >= 2 ? 'text-yellow-600' : 'text-foreground'}`}>
            {streak}
          </p>
          <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-[0.1em]">
            {streak === 1 ? 'day' : 'days'}
          </p>
        </div>
      </div>

      {crushing ? (
        <div className="p-3 bg-green-500/8 border border-green-500/20 rounded-lg flex items-center gap-2.5">
          <CheckCircle size={12} className="text-green-600 shrink-0" />
          <p className="text-[10px] text-green-600 uppercase tracking-[0.1em] font-medium">
            Weekly target hit.
          </p>
        </div>
      ) : onTrack ? (
        <div className="p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-lg flex items-center gap-2.5">
          <Flame size={12} className="text-yellow-600 shrink-0" />
          <p className="text-[10px] text-yellow-600 uppercase tracking-[0.1em] font-medium">
            {WEEKLY_TARGET - sessionsThisWeek} session{WEEKLY_TARGET - sessionsThisWeek !== 1 ? 's' : ''} to go.
          </p>
        </div>
      ) : (
        <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-lg flex items-center gap-2.5">
          <AlertTriangle size={12} className="text-red-500 shrink-0" />
          <p className="text-[10px] text-red-500 uppercase tracking-[0.1em] font-medium">
            Behind on the week.
          </p>
        </div>
      )}
    </div>
  )
}
