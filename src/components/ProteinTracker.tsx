'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'dad-strength-protein'
const todayKey = () => new Date().toLocaleDateString()
const GOAL = 180

export default function ProteinTracker() {
  const [grams, setGrams] = useState(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.date === todayKey()) setGrams(data.grams)
      }
    } catch {}
  }, [])

  const add = (amount: number) => {
    const next = grams + amount
    setGrams(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), grams: next }))
  }

  const reset = () => {
    setGrams(0)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), grams: 0 }))
  }

  const pct = Math.min((grams / GOAL) * 100, 100)
  const remaining = Math.max(GOAL - grams, 0)

  return (
    <div className="ds-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Daily Protein</p>
        <button onClick={reset} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">Reset</button>
      </div>

      <div className="flex items-end gap-1.5">
        <p className="text-3xl font-light stat-num">{grams}</p>
        <span className="text-sm text-brand mb-1">g</span>
        <span className="text-xs text-muted-foreground mb-1.5 ml-1">/ {GOAL}g goal</span>
      </div>

      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-[10px] text-muted-foreground">
        {grams >= GOAL ? 'Goal reached' : `${remaining}g remaining`}
      </p>

      <div className="flex gap-2">
        {[5, 10, 20].map(amt => (
          <button
            key={amt}
            onClick={() => add(amt)}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium bg-muted hover:bg-foreground hover:text-background text-foreground border border-border transition-all"
          >
            +{amt}g
          </button>
        ))}
      </div>
    </div>
  )
}
