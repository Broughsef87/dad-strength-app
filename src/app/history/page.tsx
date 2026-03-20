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

const PAGE_SIZE = 50

function buildSessions(logs: LogEntry[], workoutNames: Record<string, string>): SessionGroup[] {
  const sessionMap: Record<string, SessionGroup> = {}
  for (const log of logs) {
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
  return Object.values(sessionMap).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

export default function History() {
  const supabase = createClient()
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [allLogs, setAllLogs] = useState<LogEntry[]>([])
  const [workoutNames, setWorkoutNames] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUserId(user.id)

      const { data, error } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (error) {
        console.error('Error fetching history:', error)
        setLoading(false)
        return
      }

      const logs = data || []
      setHasMore(logs.length === PAGE_SIZE)
      setOffset(logs.length)
      setAllLogs(logs)

      const wIds = Array.from(new Set(logs.map((l: LogEntry) => l.workout_id).filter(Boolean)))
      let names: Record<string, string> = {}
      if (wIds.length > 0) {
        const { data: workouts } = await supabase
          .from('workouts')
          .select('id, name')
          .in('id', wIds)
        ;(workouts || []).forEach((w: any) => { names[w.id] = w.name })
      }
      setWorkoutNames(names)

      const sorted = buildSessions(logs, names)
      setSessions(sorted)

      if (sorted.length > 0) {
        const firstKey = `${new Date(sorted[0].date).toDateString()}__${sorted[0].workout_id}`
        setExpanded(firstKey)
      }
      setLoading(false)
    }
    fetchHistory()
  }, [router, supabase])

  const loadMore = async () => {
    if (!userId || loadingMore) return
    setLoadingMore(true)

    const { data, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('Error loading more:', error)
      setLoadingMore(false)
      return
    }

    const newLogs = data || []
    setHasMore(newLogs.length === PAGE_SIZE)
    setOffset(prev => prev + newLogs.length)

    const combined = [...allLogs, ...newLogs]
    setAllLogs(combined)

    // Fetch workout names for any new workout IDs
    const existingIds = new Set(Object.keys(workoutNames))
    const newIds = Array.from(new Set(newLogs.map((l: LogEntry) => l.workout_id).filter(Boolean))).filter(id => !existingIds.has(id as string))
    let updatedNames = { ...workoutNames }
    if (newIds.length > 0) {
      const { data: workouts } = await supabase
        .from('workouts')
        .select('id, name')
        .in('id', newIds)
      ;(workouts || []).forEach((w: any) => { updatedNames[w.id] = w.name })
      setWorkoutNames(updatedNames)
    }

    setSessions(buildSessions(combined, updatedNames))
    setLoadingMore(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Loading history...</p>
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
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">{sessions.length} Sessions</p>
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
          <>
            {sessions.map((session) => {
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
                    className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-all"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="h-12 w-12 rounded-2xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                        <Dumbbell size={20} className="text-brand" />
                      </div>
                      <div>
                        <p className="font-black text-base tracking-tight">{session.workout_name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                            <Calendar size={10} /> {dateLabel}
                          </span>
                          <span className="text-xs font-bold text-brand uppercase">{session.totalSets} sets</span>
                          {session.totalVolume > 0 && (
                            <span className="text-xs font-bold text-muted-foreground uppercase">{session.totalVolume.toLocaleString()} lbs</span>
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
                              <span className="text-xs font-bold text-muted-foreground">{sets.length} sets</span>
                            </div>
                            <div className="space-y-1.5">
                              {sets.map((s, i) => (
                                <div key={s.id} className="flex items-center justify-between bg-muted rounded-xl px-4 py-2">
                                  <span className="text-xs font-black text-muted-foreground uppercase w-8">S{s.set_number}</span>
                                  <span className="text-sm font-bold">{s.weight_lbs > 0 ? `${s.weight_lbs} lbs` : 'BW'}</span>
                                  <span className="text-sm font-bold text-brand">× {s.reps}</span>
                                  {s === bestSet && s.weight_lbs > 0 && (
                                    <span className="text-xs font-black text-yellow-500 uppercase">Top</span>
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
            })}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
