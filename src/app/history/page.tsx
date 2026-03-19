'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Dumbbell, History as HistoryIcon, Calendar, ChevronDown, ChevronUp, Weight } from 'lucide-react'
import BottomNav from '../../components/BottomNav'
import WeeklyDebrief from '../../components/WeeklyDebrief'

type LogEntry = {
  id: string
  workout_id: string
  exercise_name: string
  set_number: number
  weight_lbs: number
  reps: number
  completed: boolean
  created_at: string
}

type SessionGroup = {
  date: string
  workout_id: string
  workout_name?: string
  exercises: Record<string, LogEntry[]>
  totalVolume: number
  totalSets: number
}

export default function History() {
  const supabase = createClient()
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data, error } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching history:', error)
        setLoading(false)
        return
      }

      // Get unique workout IDs to fetch names
      const workoutIds = Array.from(new Set((data || []).map((l: LogEntry) => l.workout_id).filter(Boolean)))
      let workoutNames: Record<string, string> = {}
      if (workoutIds.length > 0) {
        const { data: workouts } = await supabase
          .from('workouts')
          .select('id, name')
          .in('id', workoutIds)
        ;(workouts || []).forEach((w: any) => { workoutNames[w.id] = w.name })
      }

      // Group by date + workout_id (each unique date+workout = one session)
      const sessionMap: Record<string, SessionGroup> = {}

      for (const log of (data || [])) {
        const dateKey = new Date(log.created_at).toDateString()
        const sessionKey = `${dateKey}__${log.workout_id}`

        if (!sessionMap[sessionKey]) {
          sessionMap[sessionKey] = {
            date: log.created_at,
            workout_id: log.workout_id,
            workout_name: workoutNames[log.workout_id] || 'Custom Workout',
            exercises: {},
            totalVolume: 0,
            totalSets: 0,
          }
        }

        const session = sessionMap[sessionKey]
        if (!session.exercises[log.exercise_name]) {
          session.exercises[log.exercise_name] = []
        }
        session.exercises[log.exercise_name].push(log)
        session.totalVolume += (log.weight_lbs || 0) * (log.reps || 0)
        session.totalSets++
      }

      const sorted = Object.values(sessionMap).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      setSessions(sorted)
      // Auto-expand the most recent session
      if (sorted.length > 0) {
        const firstKey = `${new Date(sorted[0].date).toDateString()}__${sorted[0].workout_id}`
        setExpanded(firstKey)
      }
      setLoading(false)
    }
    fetchHistory()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest">Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border p-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft />
        </button>
        <div>
          <h1 className="text-xl font-black italic uppercase tracking-tighter">Battle Log</h1>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{sessions.length} Sessions</p>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto pb-24">
        {/* AI Weekly Debrief */}
        <div className="bg-card/50 rounded-3xl border border-border p-6 shadow-xl">
          <WeeklyDebrief
            weekSessions={sessions.filter(s => {
              const d = new Date(s.date)
              const now = new Date()
              const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay())
              return d >= startOfWeek
            }).length}
            totalVolume={sessions.reduce((sum, s) => sum + s.totalVolume, 0)}
            streak={0}
          />
        </div>
        {sessions.length === 0 ? (
          <div className="text-center py-20 opacity-30">
            <HistoryIcon size={48} className="mx-auto mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">No workouts logged yet.</p>
            <p className="text-xs text-muted-foreground mt-2">Finish your first workout to see it here.</p>
          </div>
        ) : (
          sessions.map((session) => {
            const sessionKey = `${new Date(session.date).toDateString()}__${session.workout_id}`
            const isExpanded = expanded === sessionKey
            const dateLabel = new Date(session.date).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric'
            })

            return (
              <div key={sessionKey} className="bg-card rounded-3xl border border-border overflow-hidden shadow-xl">
                {/* Session Header */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : sessionKey)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-800/50 transition-all"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <Dumbbell size={20} className="text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-black text-base tracking-tight">{session.workout_name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Calendar size={10} /> {dateLabel}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">{session.totalSets} sets</span>
                        {session.totalVolume > 0 && (
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{session.totalVolume.toLocaleString()} lbs</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-muted-foreground flex-shrink-0">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {/* Exercise Breakdown */}
                {isExpanded && (
                  <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
                    {Object.entries(session.exercises).map(([exerciseName, sets]) => {
                      const bestSet = sets.reduce((best, s) =>
                        (s.weight_lbs || 0) > (best.weight_lbs || 0) ? s : best, sets[0])
                      return (
                        <div key={exerciseName}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-black text-sm uppercase tracking-tight">{exerciseName}</p>
                            <span className="text-[10px] font-bold text-muted-foreground">{sets.length} sets</span>
                          </div>
                          <div className="space-y-1.5">
                            {sets.map((s, i) => (
                              <div key={s.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-2">
                                <span className="text-[10px] font-black text-gray-600 uppercase w-8">S{s.set_number}</span>
                                <span className="text-sm font-bold">{s.weight_lbs > 0 ? `${s.weight_lbs} lbs` : 'BW'}</span>
                                <span className="text-sm font-bold text-indigo-400">Ã— {s.reps}</span>
                                {s === bestSet && s.weight_lbs > 0 && (
                                  <span className="text-[10px] font-black text-yellow-500 uppercase">Top</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </main>

      <BottomNav />
    </div>
  )
}

