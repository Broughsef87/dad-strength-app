'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import { Moon, AlertTriangle, Zap, Baby } from 'lucide-react'

type SleepEntry = {
  date: string
  babyQuality: 'good' | 'ok' | 'rough'
  personalHours: number
}

const QUALITY_LABELS = { good: 'Good Night', ok: 'Manageable', rough: 'Rough Night' }
const QUALITY_COLORS = {
  good: 'bg-green-500/10 border-green-500/20 text-green-600',
  ok: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600',
  rough: 'bg-red-500/10 border-red-500/20 text-red-500',
}

export default function BabySleepTracker() {
  const [supabase] = useState(() => createClient())
  const [entries, setEntries] = useState<SleepEntry[]>([])
  const [babyQuality, setBabyQuality] = useState<SleepEntry['babyQuality']>('ok')
  const [personalHours, setPersonalHours] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('user_profiles')
      .select('sleep_log')
      .eq('id', user.id)
      .maybeSingle()

    if (data?.sleep_log) {
      const log = data.sleep_log as SleepEntry[]
      setEntries(log.slice(-7).reverse())
      const todayEntry = log.find(e => e.date === today)
      if (todayEntry) {
        setBabyQuality(todayEntry.babyQuality)
        setPersonalHours(String(todayEntry.personalHours))
      }
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const newEntry: SleepEntry = {
      date: today,
      babyQuality,
      personalHours: parseFloat(personalHours) || 0,
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('sleep_log')
        .eq('id', user.id)
        .maybeSingle()

      const existing: SleepEntry[] = (profile?.sleep_log as SleepEntry[]) || []
      const updated = [...existing.filter(e => e.date !== today), newEntry]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30)

      await supabase.from('user_profiles').upsert(
        { id: user.id, sleep_log: updated },
        { onConflict: 'id' }
      )
      setEntries(updated.slice(-7).reverse())
    }

    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  // Sleep debt: count rough nights in last 7 days
  const roughNights = entries.filter(e => e.babyQuality === 'rough').length
  const sleepDebt = roughNights
  const inRecoveryMode = sleepDebt >= 3

  if (loading) return (
    <div className="bg-card rounded-xl p-5 border border-border animate-pulse">
      <div className="h-3 bg-muted rounded w-1/3 mb-3" />
      <div className="h-7 bg-muted rounded w-2/3" />
    </div>
  )

  return (
    <div className="bg-card rounded-xl p-5 border border-border space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <Baby size={15} strokeWidth={1.5} className="text-brand" />
          </div>
          <h3 className="font-medium text-sm">Baby Sleep Log</h3>
        </div>
        {inRecoveryMode && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
            <Zap size={11} className="text-yellow-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Recovery Mode</span>
          </div>
        )}
      </div>

      {inRecoveryMode && (
        <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
          <p className="text-xs text-yellow-600 font-medium leading-relaxed">
            <strong>3+ rough nights this week.</strong> Scale down your training intensity — a 15-minute bodyweight protocol today beats skipping entirely.
          </p>
        </div>
      )}

      {/* 7-day view */}
      {entries.length > 0 && (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (6 - i))
            const dateStr = d.toISOString().split('T')[0]
            const entry = entries.find(e => e.date === dateStr)
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                  !entry ? 'bg-muted/50 border-border' :
                  entry.babyQuality === 'good' ? 'bg-green-500/20 border-green-500/30' :
                  entry.babyQuality === 'ok' ? 'bg-yellow-500/20 border-yellow-500/30' :
                  'bg-red-500/20 border-red-500/30'
                }`}>
                  <Moon size={12} className={
                    !entry ? 'text-muted-foreground/30' :
                    entry.babyQuality === 'good' ? 'text-green-500' :
                    entry.babyQuality === 'ok' ? 'text-yellow-500' :
                    'text-red-500'
                  } />
                </div>
                <span className="text-[9px] text-muted-foreground font-medium">{dayLabel}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Log today */}
      <div className="pt-3 border-t border-border space-y-4">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Log Last Night</p>

        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium mb-2">Baby's Night</p>
          <div className="grid grid-cols-3 gap-2">
            {(['good', 'ok', 'rough'] as const).map(q => (
              <button
                key={q}
                onClick={() => setBabyQuality(q)}
                className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all active:scale-95 ${
                  babyQuality === q ? QUALITY_COLORS[q] : 'bg-muted border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {q === 'good' ? 'Good' : q === 'ok' ? 'OK' : 'Rough'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium mb-2">Your Sleep (hrs)</p>
          <input
            type="number"
            inputMode="decimal"
            value={personalHours}
            onChange={e => setPersonalHours(e.target.value)}
            placeholder="6.5"
            step="0.5"
            min="0"
            max="12"
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-bold text-foreground outline-none focus:border-brand transition-colors placeholder:text-muted-foreground"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all active:scale-[0.97] disabled:opacity-40 ${
            savedMsg ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-foreground text-background hover:opacity-90'
          }`}
        >
          {savedMsg ? '✓ Logged' : saving ? 'Saving...' : 'Log Night'}
        </button>
      </div>
    </div>
  )
}
