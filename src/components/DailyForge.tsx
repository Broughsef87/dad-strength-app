'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import { X, ChevronRight, Sun, Heart, Target } from 'lucide-react'

const STORAGE_KEY = 'dad-strength-daily-forge'

type ForgeData = {
  date: string
  sleepQuality: number       // 1-5
  babySleepQuality: number   // 1-5
  todayFocus: string
  familyIntention: string
  completed: boolean
}

export default function DailyForge({ onComplete }: { onComplete?: () => void }) {
  const [supabase] = useState(() => createClient())
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(1)
  const [sleepQuality, setSleepQuality] = useState(3)
  const [babySleepQuality, setBabySleepQuality] = useState(3)
  const [todayFocus, setTodayFocus] = useState('')
  const [familyIntention, setFamilyIntention] = useState('')
  const [saving, setSaving] = useState(false)

  const today = new Date().toLocaleDateString()

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const data: ForgeData = JSON.parse(saved)
        if (data.date === today && data.completed) return
      } catch {}
    }
    // Show after short delay for smooth UX
    const t = setTimeout(() => setShow(true), 800)
    return () => clearTimeout(t)
  }, [today])

  const handleComplete = async () => {
    setSaving(true)
    const data: ForgeData = {
      date: today,
      sleepQuality,
      babySleepQuality,
      todayFocus,
      familyIntention,
      completed: true,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const todayISO = new Date().toISOString().split('T')[0]
        await supabase.from('daily_checkins').upsert(
          { user_id: user.id, date: todayISO, forge_state: data, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,date' }
        )
      }
    } catch {}

    setSaving(false)
    setShow(false)
    onComplete?.()
  }

  const SleepDots = ({ value, onChange }: { value: number, onChange: (v: number) => void }) => (
    <div className="flex items-center gap-3 justify-center">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-10 h-10 rounded-full font-black text-sm transition-all active:scale-90 ${
            n <= value ? 'bg-brand text-white shadow-lg shadow-brand/30 scale-105' : 'bg-muted text-muted-foreground'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )

  const sleepLabel = (v: number) => ['', 'Brutal', 'Rough', 'Decent', 'Good', 'Elite'][v]

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-7 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand font-medium">Daily Forge</p>
            <h2 className="text-xl font-black tracking-tighter text-foreground">Morning Check-In</h2>
          </div>
          <button onClick={() => setShow(false)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-8">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-brand' : 'bg-muted'}`} />
          ))}
        </div>

        {/* Step 1: Sleep */}
        {step === 1 && (
          <div className="space-y-7">
            <div className="flex items-center gap-2 text-muted-foreground mb-5">
              <Sun size={16} className="text-brand" />
              <span className="text-sm font-medium">How&apos;d the night go?</span>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Your Sleep</p>
                <SleepDots value={sleepQuality} onChange={setSleepQuality} />
                <p className="text-center text-xs font-bold text-brand mt-2">{sleepLabel(sleepQuality)}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Baby&apos;s Night</p>
                <SleepDots value={babySleepQuality} onChange={setBabySleepQuality} />
                <p className="text-center text-xs font-bold text-brand mt-2">{sleepLabel(babySleepQuality)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Focus */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-5">
              <Target size={16} className="text-brand" />
              <span className="text-sm font-medium">Your #1 focus today?</span>
            </div>
            <textarea
              autoFocus
              value={todayFocus}
              onChange={e => setTodayFocus(e.target.value)}
              placeholder="One thing that moves the needle..."
              rows={4}
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-brand transition-colors"
            />
            <p className="text-[10px] text-muted-foreground italic">One objective. Not three. Not five. One.</p>
          </div>
        )}

        {/* Step 3: Family */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-5">
              <Heart size={16} className="text-brand" />
              <span className="text-sm font-medium">What will you do for your family today?</span>
            </div>
            <textarea
              autoFocus
              value={familyIntention}
              onChange={e => setFamilyIntention(e.target.value)}
              placeholder="One intentional act for the people who matter most..."
              rows={4}
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-brand transition-colors"
            />
            <p className="text-[10px] text-muted-foreground italic">&quot;The quality of your life is the quality of your relationships.&quot;</p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-5 py-3 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-2 bg-brand text-white font-black text-sm py-3 rounded-xl hover:opacity-90 transition-opacity active:scale-[0.97]"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="flex-1 bg-brand text-white font-black text-sm py-3 rounded-xl hover:opacity-90 transition-opacity active:scale-[0.97] disabled:opacity-50"
            >
              {saving ? 'Locking in...' : 'Lock In & Forge'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
