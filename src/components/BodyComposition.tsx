'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import { Scale, TrendingDown, TrendingUp, Minus } from 'lucide-react'

type BodyEntry = {
  date: string
  weight: number
  waist?: number
}

export default function BodyComposition() {
  const [supabase] = useState(() => createClient())
  const { user } = useUser()
  const [entries, setEntries] = useState<BodyEntry[]>([])
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadEntries()
  }, [user])

  const loadEntries = async () => {
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('body_composition')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.body_composition) {
      setEntries((profile.body_composition as BodyEntry[]).slice(-10).reverse())
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!weight) return
    setSaving(true)
    const newEntry: BodyEntry = {
      date: today,
      weight: parseFloat(weight),
      waist: waist ? parseFloat(waist) : undefined,
    }

    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('body_composition')
        .eq('id', user.id)
        .maybeSingle()

      const existing: BodyEntry[] = (profile?.body_composition as BodyEntry[]) || []
      // Replace today's entry if it exists, otherwise append
      const updated = [...existing.filter(e => e.date !== today), newEntry]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30) // keep last 30 entries

      await supabase.from('user_profiles').upsert(
        { id: user.id, body_composition: updated },
        { onConflict: 'id' }
      )
      setEntries(updated.slice(-7).reverse())
    }

    setSaving(false)
    setSavedMsg(true)
    setWeight('')
    setWaist('')
    setTimeout(() => setSavedMsg(false), 2500)
  }

  const latest = entries[0]
  const previous = entries[1]
  const weightDiff = latest && previous ? latest.weight - previous.weight : null

  const TrendIcon = weightDiff === null ? null : weightDiff < 0 ? TrendingDown : weightDiff > 0 ? TrendingUp : Minus
  const trendColor = weightDiff === null ? '' : weightDiff < 0 ? 'text-green-500' : weightDiff > 0 ? 'text-red-500' : 'text-muted-foreground'

  if (loading) return (
    <div className="bg-card rounded-xl p-5 border border-border animate-pulse">
      <div className="h-3 bg-muted rounded w-1/3 mb-3" />
      <div className="h-7 bg-muted rounded w-1/2" />
    </div>
  )

  return (
    <div className="bg-card rounded-xl p-5 border border-border space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <Scale size={15} strokeWidth={1.5} className="text-brand" />
          </div>
          <h3 className="font-medium text-sm">Body Composition</h3>
        </div>
        {latest && TrendIcon && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon size={14} strokeWidth={2} />
            <span className="text-xs font-bold tabular-nums">
              {Math.abs(weightDiff!).toFixed(1)} lbs
            </span>
          </div>
        )}
      </div>

      {/* Latest stats */}
      {latest && (
        <div className="flex items-end gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1">Weight</p>
            <p className="text-3xl font-black tabular-nums leading-none">{latest.weight}<span className="text-sm font-medium text-muted-foreground ml-1">lbs</span></p>
          </div>
          {latest.waist && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1">Waist</p>
              <p className="text-3xl font-black tabular-nums leading-none">{latest.waist}<span className="text-sm font-medium text-muted-foreground ml-1">in</span></p>
            </div>
          )}
        </div>
      )}

      {/* Mini trend (last 5 entries) */}
      {entries.length > 1 && (
        <div className="space-y-1">
          {entries.slice(0, 5).reverse().map((e, i) => (
            <div key={e.date} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span className={`font-bold tabular-nums ${i === entries.slice(0, 5).length - 1 ? 'text-brand' : 'text-foreground'}`}>{e.weight} lbs</span>
            </div>
          ))}
        </div>
      )}

      {/* Log today */}
      <div className="pt-3 border-t border-border space-y-3">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Log Today</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] font-medium block mb-1.5">Weight (lbs)</label>
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder={latest?.weight?.toString() || '185'}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-bold text-foreground outline-none focus:border-brand transition-colors placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] font-medium block mb-1.5">Waist (in) <span className="normal-case text-muted-foreground/50">opt.</span></label>
            <input
              type="number"
              inputMode="decimal"
              value={waist}
              onChange={e => setWaist(e.target.value)}
              placeholder={latest?.waist?.toString() || '34'}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-bold text-foreground outline-none focus:border-brand transition-colors placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!weight || saving}
          className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all active:scale-[0.97] disabled:opacity-40 ${
            savedMsg ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-foreground text-background hover:opacity-90'
          }`}
        >
          {savedMsg ? '✓ Logged' : saving ? 'Saving...' : 'Log Weight'}
        </button>
      </div>
    </div>
  )
}
