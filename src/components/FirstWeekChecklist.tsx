'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, X, Dumbbell, Target, Sun, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

const SKOOL_URL = process.env.NEXT_PUBLIC_SKOOL_URL || 'https://www.skool.com'

interface ChecklistItem {
  key: string
  label: string
  description: string
  cta: string
  href?: string
  icon: React.ElementType
}

const ITEMS: ChecklistItem[] = [
  {
    key: 'first_workout',
    label: 'Complete your first workout',
    description: 'Deploy your program and log your first session.',
    cta: 'Start Training',
    href: undefined, // handled by button
    icon: Dumbbell,
  },
  {
    key: 'set_mission',
    label: 'Set your #1 mission',
    description: 'What are you building toward? Takes 60 seconds.',
    cta: 'Set Mission',
    href: '/profile/mission',
    icon: Target,
  },
  {
    key: 'morning_protocol',
    label: 'Run your morning protocol',
    description: 'Start the day with intention. Just once.',
    cta: 'Open Protocol',
    href: '/mind',
    icon: Sun,
  },
  {
    key: 'joined_brotherhood',
    label: 'Join the Brotherhood',
    description: 'Connect with dads in the Skool community.',
    cta: 'Join Now',
    href: SKOOL_URL,
    icon: Users,
  },
]

interface ChecklistState {
  first_workout: boolean
  set_mission: boolean
  morning_protocol: boolean
  joined_brotherhood: boolean
  dismissed: boolean
  dismissed_at: string | null
}

const DEFAULT_STATE: ChecklistState = {
  first_workout: false,
  set_mission: false,
  morning_protocol: false,
  joined_brotherhood: false,
  dismissed: false,
  dismissed_at: null,
}

export default function FirstWeekChecklist() {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<ChecklistState>(DEFAULT_STATE)
  const [visible, setVisible] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_week_checklist, created_at')
        .eq('id', user.id)
        .maybeSingle()

      const checklist = profile?.first_week_checklist as ChecklistState | null

      if (!checklist) {
        setVisible(true)
        return
      }

      // Dismissed after 7 days — permanently hide
      if (checklist.dismissed && checklist.dismissed_at) {
        const dismissedAt = new Date(checklist.dismissed_at)
        const daysSince = (Date.now() - dismissedAt.getTime()) / 86400000
        if (daysSince >= 7) { setVisible(false); return }
      }

      if (checklist.dismissed) { setVisible(false); return }

      // All done — auto-hide
      const allDone = checklist.first_workout && checklist.set_mission && checklist.morning_protocol && checklist.joined_brotherhood
      if (allDone) { setVisible(false); return }

      setState(checklist)
      setVisible(true)
    }
    load()
  }, [])

  // Auto-check first_workout if they've logged a session
  useEffect(() => {
    if (!userId || state.first_workout) return
    const check = async () => {
      const { data } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('completed', true)
        .limit(1)
        .maybeSingle()
      if (data) updateItem('first_workout', true)
    }
    check()
  }, [userId])

  const updateItem = async (key: keyof ChecklistState, value: boolean) => {
    const newState = { ...state, [key]: value }
    setState(newState)
    if (!userId) return
    await supabase.from('user_profiles').update({ first_week_checklist: newState }).eq('id', userId)

    // Hide if all items complete
    const allDone = newState.first_workout && newState.set_mission && newState.morning_protocol && newState.joined_brotherhood
    if (allDone) {
      setTimeout(() => setVisible(false), 1200)
    }
  }

  const dismiss = async () => {
    const newState = { ...state, dismissed: true, dismissed_at: new Date().toISOString() }
    setState(newState)
    setVisible(false)
    if (!userId) return
    await supabase.from('user_profiles').update({ first_week_checklist: newState }).eq('id', userId)
  }

  const handleCTA = (item: ChecklistItem) => {
    if (item.key === 'first_workout') {
      const activeWorkoutId = localStorage.getItem('activeWorkoutId')
      const activeProgram = localStorage.getItem('dad-strength-active-program')
      if (activeProgram) router.push('/workout/program/1')
      else if (activeWorkoutId) router.push(`/workout/${activeWorkoutId}`)
      return
    }
    if (item.href) {
      if (item.href.startsWith('http')) window.open(item.href, '_blank')
      else router.push(item.href)
    }
    // Mark as visited (not completed — completion is verified)
    if (item.key !== 'first_workout') {
      updateItem(item.key as keyof ChecklistState, true)
    }
  }

  const doneCount = [state.first_workout, state.set_mission, state.morning_protocol, state.joined_brotherhood].filter(Boolean).length

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="rounded-xl border border-brand/30 bg-brand/5 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-brand/10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-brand font-medium font-display">Getting Started</p>
            <h3 className="font-display text-xl tracking-[0.08em] uppercase mt-0.5">Your First Week</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground font-medium">{doneCount}/4</span>
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-brand/10">
          <motion.div
            className="h-full bg-brand"
            initial={{ width: 0 }}
            animate={{ width: `${(doneCount / 4) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Items */}
        <div className="divide-y divide-border/40">
          {ITEMS.map((item) => {
            const Icon = item.icon
            const done = state[item.key as keyof ChecklistState] as boolean
            return (
              <div key={item.key} className={`flex items-center gap-4 px-5 py-3.5 ${done ? 'opacity-50' : ''}`}>
                <div className={`p-1.5 rounded-lg shrink-0 ${done ? 'bg-brand/10' : 'bg-muted'}`}>
                  {done
                    ? <CheckCircle2 size={14} className="text-brand" />
                    : <Icon size={14} className="text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.label}</p>
                  {!done && <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>}
                </div>
                {!done && (
                  <button
                    onClick={() => handleCTA(item)}
                    className="text-[10px] font-black uppercase tracking-widest text-brand hover:text-brand/70 transition-colors shrink-0"
                  >
                    {item.cta} →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
