'use client'

import { useState, useEffect } from 'react'
import { Shield, ShieldCheck } from 'lucide-react'
import { toLocalDateString } from '../lib/utils'

type ShieldData = {
  shieldsUsed: Array<{ month: string; usedOn: string }>
  activeShield: boolean
}

function getCurrentMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function daysUntilNextShield(): number {
  const now = new Date()
  const firstOfNext = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const diff = firstOfNext.getTime() - now.getTime()
  return Math.ceil(diff / 86400000)
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StreakShield() {
  const [shieldData, setShieldData] = useState<ShieldData>({ shieldsUsed: [], activeShield: false })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('dad-strength-streak-shields')
    if (raw) {
      try {
        setShieldData(JSON.parse(raw))
      } catch {
        // malformed — use default
      }
    }
    setMounted(true)
  }, [])

  if (!mounted) return null

  const currentMonth = getCurrentMonth()
  const today = toLocalDateString(new Date())

  const usedThisMonth = shieldData.shieldsUsed.find(s => s.month === currentMonth)
  const activeToday = shieldData.activeShield && usedThisMonth?.usedOn === today

  function activateShield() {
    const next: ShieldData = {
      shieldsUsed: [
        ...shieldData.shieldsUsed.filter(s => s.month !== currentMonth),
        { month: currentMonth, usedOn: today },
      ],
      activeShield: true,
    }
    localStorage.setItem('dad-strength-streak-shields', JSON.stringify(next))
    setShieldData(next)
  }

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <Shield size={15} strokeWidth={1.5} className="text-brand" />
          </div>
          <h3 className="font-medium text-sm">Streak Shield</h3>
        </div>
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
          Monthly
        </span>
      </div>

      <p className="text-xs text-muted-foreground -mt-1">
        One per month. Use it wisely.
      </p>

      {/* State: active today */}
      {activeToday && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <ShieldCheck size={22} className="text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-500">Streak Protected</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(today)}</p>
          </div>
        </div>
      )}

      {/* State: shield used earlier this month (not active today) */}
      {usedThisMonth && !activeToday && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 opacity-50">
            <div className="p-2 bg-muted rounded-full">
              <Shield size={20} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Shield used {formatDate(usedThisMonth.usedOn)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Next shield in {daysUntilNextShield()} day{daysUntilNextShield() !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-muted-foreground/30 rounded-full w-full" />
          </div>
        </div>
      )}

      {/* State: shield available */}
      {!usedThisMonth && !activeToday && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-full brand-pulse">
              <Shield size={20} className="text-brand" />
            </div>
            <div>
              <p className="text-sm font-medium">Shield ready</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Protects your streak for today</p>
            </div>
          </div>
          <button
            onClick={activateShield}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold tracking-wide hover:opacity-90 active:scale-[0.97] transition-all brand-glow"
          >
            <Shield size={15} />
            Activate Shield
          </button>
        </div>
      )}
    </div>
  )
}
