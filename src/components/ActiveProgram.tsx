'use client'

// ── Active Protocol card (Chassis) ─────────────────────────────────────────────
// The same UNIT-01 mobile-suit status board as the dashboard: panel-cut chrome,
// week readout, LED bar of completed days, loadout rows, Launch Session.
// Self-contained: fetches the active program + this week's session_complete
// sentinels itself (server-derived — consistent across devices).

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PlayCircle, ChevronRight } from 'lucide-react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import { getProgram } from '../lib/programs'

interface ProgramRow {
  slug: string
  currentWeek: number
}

export default function ActiveProgram() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const { user } = useUser()
  const [row, setRow] = useState<ProgramRow | null>(null)
  const [doneDays, setDoneDays] = useState<number[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!user) { setLoaded(true); return }
    try {
      const { data: prog } = await supabase
        .from('user_programs')
        .select('program_slug, current_week')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (!prog?.program_slug) { setRow(null); setLoaded(true); return }
      const slug: string = prog.program_slug
      const currentWeek: number = prog.current_week ?? 1
      setRow({ slug, currentWeek })

      if (getProgram(slug)) {
        const { data: workouts } = await supabase
          .from('generated_workouts')
          .select('id')
          .eq('user_id', user.id)
          .eq('program_slug', slug)
          .eq('week_number', currentWeek)
        const ids = (workouts ?? []).map((w: { id: string }) => w.id)
        if (ids.length) {
          const { data: sentinels } = await supabase
            .from('ares_session_logs')
            .select('day_number')
            .eq('user_id', user.id)
            .in('generated_workout_id', ids)
            .eq('log_type', 'session_complete')
          setDoneDays([...new Set(((sentinels ?? []) as Array<{ day_number: number }>).map(l => l.day_number))])
        } else {
          setDoneDays([])
        }
      }
    } finally {
      setLoaded(true)
    }
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const program = row ? getProgram(row.slug) : null

  if (!loaded) {
    return (
      <div className="panel-cut bg-card border border-border p-6 pt-8 animate-pulse">
        <div className="h-3 bg-muted rounded w-2/3 mb-3" />
        <div className="h-7 bg-muted rounded w-1/2" />
      </div>
    )
  }

  const launch = () => {
    if (row && program) {
      let nextDay = 1
      for (let i = 1; i <= program.daysPerWeek; i++) {
        if (!doneDays.includes(i)) { nextDay = i; break }
      }
      router.push(`/train/${row.slug}/${nextDay}`)
    } else {
      router.push('/build')
    }
  }

  return (
    <div className="panel-cut hud-frame relative bg-card border border-border p-6 pt-8 overflow-hidden">
      <span className="panel-id">UNIT-01 // {(row?.slug ?? 'standby').replace(/-/g, '.').toUpperCase()}</span>

      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="livery-slash pl-4">
          <span className="telemetry">Active Protocol</span>
          <h2 className="font-display text-3xl text-foreground leading-none mt-1 uppercase tracking-wide">
            {program?.name || 'Choose Program'}
          </h2>
        </div>
        {row && (
          <div className="text-right shrink-0">
            <p className="readout-num text-4xl text-brand" style={{ textShadow: '0 0 16px hsl(var(--brand) / 0.4)' }}>
              {String(row.currentWeek).padStart(2, '0')}
            </p>
            <p className="telemetry-dim">WEEK</p>
          </div>
        )}
      </div>

      {/* Week LED bar — done days */}
      {row && program && (
        <div className="relative z-10 mb-4">
          <div className="led-bar">
            {Array.from({ length: program.daysPerWeek }).map((_, i) => (
              <span key={i} className={`led-cell ${doneDays.includes(i + 1) ? 'lit' : ''}`} />
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            <p className="telemetry-dim">SESSIONS THIS WEEK</p>
            <p className="telemetry">{doneDays.length}/{program.daysPerWeek}</p>
          </div>
        </div>
      )}

      {/* Metadata readout */}
      {row && program && (
        <div className="border-t border-border/60 relative z-10 mb-4">
          <div className="data-row">
            <span className="telemetry-dim">LOADOUT</span>
            <span className="text-sm font-semibold text-foreground">{program.tagline}</span>
          </div>
          <div className="data-row">
            <span className="telemetry-dim">FREQUENCY</span>
            <span className="readout-num text-sm text-foreground">{program.daysPerWeek} / WK</span>
          </div>
        </div>
      )}

      {!row && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-4 relative z-10">
          No unit deployed. Select a training path.
        </p>
      )}

      <div className="flex flex-col gap-2.5 relative z-10">
        <button
          onClick={launch}
          className="panel-cut carbon mecha-glow w-full flex items-center justify-center gap-2.5 py-3.5 text-sm font-semibold text-brand border border-brand/60 uppercase tracking-[0.14em] transition-all active:scale-[0.98] hover:border-brand"
        >
          <PlayCircle size={16} strokeWidth={2} />
          {row ? 'Launch Session' : 'Select Path'}
        </button>
        {row && (
          <div className="flex items-center justify-between mt-1">
            <button
              onClick={() => router.push(`/train/${row.slug}`)}
              className="inline-flex items-center gap-1 telemetry hover:text-brand transition-colors py-1"
            >
              MISSION SCHEDULE <ChevronRight size={11} strokeWidth={2} />
            </button>
            <button
              onClick={() => router.push('/build')}
              className="inline-flex items-center gap-1 telemetry-dim hover:text-brand transition-colors py-1"
            >
              CHANGE UNIT <ChevronRight size={11} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
