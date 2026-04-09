'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
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
  const { user } = useUser()
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
          className={`w-10 h-10 rounded-full font-black text-sm transition-all duration-150 active:scale-90 ${
            n <= value ? 'text-white scale-110' : 'text-muted-foreground'
          }`}
          style={n <= value ? {
            background: 'linear-gradient(145deg, #e03535 0%, #aa1111 100%)',
            boxShadow: '0 0 12px 2px rgba(230,26,26,0.5), 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)',
          } : {
            background: 'linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.4)',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  )

  const sleepLabel = (v: number) => ['', 'Brutal', 'Rough', 'Decent', 'Good', 'Elite'][v]

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-24"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(230,26,26,0.08) 0%, rgba(0,0,0,0.82) 60%)' }}
    >
      <div className="w-full max-w-sm relative rounded-xl animate-in slide-in-from-bottom-8 duration-500 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #111111 60%, #0d0d0d 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.9), 0 12px 48px rgba(0,0,0,0.7), 0 0 80px rgba(230,26,26,0.06)',
        }}
      >
        {/* Carbon fiber weave overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `
            repeating-linear-gradient(45deg, transparent 0px, transparent 3px, rgba(255,255,255,0.014) 3px, rgba(255,255,255,0.014) 4px),
            repeating-linear-gradient(-45deg, transparent 0px, transparent 3px, rgba(255,255,255,0.014) 3px, rgba(255,255,255,0.014) 4px)
          `
        }} />
        {/* Steel inner highlight — top edge catches light */}
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(180,180,180,0.15) 20%, rgba(210,210,210,0.35) 50%, rgba(180,180,180,0.15) 80%, transparent 100%)'
        }} />
        {/* Red accent line — glowing taillight */}
        <div className="absolute top-px left-0 right-0 h-[2px] pointer-events-none" style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(230,26,26,0.35) 15%, rgba(230,26,26,0.95) 38%, rgba(230,26,26,0.95) 62%, rgba(230,26,26,0.35) 85%, transparent 100%)',
          boxShadow: '0 0 10px 1px rgba(230,26,26,0.45), 0 0 28px 4px rgba(230,26,26,0.16)'
        }} />
        {/* Red ember at base */}
        <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{
          background: 'linear-gradient(0deg, rgba(230,26,26,0.05) 0%, transparent 100%)'
        }} />

        {/* Content — elevated above overlays */}
        <div className="relative z-10 p-7">

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand font-medium">Daily Forge</p>
            <h2 className="font-display text-2xl tracking-[0.08em] uppercase text-foreground">Morning Check-In</h2>
          </div>
          <button onClick={() => setShow(false)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator — glowing active segments */}
        <div className="flex gap-1.5 mb-8">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-[3px] rounded-full transition-all duration-300 ${
              s <= step
                ? 'bg-brand'
                : 'bg-muted'
            }`}
              style={s <= step ? { boxShadow: '0 0 6px 1px rgba(230,26,26,0.5)' } : {}}
            />
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
              className="w-full bg-background border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-brand transition-colors"
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
              className="w-full bg-background border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-brand transition-colors"
            />
            <p className="text-[10px] text-muted-foreground italic">&quot;The quality of your life is the quality of your relationships.&quot;</p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-5 py-3 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              style={{
                background: 'linear-gradient(145deg, #252525 0%, #181818 100%)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
              }}
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-2 text-white font-semibold text-sm py-3 rounded-md transition-all active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #e03030 0%, #b01010 100%)',
                boxShadow: '0 0 16px 2px rgba(230,26,26,0.4), 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
              }}
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="flex-1 text-white font-semibold text-sm py-3 rounded-md transition-all active:scale-[0.97] disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #e03030 0%, #b01010 100%)',
                boxShadow: '0 0 16px 2px rgba(230,26,26,0.4), 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
              }}
            >
              {saving ? 'Locking in...' : 'Lock In & Forge'}
            </button>
          )}
        </div>

        </div>{/* /relative z-10 */}
      </div>
    </div>
  )
}
