'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  PlayCircle, 
  Flame, 
  Trophy, 
  Dumbbell, 
  ShieldCheck,
  Settings
} from 'lucide-react'
import BottomNav from '../../components/BottomNav'
import Leaderboard from '../../components/Leaderboard'
import EmpireWidget from '../../components/EmpireWidget'
import DailyQuote from '../../components/DailyQuote'
import MorningProtocol from '../../components/MorningProtocol'
import MindVitals from '../../components/MindVitals'
import SpiritVitals from '../../components/SpiritVitals'
import BodyVitals from '../../components/BodyVitals'

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<any>(null)
  const [stats, setStats] = useState({ streak: 0, totalWorkouts: 0, lastPR: 'None yet' })
  
  // Mind Vitals State
  const [deepWorkMinutes, setDeepWorkMinutes] = useState(0)
  const [completedObjectives, setCompletedObjectives] = useState(0)
  const [totalObjectives, setTotalObjectives] = useState(0)

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      // Load user's active program
      const activeWorkoutId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkoutId') : null
      let workoutData = null
      if (activeWorkoutId) {
        const { data } = await supabase
          .from('workouts')
          .select('*')
          .eq('id', activeWorkoutId)
          .maybeSingle()
        workoutData = data
      }
      
      if (!workoutData) {
        const { data } = await supabase
          .from('workouts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        workoutData = data
        if (workoutData && typeof window !== 'undefined') {
          localStorage.setItem('activeWorkoutId', workoutData.id)
        }
      }
      setWorkout(workoutData)

      // Fetch Stats & Streak
      const { data: logDates } = await supabase
        .from('workout_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('created_at', { ascending: false })

      const uniqueDays = Array.from(
        new Set((logDates || []).map((l: any) => new Date(l.created_at).toDateString()))
      )

      let streak = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      for (let i = 0; i < uniqueDays.length; i++) {
        const dayDate = new Date(uniqueDays[i])
        dayDate.setHours(0, 0, 0, 0)
        const diffDays = Math.round((today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === i || (i === 0 && diffDays <= 1)) {
          streak++
        } else {
          break
        }
      }

      const { data: prData } = await supabase
        .from('workout_logs')
        .select('exercise_name, weight_lbs')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('weight_lbs', { ascending: false })
        .limit(1)
        .maybeSingle()

      setStats({
        streak,
        totalWorkouts: uniqueDays.length,
        lastPR: prData ? `${prData.exercise_name} ${prData.weight_lbs}lbs` : 'None yet'
      })

      // FETCH MIND VITALS
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date()
      endOfToday.setHours(23, 59, 59, 999)

      const { data: deepWorkSessions } = await supabase
        .from('deep_work_sessions')
        .select('duration_minutes')
        .eq('user_id', user.id)
        .gte('created_at', startOfToday.toISOString())
        .lte('created_at', endOfToday.toISOString())
      
      const totalMins = (deepWorkSessions || []).reduce((acc, session) => acc + (session.duration_minutes || 0), 0)
      setDeepWorkMinutes(totalMins)

      const { data: objectivesData } = await supabase
        .from('daily_objectives')
        .select('completed')
        .eq('user_id', user.id)
        .gte('created_at', startOfToday.toISOString())
        .lte('created_at', endOfToday.toISOString())

      if (objectivesData) {
        setTotalObjectives(objectivesData.length)
        setCompletedObjectives(objectivesData.filter(o => o.completed).length)
      }

      setLoading(false)
    }
    loadDashboard()
  }, [router, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-mono text-[10px] uppercase tracking-[0.3em]">Accessing HQ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24 md:pb-8">
      {/* DESKTOP HEADER */}
      <header className="hidden md:flex items-center justify-between border-b border-gray-900 bg-gray-950/80 p-6 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-indigo-500" />
          <div className="font-black text-xl tracking-tighter italic">
            FORGE OS <span className="text-gray-600 font-light">/ DAD STRENGTH</span>
          </div>
        </div>
        <nav className="flex gap-8 font-bold uppercase tracking-widest text-[10px] text-gray-500">
          <button className="text-white border-b-2 border-indigo-500 pb-1">HQ</button>
          <button onClick={() => router.push('/body')} className="hover:text-gray-300">Train</button>
          <button onClick={() => router.push('/history')} className="hover:text-gray-300">History</button>
          <button onClick={() => router.push('/profile')} className="hover:text-gray-300">Profile</button>
          <button onClick={handleSignOut} className="text-red-900/50 hover:text-red-500">Sign Out</button>
        </nav>
      </header>

      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3">
             <span className="font-black text-xs">D</span>
          </div>
          <span className="font-black tracking-tighter text-lg italic uppercase">HQ</span>
        </div>
        <button onClick={() => router.push('/profile')} className="p-2 bg-gray-900 rounded-lg text-gray-500">
          <Settings size={20} />
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Empire + Vitals */}
        <div className="lg:col-span-3 space-y-8 order-3 lg:order-1">
          <EmpireWidget />
          <BodyVitals />
          <MindVitals 
            deepWorkMinutes={deepWorkMinutes}
            completedObjectives={completedObjectives}
            totalObjectives={totalObjectives}
          />
          <SpiritVitals />
        </div>

        {/* CENTER COLUMN: Tactical Action + Leaderboard */}
        <div className="lg:col-span-6 space-y-8 order-2 lg:order-2">
          {/* ACTIVE WORKOUT CARD */}
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 shadow-2xl shadow-indigo-500/20 ring-1 ring-white/10 group">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 h-32 w-32 rounded-full bg-white opacity-10 blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
            
            <div className="flex items-start justify-between relative z-10 mb-8">
              <div>
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-white uppercase tracking-widest mb-4 backdrop-blur-sm border border-white/5">
                  Protocol Active
                </span>
                <h2 className="text-3xl font-black text-white leading-tight uppercase tracking-tighter italic">
                  {workout?.name || 'Load Program'}
                </h2>
                <p className="text-indigo-100/70 text-sm mt-2 font-medium max-w-[200px]">
                  {workout?.description || 'Access the training library to deploy your first protocol.'}
                </p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10 rotate-6 shadow-xl">
                <Dumbbell className="text-white" size={28} />
              </div>
            </div>

            <div className="flex flex-col gap-3 relative z-10">
              <button 
                onClick={() => workout ? router.push(`/workout/${workout.id}`) : router.push('/body')}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-5 text-sm font-black text-indigo-950 hover:bg-indigo-50 transition-all active:scale-95 shadow-2xl uppercase tracking-tighter"
              >
                <PlayCircle size={22} />
                {workout ? 'Deploy Training' : 'Go to Body'}
              </button>
              
              <button 
                onClick={() => router.push('/edit-program')}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 px-6 py-3 text-[10px] font-black text-white hover:bg-indigo-500/30 transition-all uppercase tracking-widest"
              >
                <Settings size={14} />
                Change Program
              </button>
            </div>
          </div>

          {/* QUICK STATS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-3xl bg-gray-900 p-6 border border-gray-800 hover:border-gray-700 transition-all">
              <div className="flex items-center gap-2 mb-2 text-orange-500">
                <Flame size={16} />
                <p className="text-[10px] uppercase font-black tracking-[0.2em]">Streak</p>
              </div>
              <p className="text-3xl font-black">{stats.streak} Days</p>
            </div>
            <div className="rounded-3xl bg-gray-900 p-6 border border-gray-800 hover:border-gray-700 transition-all">
              <div className="flex items-center gap-2 mb-2 text-indigo-400">
                <Trophy size={16} />
                <p className="text-[10px] uppercase font-black tracking-[0.2em]">Biggest Lift</p>
              </div>
              <p className="text-lg font-black truncate">{stats.lastPR}</p>
            </div>
          </div>

          <Leaderboard />
        </div>

        {/* RIGHT COLUMN: Protocol + Quote */}
        <div className="lg:col-span-3 space-y-8 order-1 lg:order-3">
          <MorningProtocol />
          <DailyQuote />
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
