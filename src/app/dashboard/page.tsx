'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlayCircle, Calendar, ArrowRight, User, Flame, Trophy, Dumbbell } from 'lucide-react'
import BottomNav from '../../components/BottomNav'
import Leaderboard from './Leaderboard'

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<any>(null)
  const [stats, setStats] = useState({ streak: 0, totalWorkouts: 0, lastPR: 'None yet' })

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      const { data: workoutData } = await supabase
        .from('workouts')
        .select('*')
        .limit(1)
        .maybeSingle()
      
      setWorkout(workoutData)

      const { count } = await supabase
        .from('workout_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      
      const { data: prData } = await supabase
        .from('workout_logs')
        .select('exercise_name, weight_lbs')
        .eq('user_id', user.id)
        .order('weight_lbs', { ascending: false })
        .limit(1)
        .single()

      setStats({
        streak: Math.floor((count || 0) / 3),
        totalWorkouts: count || 0,
        lastPR: prData ? `${prData.exercise_name} ${prData.weight_lbs}lbs` : 'None yet'
      })

      setLoading(false)
    }
    loadDashboard()
  }, [router, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const loadSampleWorkout = async () => {
    setLoading(true);
    const sampleWorkout = {
      name: 'Dad Bod Demolisher (Sample)',
      description: 'A 30-minute full-body circuit designed for dads short on time.',
      exercises: [
        { name: "Back Squat", sets: 3, reps: "8-10" },
        { name: "Push-ups", sets: 3, reps: "AMRAP" },
        { name: "Pull-ups", sets: 3, reps: "AMRAP" },
        { name: "Plank", sets: 3, reps: "60s" }
      ]
    };
    
    await supabase.from('workouts').insert(sampleWorkout);
    
    // Reload dashboard data
    const { data: newWorkout } = await supabase.from('workouts').select('*').limit(1).maybeSingle();
    setWorkout(newWorkout);
    setLoading(false);
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-950 text-white font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Accessing Mission Control...</p>
      </div>
    </div>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 p-4 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold">D</div>
          <span className="font-bold tracking-tight text-lg">DadStrength</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleSignOut}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors uppercase font-bold tracking-wider"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="mx-auto max-w-md p-6 pb-24 space-y-8">
        
        {/* WELCOME */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Welcome, Dad.</h1>
          <p className="text-gray-500 text-sm font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* TODAY'S WORKOUT CARD */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 shadow-2xl shadow-indigo-500/20 ring-1 ring-white/20">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 h-32 w-32 rounded-full bg-white opacity-10 blur-3xl"></div>
          
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-widest mb-4 backdrop-blur-sm">
                Next Session
              </span>
              <h2 className="text-2xl font-black text-white leading-tight uppercase">
                {workout?.name || 'No Programs'}
              </h2>
              <p className="text-indigo-100/80 text-sm mt-2 font-medium">
                {workout?.description || 'Build your first workout routine to get started.'}
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
              <Dumbbell className="text-white" size={24} />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4 relative z-10">
            {workout ? (
              <button 
                onClick={() => router.push(`/workout/${workout.id}`)}
                className="flex-1 flex items-center justify-center gap-3 rounded-xl bg-white px-6 py-4 text-sm font-black text-indigo-900 hover:bg-indigo-50 transition-all active:scale-95 shadow-xl"
              >
                <PlayCircle size={20} />
                START TRAINING
              </button>
            ) : (
              <button 
                onClick={loadSampleWorkout}
                className="flex-1 flex items-center justify-center gap-3 rounded-xl bg-white px-6 py-4 text-sm font-black text-indigo-900 hover:bg-indigo-50 transition-all active:scale-95 shadow-xl"
              >
                <PlayCircle size={20} />
                GENERATE SAMPLE
              </button>
            )}
          </div>
        </div>

        {/* STATS / PROGRESS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-gray-900 p-5 border border-gray-800 hover:border-gray-700 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-orange-500">
               <Flame size={14} />
               <p className="text-[10px] uppercase font-black tracking-widest">Streak</p>
            </div>
            <p className="text-2xl font-bold">{stats.streak} Days</p>
          </div>
          <div className="rounded-2xl bg-gray-900 p-5 border border-gray-800 hover:border-gray-700 transition-colors">
             <div className="flex items-center gap-2 mb-2 text-indigo-400">
                <Trophy size={14} />
                <p className="text-[10px] uppercase font-black tracking-widest">Biggest Lift</p>
             </div>
             <p className="text-lg font-bold truncate">{stats.lastPR}</p>
          </div>
        </div>

        <Leaderboard />

        {/* RECENT ACTIVITY / BUTTONS */}
        <div className="space-y-3">
           <button 
            onClick={() => router.push('/edit-program')}
            className="w-full flex items-center justify-between p-5 rounded-2xl bg-gray-900 border border-gray-800 hover:bg-gray-800/50 transition-all group mb-3"
           >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-gray-800 flex items-center justify-center group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                  <Dumbbell size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Edit Program</p>
                  <p className="text-xs text-gray-500">Customize your routine</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-gray-600 group-hover:text-white transition-colors" />
           </button>
           <button 
            onClick={() => router.push('/history')}
            className="w-full flex items-center justify-between p-5 rounded-2xl bg-gray-900 border border-gray-800 hover:bg-gray-800/50 transition-all group"
           >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-gray-800 flex items-center justify-center group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                  <Calendar size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Workout History</p>
                  <p className="text-xs text-gray-500">View your past progress</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-gray-600 group-hover:text-white transition-colors" />
           </button>
        </div>

      </main>

      {/* BOTTOM NAV (MOBILE) */}
      <BottomNav />
    </div>
  )
}