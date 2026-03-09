'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, ChevronLeft, Dumbbell, History as HistoryIcon } from 'lucide-react'
import BottomNav from '../../components/BottomNav'

export default function History() {
  const supabase = createClient()
  const router = useRouter()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Fetch logs, group them by date/workout
      const { data, error } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching history:', error)
      } else {
        // Simple grouping logic for display
        // In a real app, we'd group by a workout_instance_id
        setLogs(data || [])
      }
      setLoading(false)
    }
    fetchHistory()
  }, [router, supabase])

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white font-sans">Loading History...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 p-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft />
        </button>
        <h1 className="text-xl font-bold tracking-tight">Workout History</h1>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto">
        {logs.length === 0 ? (
          <div className="text-center py-20 opacity-30">
            <HistoryIcon size={48} className="mx-auto mb-4" />
            <p className="text-sm font-medium">No workouts logged yet.</p>
          </div>
        ) : (
          logs.map((log: any) => (
            <div key={log.id} className="bg-gray-900 rounded-2xl p-5 border border-gray-800 flex justify-between items-center group hover:border-gray-700 transition-all">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Dumbbell size={14} className="text-indigo-500" />
                  <p className="font-bold text-sm">{log.exercise_name}</p>
                </div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {log.weight_lbs} lbs x {log.reps}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                <ChevronLeft className="rotate-180" size={16} />
              </div>
            </div>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  )
}
