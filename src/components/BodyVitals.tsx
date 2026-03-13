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

      // Sessions this week
      const { data: weekLogs } = await supabase
        .from('workout_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('created_at', monday.toISOString())
        .lte('created_at', sunday.toISOString())

      setSessionsThisWeek(weekLogs?.length ?? 0)

      // Streak: consecutive unique days with completed workouts
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

  const weekStatusColor = crushing
    ? 'text-green-400'
    : onTrack
    ? 'text-yellow-400'
    : 'text-red-400'

  const weekStatusLabel = crushing
    ? 'On Fire'
    : onTrack
    ? 'On Track'
    : 'Behind'

  const streakColor = streak >= 5 ? 'text-green-400' : streak >= 2 ? 'text-yellow-400' : 'text-gray-400'

  if (loading) {
    return (
      <div className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-1/2 mb-4" />
        <div className="h-8 bg-gray-800 rounded w-1/3" />
      </div>
    )
  }

  return (
    <div
      className="bg-gray-900/50 rounded-3xl p-6 border border-gray-800 shadow-xl group hover:border-indigo-500/30 transition-all duration-300 cursor-pointer"
      onClick={() => router.push('/body')}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Dumbbell size={20} />
          </div>
          <h3 className="font-black italic uppercase tracking-tighter text-sm">Body Vitals</h3>
        </div>
        <ChevronRight size={16} className="text-gray-600 group-hover:text-indigo-400 transition-colors" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Sessions this week */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 group-hover:bg-indigo-500/5 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <TrendingUp size={14} />
            <span className="text-[10px] uppercase font-black tracking-widest">This Week</span>
          </div>
          <p className={`text-2xl font-black font-mono tracking-tighter ${weekStatusColor}`}>
            {sessionsThisWeek}/{WEEKLY_TARGET}
          </p>
          <p className="text-[10px] text-gray-600 mt-1 font-bold uppercase tracking-widest">
            {weekStatusLabel}
          </p>
        </div>

        {/* Streak */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 group-hover:bg-indigo-500/5 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Flame size={14} />
            <span className="text-[10px] uppercase font-black tracking-widest">Streak</span>
          </div>
          <p className={`text-2xl font-black font-mono tracking-tighter ${streakColor}`}>
            {streak}
          </p>
          <p className="text-[10px] text-gray-600 mt-1 font-bold uppercase tracking-widest">
            {streak === 1 ? 'Day' : 'Days'}
          </p>
        </div>
      </div>

      {/* Status banner */}
      {crushing ? (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
          <CheckCircle size={14} className="text-green-400 shrink-0" />
          <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">
            Weekly target hit. Dad strength is real.
          </p>
        </div>
      ) : onTrack ? (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3">
          <Flame size={14} className="text-yellow-400 shrink-0" />
          <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">
            {WEEKLY_TARGET - sessionsThisWeek} more session{WEEKLY_TARGET - sessionsThisWeek !== 1 ? 's' : ''} to hit the week.
          </p>
        </div>
      ) : (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">
            Behind on the week. No excuses.
          </p>
        </div>
      )}
    </div>
  )
}
