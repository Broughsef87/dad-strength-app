'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, ChevronLeft, PlayCircle, CheckCircle2, Dumbbell, Flame } from 'lucide-react'
import BottomNav from '../../components/BottomNav'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

type DayData = {
  date: Date
  dateStr: string
  hasWorkout: boolean
  sessionCount: number
  volume: number
  isToday: boolean
  isPast: boolean
}

export default function Schedule() {
  const supabase = createClient()
  const router = useRouter()
  const [weekDays, setWeekDays] = useState<DayData[]>([])
  const [activeWorkout, setActiveWorkout] = useState<any>(null)
  const [streak, setStreak] = useState(0)
  const [weekVolume, setWeekVolume] = useState(0)
  const [weekSessions, setWeekSessions] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Get start of current week (Sunday)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 7)

      // Fetch this week's logs
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('created_at, weight_lbs, reps, workout_id')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('created_at', startOfWeek.toISOString())
        .lt('created_at', endOfWeek.toISOString())

      // Group by date
      const byDate: Record<string, { count: number; volume: number }> = {}
      for (const log of logs || []) {
        const key = new Date(log.created_at).toDateString()
        if (!byDate[key]) byDate[key] = { count: 0, volume: 0 }
        byDate[key].count++
        byDate[key].volume += (log.weight_lbs || 0) * (log.reps || 0)
      }

      // Build week days array
      const days: DayData[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek)
        d.setDate(startOfWeek.getDate() + i)
        const key = d.toDateString()
        days.push({
          date: d,
          dateStr: key,
          hasWorkout: !!byDate[key],
          sessionCount: byDate[key]?.count || 0,
          volume: byDate[key]?.volume || 0,
          isToday: d.toDateString() === today.toDateString(),
          isPast: d < today,
        })
      }
      setWeekDays(days)

      // Week stats
      const totalVol = Object.values(byDate).reduce((s, d) => s + d.volume, 0)
      setWeekVolume(Math.round(totalVol))
      setWeekSessions(Object.keys(byDate).length)

      // Streak
      const { data: allLogs } = await supabase
        .from('workout_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('created_at', { ascending: false })

      const uniqueDays = Array.from(new Set((allLogs || []).map((l: any) => new Date(l.created_at).toDateString())))
      let s = 0
      for (let i = 0; i < uniqueDays.length; i++) {
        const d = new Date(uniqueDays[i]); d.setHours(0,0,0,0)
        const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
        if (diff === i || (i === 0 && diff <= 1)) s++; else break
      }
      setStreak(s)

      // Active workout
      const activeId = localStorage.getItem('activeWorkoutId')
      if (activeId) {
        const { data: w } = await supabase.from('workouts').select('*').eq('id', activeId).maybeSingle()
        setActiveWorkout(w)
      }

      setLoading(false)
    }
    load()
  }, [router, supabase])

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const todayData = weekDays.find(d => d.isToday)

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24">
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-xl border-b border-gray-900 p-4 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl font-black italic uppercase tracking-tighter">This Week</h1>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">

        {/* Week strip */}
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
                {DAY_LABELS[day.date.getDay()]}
              </span>
              <div className={`w-full aspect-square rounded-xl flex items-center justify-center transition-all ${
                day.isToday
                  ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30'
                  : day.hasWorkout
                  ? 'bg-indigo-500/20 border border-indigo-500/30'
                  : day.isPast
                  ? 'bg-gray-900 border border-gray-800'
                  : 'bg-gray-900/40 border border-gray-900'
              }`}>
                {day.hasWorkout ? (
                  <CheckCircle2 size={14} className={day.isToday ? 'text-white' : 'text-indigo-400'} />
                ) : (
                  <span className={`text-xs font-black ${day.isToday ? 'text-white' : 'text-gray-700'}`}>
                    {day.date.getDate()}
                  </span>
                )}
              </div>
              {day.hasWorkout && !day.isToday && (
                <span className="text-[8px] text-indigo-400 font-black">✓</span>
              )}
            </div>
          ))}
        </div>

        {/* Week stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Sessions</p>
            <p className="font-black text-2xl">{weekSessions}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Streak</p>
            <div className="flex items-center justify-center gap-1">
              <Flame size={14} className="text-orange-500" />
              <p className="font-black text-2xl">{streak}</p>
            </div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Volume</p>
            <p className="font-black text-lg">{weekVolume > 0 ? `${(weekVolume/1000).toFixed(1)}k` : '—'}</p>
          </div>
        </div>

        {/* Today's session */}
        <div>
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-3">Today's Session</p>
          {todayData?.hasWorkout ? (
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-3xl p-5 flex items-center gap-4">
              <CheckCircle2 size={28} className="text-indigo-400 flex-shrink-0" />
              <div>
                <p className="font-black text-base">Session Complete</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {todayData.sessionCount} sets · {Math.round(todayData.volume).toLocaleString()} lbs
                </p>
              </div>
            </div>
          ) : activeWorkout ? (
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <Dumbbell size={20} className="text-indigo-400" />
                </div>
                <div>
                  <p className="font-black text-base tracking-tight">{activeWorkout.name}</p>
                  <p className="text-xs text-gray-500">{activeWorkout.description}</p>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">
                    {activeWorkout.exercises?.length || 0} exercises
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/workout/${activeWorkout.id}`)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
              >
                <PlayCircle size={16} /> Start Session
              </button>
            </div>
          ) : (
            <div className="bg-gray-900/50 border border-dashed border-gray-800 rounded-3xl p-8 text-center">
              <Calendar size={28} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">No program active</p>
              <button
                onClick={() => router.push('/edit-program')}
                className="mt-4 text-[10px] font-black text-indigo-400 uppercase tracking-widest border border-indigo-500/30 px-4 py-2 rounded-lg hover:bg-indigo-500/10 transition-colors"
              >
                Set Up Program →
              </button>
            </div>
          )}
        </div>

        {/* Past sessions this week */}
        {weekDays.some(d => d.hasWorkout && !d.isToday) && (
          <div>
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-3">This Week</p>
            <div className="space-y-2">
              {weekDays.filter(d => d.hasWorkout).map((day, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-900 rounded-2xl px-4 py-3 border border-gray-800">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-indigo-400" />
                    <div>
                      <p className="font-black text-sm">{DAY_LABELS[day.date.getDay()]} {day.date.getDate()}</p>
                      <p className="text-[10px] text-gray-600 font-bold">{day.sessionCount} sets</p>
                    </div>
                  </div>
                  {day.volume > 0 && (
                    <span className="text-xs font-black text-gray-500">{day.volume.toLocaleString()} lbs</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
