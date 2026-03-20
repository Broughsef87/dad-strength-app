'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dumbbell, Home as HomeIcon, LayoutPanelLeft, LayoutPanelTop,
  Layout, Zap, ChevronRight, Loader2, ShieldCheck, Baby
} from 'lucide-react'
import { createClient } from '../../utils/supabase/client'

// â”€â”€â”€ Same exercise library as edit-program â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EXERCISE_SETS: Record<string, Record<string, { name: string; sets: number; reps: string }[]>> = {
  full: {
    iron: [
      { name: 'Barbell Back Squat', sets: 4, reps: '6-8' },
      { name: 'Bench Press', sets: 4, reps: '6-8' },
      { name: 'Deadlift', sets: 3, reps: '5' },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
      { name: 'Barbell Row', sets: 4, reps: '8-10' },
      { name: 'Dips', sets: 3, reps: '10-12' },
    ],
    home: [
      { name: 'Goblet Squat', sets: 4, reps: '10-12' },
      { name: 'Push-ups', sets: 4, reps: '15-20' },
      { name: 'Romanian Deadlift', sets: 3, reps: '10-12' },
      { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10-12' },
      { name: 'Dumbbell Row', sets: 4, reps: '10-12' },
      { name: 'Tricep Dips', sets: 3, reps: '12-15' },
    ],
  },
  upper: {
    iron: [
      { name: 'Bench Press', sets: 4, reps: '6-8' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12' },
      { name: 'Pull-ups', sets: 4, reps: '6-8' },
      { name: 'Barbell Row', sets: 4, reps: '8-10' },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
      { name: 'Face Pulls', sets: 3, reps: '15' },
    ],
    home: [
      { name: 'Push-ups', sets: 4, reps: '20' },
      { name: 'Pike Push-ups', sets: 3, reps: '12-15' },
      { name: 'Dumbbell Row', sets: 4, reps: '10-12' },
      { name: 'Dumbbell Curl', sets: 3, reps: '12-15' },
      { name: 'Tricep Dips', sets: 3, reps: '12-15' },
      { name: 'Band Pull-Apart', sets: 3, reps: '20' },
    ],
  },
  lower: {
    iron: [
      { name: 'Back Squat', sets: 4, reps: '6-8' },
      { name: 'Romanian Deadlift', sets: 4, reps: '8-10' },
      { name: 'Leg Press', sets: 3, reps: '10-12' },
      { name: 'Leg Curl', sets: 3, reps: '12-15' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '10 each' },
      { name: 'Calf Raise', sets: 4, reps: '15-20' },
    ],
    home: [
      { name: 'Goblet Squat', sets: 4, reps: '12-15' },
      { name: 'Romanian Deadlift', sets: 4, reps: '10-12' },
      { name: 'Reverse Lunge', sets: 3, reps: '12 each' },
      { name: 'Nordic Curl', sets: 3, reps: '8-10' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '10 each' },
      { name: 'Calf Raise', sets: 4, reps: '20' },
    ],
  },
  cond: {
    iron: [
      { name: 'Barbell Thruster', sets: 4, reps: '10' },
      { name: 'Kettlebell Swing', sets: 4, reps: '15' },
      { name: 'Box Jump', sets: 3, reps: '10' },
      { name: 'Farmer Carry', sets: 3, reps: '30m' },
      { name: 'Sled Push', sets: 3, reps: '20m' },
    ],
    home: [
      { name: 'Burpees', sets: 4, reps: '10' },
      { name: 'Jump Squat', sets: 4, reps: '15' },
      { name: 'Mountain Climbers', sets: 3, reps: '30s' },
      { name: 'High Knees', sets: 3, reps: '30s' },
      { name: 'Plank', sets: 3, reps: '45s' },
    ],
  },
}

const FOCUSES = [
  { id: 'full', name: 'Full Body', icon: Layout, desc: 'Best for 3 days/week. Hit everything.' },
  { id: 'upper', name: 'Upper Body', icon: LayoutPanelTop, desc: 'Chest, back, shoulders, arms.' },
  { id: 'lower', name: 'Lower Body', icon: LayoutPanelLeft, desc: 'Legs, glutes, posterior chain.' },
  { id: 'cond', name: 'Conditioning', icon: Zap, desc: 'Fat loss, work capacity, cardio strength.' },
]

const TRACKS = [
  { id: 'iron', name: 'Iron Path', icon: Dumbbell, desc: 'Full gym — barbells, racks, machines.' },
  { id: 'home', name: 'At Home', icon: HomeIcon, desc: 'Dumbbells, bands, or bodyweight only.' },
]

const FREQUENCY_DAYS = [3, 5]
const FOCUS_LABELS: Record<string, string> = { upper: 'Upper Body', lower: 'Lower Body', full: 'Full Body', cond: 'Conditioning' }
const TRACK_LABELS: Record<string, string> = { iron: 'Iron Path', home: 'At Home' }

type Step = 'welcome' | 'focus' | 'track' | 'frequency' | 'confirm'

export default function Onboarding() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('welcome')
  const [focus, setFocus] = useState('full')
  const [track, setTrack] = useState('iron')
  const [frequency, setFrequency] = useState(3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('onboarding_complete')
            .eq('id', user.id)
            .single()

          if (profile?.onboarding_complete) {
            router.push('/dashboard')
            return
          }
        }
      } catch (err) {
        console.error('Error checking onboarding status:', err)
      } finally {
        setLoading(false)
      }
    }
    checkOnboarding()
  }, [router, supabase])

  const handleFinish = async () => {
    setSaving(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const exercises = EXERCISE_SETS[focus][track]
      const { data: newWorkout, error: insertError } = await supabase
        .from('workouts')
        .insert({
          name: `${FOCUS_LABELS[focus]} · ${TRACK_LABELS[track]}`,
          description: `${frequency} days/week · Your first protocol`,
          exercises,
          status: 'active',
          user_id: user.id,
        })
        .select()
        .single()

      if (insertError) throw insertError

      const activeProgramConfig = { focus, track, frequency }

      // Sync to Supabase profile
      await supabase.from('user_profiles').upsert({
        id: user.id,
        onboarding_complete: true,
        active_program_config: activeProgramConfig
      }, { onConflict: 'id' })

      localStorage.setItem('activeWorkoutId', newWorkout.id)
      localStorage.setItem('onboardingComplete', 'true')
      localStorage.setItem('activeProgramConfig', JSON.stringify(activeProgramConfig))

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Try again.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">

      {/* Progress bar */}
      {step !== 'welcome' && (
        <div className="w-full h-1 bg-card">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${({ focus: 25, track: 50, frequency: 75, confirm: 100 } as Record<string, number>)[step]}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">

        {/* â”€â”€ WELCOME â”€â”€ */}
        {step === 'welcome' && (
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative inline-flex">
              <div className="h-24 w-24 rounded-[2rem] bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 rotate-3">
                <span className="text-5xl font-black">D</span>
              </div>
              <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-card border-2 border-border flex items-center justify-center">
                <Baby size={16} className="text-indigo-400" />
              </div>
            </div>

            <div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-3 leading-none">
                Welcome to<br />Dad Strength.
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed max-w-sm mx-auto">
                The operating system for modern fatherhood. Strong body. Clear mind. Present dad.
              </p>
            </div>

            <div className="space-y-3 text-left bg-card/50 rounded-3xl p-6 border border-border w-full">
              {[
                { icon: '💪', text: 'Training protocols built for your life' },
                { icon: '🧠', text: 'Mind tools: deep work, journaling, goals' },
                { icon: '🙏', text: 'Spirit: prayer, meditation, relationships' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-medium text-gray-300">
                  <span className="text-xl">{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('focus')}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-foreground font-black py-5 rounded-2xl text-base uppercase tracking-widest transition-all active:scale-95 shadow-2xl shadow-indigo-500/20"
            >
              Let's Build Your Protocol <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* â”€â”€ FOCUS â”€â”€ */}
        {step === 'focus' && (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Step 1 of 3</p>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter">What's your focus?</h2>
              <p className="text-muted-foreground text-sm mt-1">Pick the area you want to prioritize.</p>
            </div>
            <div className="space-y-3">
              {FOCUSES.map((f) => {
                const Icon = f.icon
                const isSelected = focus === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => setFocus(f.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                      isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card/40 hover:border-gray-700'
                    }`}
                  >
                    <div className={`p-3 rounded-xl flex-shrink-0 ${isSelected ? 'bg-indigo-500 text-foreground' : 'bg-gray-800 text-muted-foreground'}`}>
                      <Icon size={22} />
                    </div>
                    <div>
                      <p className={`font-black uppercase italic tracking-tight ${isSelected ? 'text-indigo-300' : 'text-gray-200'}`}>{f.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{f.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setStep('track')}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-foreground font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95"
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* â”€â”€ TRACK â”€â”€ */}
        {step === 'track' && (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Step 2 of 3</p>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter">Where do you train?</h2>
              <p className="text-muted-foreground text-sm mt-1">This sets your equipment and exercise selection.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {TRACKS.map((t) => {
                const Icon = t.icon
                const isSelected = track === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTrack(t.id)}
                    className={`w-full flex items-center gap-5 p-6 rounded-3xl border-2 text-left transition-all ${
                      isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card/40 hover:border-gray-700'
                    }`}
                  >
                    <div className={`p-4 rounded-2xl flex-shrink-0 ${isSelected ? 'bg-indigo-500 text-foreground' : 'bg-gray-800 text-muted-foreground'}`}>
                      <Icon size={28} />
                    </div>
                    <div>
                      <p className={`font-black text-xl uppercase italic tracking-tight ${isSelected ? 'text-indigo-300' : 'text-gray-200'}`}>{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-medium">{t.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('focus')} className="flex-1 py-4 rounded-2xl border border-border text-muted-foreground font-black text-xs uppercase tracking-widest hover:border-gray-700 transition-all">
                Back
              </button>
              <button
                onClick={() => setStep('frequency')}
                className="flex-[2] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-foreground font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95"
              >
                Next <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ FREQUENCY â”€â”€ */}
        {step === 'frequency' && (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Step 3 of 3</p>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter">How many days<br />per week?</h2>
              <p className="text-muted-foreground text-sm mt-1">Be realistic. Consistency beats perfection.</p>
            </div>
            <div className="space-y-4">
              {FREQUENCY_DAYS.map((days) => (
                <button
                  key={days}
                  onClick={() => setFrequency(days)}
                  className={`w-full p-6 rounded-3xl border-2 text-left transition-all ${
                    frequency === days ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card/40 hover:border-gray-700'
                  }`}
                >
                  <p className={`font-black text-2xl italic uppercase tracking-tight ${frequency === days ? 'text-indigo-300' : 'text-gray-200'}`}>
                    {days} Days / Week
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {days === 3 ? 'Mon / Wed / Fri — the dad-proof schedule.' : 'Mon / Tue / Thu / Fri / Sat — for the serious forge.'}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('track')} className="flex-1 py-4 rounded-2xl border border-border text-muted-foreground font-black text-xs uppercase tracking-widest hover:border-gray-700 transition-all">
                Back
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="flex-[2] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-foreground font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95"
              >
                Preview <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ CONFIRM â”€â”€ */}
        {step === 'confirm' && (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Your Protocol</p>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">
                {FOCUS_LABELS[focus]}<br />
                <span className="text-indigo-400">{TRACK_LABELS[track]}</span>
              </h2>
              <p className="text-muted-foreground text-sm mt-2">{frequency} days/week · Deploy anytime.</p>
            </div>

            <div className="bg-card/50 rounded-3xl border border-border p-5 space-y-3">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Exercises</p>
              {EXERCISE_SETS[focus][track].map((ex, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-bold text-gray-200">{ex.name}</span>
                  <span className="font-black text-brand">{ex.sets}×{ex.reps}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-4 text-xs font-bold text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={saving}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-foreground font-black py-5 rounded-2xl text-base uppercase tracking-widest transition-all active:scale-95 shadow-2xl shadow-indigo-500/20"
            >
              {saving
                ? <><Loader2 size={18} className="animate-spin" /> Building Protocol...</>
                : <><ShieldCheck size={18} /> Deploy Protocol</>
              }
            </button>

            <button onClick={() => setStep('frequency')} className="w-full text-center text-xs text-gray-600 font-bold uppercase tracking-widest hover:text-muted-foreground transition-colors">
              â† Go Back
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

