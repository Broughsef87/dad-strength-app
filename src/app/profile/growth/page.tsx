'use client'

import { createClient } from '../../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, BookOpen, Target, Flame, CheckCircle2, Circle, Edit2 } from 'lucide-react'

type Habit = { name: string; done: boolean }
type BookData = { title: string; author: string; currentChapter: number; totalChapters: number }
type GrowthProfile = {
  habits: Habit[]
  book: BookData
}
type GrowthState = {
  date: string
  habits: boolean[]
  familyGoal: string
  familyGoalDone: boolean
}

const DEFAULT_HABITS: Habit[] = [
  { name: 'No Screens After 9PM', done: false },
  { name: 'Read 10 Pages', done: false },
  { name: 'Cold Shower (2 Min)', done: false },
]

const DEFAULT_BOOK: BookData = { title: '', author: '', currentChapter: 0, totalChapters: 0 }

function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl p-6 border border-border animate-pulse space-y-3">
      <div className="h-4 bg-muted rounded w-1/3" />
      <div className="h-3 bg-muted rounded w-2/3" />
      <div className="h-3 bg-muted rounded w-1/2" />
    </div>
  )
}

export default function PersonalGrowth() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)

  // Profile-level data (persisted to user_profiles.growth_data)
  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS)
  const [book, setBook] = useState<BookData>(DEFAULT_BOOK)
  const [editingHabit, setEditingHabit] = useState<number | null>(null)

  // Daily state (persisted to daily_checkins.growth_state)
  const [habitsDone, setHabitsDone] = useState<boolean[]>([false, false, false])
  const [familyGoal, setFamilyGoal] = useState('')
  const [familyGoalDone, setFamilyGoalDone] = useState(false)

  // Habit streaks from checkins history
  const [habitStreaks, setHabitStreaks] = useState<number[]>([0, 0, 0])

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    setMounted(true)
    loadData()
  }, [])

  const loadData = async () => {
    // Try localStorage first
    const savedProfile = typeof window !== 'undefined' ? localStorage.getItem('dad-strength-growth-profile') : null
    if (savedProfile) {
      const p = JSON.parse(savedProfile)
      if (p.habits) setHabits(p.habits)
      if (p.book) setBook(p.book)
    }

    const savedState = typeof window !== 'undefined' ? localStorage.getItem('dad-strength-growth-state') : null
    if (savedState) {
      const s: GrowthState = JSON.parse(savedState)
      if (s.date === new Date().toLocaleDateString()) {
        setHabitsDone(s.habits || [false, false, false])
        setFamilyGoal(s.familyGoal || '')
        setFamilyGoalDone(s.familyGoalDone || false)
      }
    }

    // Supabase
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Load profile data
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('growth_data')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.growth_data) {
      const gd = profile.growth_data as { habits?: Habit[]; book?: BookData }
      if (gd.habits) setHabits(gd.habits)
      if (gd.book) setBook(gd.book)
    }

    // Load today's checkin
    const { data: checkin } = await supabase
      .from('daily_checkins')
      .select('growth_state')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    if (checkin?.growth_state) {
      const gs = checkin.growth_state as GrowthState
      setHabitsDone(gs.habits || [false, false, false])
      setFamilyGoal(gs.familyGoal || '')
      setFamilyGoalDone(gs.familyGoalDone || false)
    }

    // Load habit streaks from recent history
    const { data: recentCheckins } = await supabase
      .from('daily_checkins')
      .select('date, growth_state')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(30)

    if (recentCheckins && recentCheckins.length > 0) {
      const streaks = [0, 1, 2].map(habitIdx => {
        let streak = 0
        const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
        for (let i = 0; i < recentCheckins.length; i++) {
          const c = recentCheckins[i]
          const gs = c.growth_state as GrowthState | null
          if (!gs?.habits) break
          const done = gs.habits[habitIdx] === true
          if (!done) break
          streak++
        }
        return streak
      })
      setHabitStreaks(streaks)
    }

    setLoading(false)
  }

  const saveGrowthState = (overrides: Partial<GrowthState> = {}) => {
    const state: GrowthState = {
      date: new Date().toLocaleDateString(),
      habits: habitsDone,
      familyGoal,
      familyGoalDone,
      ...overrides,
    }
    localStorage.setItem('dad-strength-growth-state', JSON.stringify(state))
    supabase.auth.getUser().then((r: any) => {
      const user = r.data.user
      if (!user) return
      supabase.from('daily_checkins').upsert(
        { user_id: user.id, date: today, growth_state: state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      ).then(() => {})
    })
  }

  const saveGrowthProfile = (habitsData: Habit[], bookData: BookData) => {
    const profile = { habits: habitsData, book: bookData }
    localStorage.setItem('dad-strength-growth-profile', JSON.stringify(profile))
    supabase.auth.getUser().then((r: any) => {
      const user = r.data.user
      if (!user) return
      supabase.from('user_profiles').upsert(
        { id: user.id, growth_data: profile },
        { onConflict: 'id' }
      ).then(() => {})
    })
  }

  const toggleHabit = (idx: number) => {
    const next = [...habitsDone]
    next[idx] = !next[idx]
    setHabitsDone(next)
    saveGrowthState({ habits: next })
  }

  const updateHabitName = (idx: number, name: string) => {
    const next = habits.map((h, i) => i === idx ? { ...h, name } : h)
    setHabits(next)
    saveGrowthProfile(next, book)
  }

  const updateBook = (field: keyof BookData, value: string | number) => {
    const next = { ...book, [field]: value }
    setBook(next)
    saveGrowthProfile(habits, next)
  }

  const bookProgress = book.totalChapters > 0
    ? Math.min(Math.round((book.currentChapter / book.totalChapters) * 100), 100)
    : 0

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans pb-24">
        <header className="flex items-center gap-4 border-b border-border bg-surface-2 p-6 sticky top-0 z-10">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-black italic uppercase">Personal Growth</h1>
        </header>
        <main className="max-w-md mx-auto p-6 space-y-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-24">
      <header className="flex items-center gap-4 border-b border-border bg-surface-2 p-6 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black italic uppercase">Personal Growth</h1>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6">

        {/* Habits */}
        <div className="bg-card rounded-xl p-6 border border-border space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-brand" />
            <h3 className="font-medium text-sm">Daily Discipline</h3>
          </div>

          <div className="space-y-3">
            {habits.map((habit, idx) => (
              <div key={idx} className="flex items-center gap-3 group">
                <button onClick={() => toggleHabit(idx)} className="flex-shrink-0 transition-all">
                  {habitsDone[idx]
                    ? <CheckCircle2 size={18} className="text-brand" />
                    : <Circle size={18} className="text-border hover:text-muted-foreground" />
                  }
                </button>

                {editingHabit === idx ? (
                  <input
                    type="text"
                    value={habit.name}
                    autoFocus
                    onChange={(e) => updateHabitName(idx, e.target.value)}
                    onBlur={() => setEditingHabit(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingHabit(null)}
                    className="flex-1 bg-transparent border-b border-foreground text-sm text-foreground outline-none py-0.5"
                  />
                ) : (
                  <span className={`flex-1 text-sm transition-all ${habitsDone[idx] ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {habit.name}
                  </span>
                )}

                <div className="flex items-center gap-2 flex-shrink-0">
                  {habitStreaks[idx] > 0 && (
                    <span className="flex items-center gap-1 text-xs text-brand font-medium">
                      <Flame size={12} /> {habitStreaks[idx]}
                    </span>
                  )}
                  <button
                    onClick={() => setEditingHabit(editingHabit === idx ? null : idx)}
                    className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Book Tracker */}
        <div className="bg-card rounded-xl p-6 border border-border space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-brand" />
            <h3 className="font-medium text-sm">Current Book</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-[0.1em] font-medium block mb-1">Title</label>
              <input
                type="text"
                value={book.title}
                onChange={(e) => updateBook('title', e.target.value)}
                placeholder="Book title..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40 transition-colors placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-[0.1em] font-medium block mb-1">Author</label>
              <input
                type="text"
                value={book.author}
                onChange={(e) => updateBook('author', e.target.value)}
                placeholder="Author name..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40 transition-colors placeholder:text-muted-foreground"
              />
            </div>
            {!book.title && !book.author && (
              <div className="flex items-center gap-3 p-3 bg-brand/5 border border-brand/10 rounded-lg">
                <BookOpen size={14} className="text-brand/60 shrink-0" />
                <p className="text-xs text-muted-foreground italic">
                  "The man who reads leads." — Add the book you're currently working through.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-[0.1em] font-medium block mb-1">Current Chapter</label>
                <input
                  type="number"
                  value={book.currentChapter || ''}
                  onChange={(e) => updateBook('currentChapter', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  min={0}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40 transition-colors placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-[0.1em] font-medium block mb-1">Total Chapters</label>
                <input
                  type="number"
                  value={book.totalChapters || ''}
                  onChange={(e) => updateBook('totalChapters', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  min={0}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40 transition-colors placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {book.totalChapters > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Progress</span>
                  <span className="text-xs text-brand font-medium">{bookProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-500"
                    style={{ width: `${bookProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Ch. {book.currentChapter} / {book.totalChapters}</p>
              </div>
            )}
          </div>
        </div>

        {/* Family Goal */}
        <div className="bg-card rounded-xl p-6 border border-border space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame size={16} className="text-brand" />
              <h3 className="font-medium text-sm">Family Goal</h3>
            </div>
            <button
              onClick={() => {
                const next = !familyGoalDone
                setFamilyGoalDone(next)
                saveGrowthState({ familyGoalDone: next })
              }}
              className="flex-shrink-0 transition-all"
            >
              {familyGoalDone
                ? <CheckCircle2 size={18} className="text-brand" />
                : <Circle size={18} className="text-border hover:text-muted-foreground" />
              }
            </button>
          </div>

          <textarea
            value={familyGoal}
            onChange={(e) => {
              setFamilyGoal(e.target.value)
              saveGrowthState({ familyGoal: e.target.value })
            }}
            placeholder="What's your family goal for today?"
            className={`w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground h-24 resize-none outline-none focus:border-foreground/40 transition-colors placeholder:text-muted-foreground ${familyGoalDone ? 'opacity-50 line-through' : ''}`}
          />
        </div>

      </main>
    </div>
  )
}
