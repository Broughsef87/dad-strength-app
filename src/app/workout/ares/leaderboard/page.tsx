'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/client'
import { motion } from 'framer-motion'
import { fadeUp, staggerContainer } from '../../../../components/ui/motion'
import { ArrowLeft, Trophy, Medal, Crown } from 'lucide-react'
import { formatAresWeek, getAresWeekNumber } from '../../../../lib/aresWeek'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetconResult {
  id: string
  user_id: string
  week_number: number
  day_number: number
  metcon_format: string | null
  metcon_time_seconds: number | null
  metcon_rounds: number | null
  metcon_partial_reps: number | null
  metcon_rx: boolean | null
  time_cap_hit: boolean | null
  block_name: string
  created_at: string
}

interface UserProfile {
  id: string
  display_name: string | null
}

interface RankedResult {
  rank: number
  userId: string
  displayName: string
  result: string
  rx: boolean
  timeCap: boolean
  rawSeconds: number | null
  rawRounds: number | null
  rawPartial: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatResult(r: MetconResult): string {
  if (r.metcon_time_seconds != null) {
    const m = Math.floor(r.metcon_time_seconds / 60)
    const s = r.metcon_time_seconds % 60
    return r.time_cap_hit
      ? `${m}:${s.toString().padStart(2, '0')} (cap)`
      : `${m}:${s.toString().padStart(2, '0')}`
  }
  if (r.metcon_rounds != null) {
    return r.metcon_partial_reps
      ? `${r.metcon_rounds} rds + ${r.metcon_partial_reps}`
      : `${r.metcon_rounds} rounds`
  }
  return 'Completed'
}

function anonymizeName(displayName: string | null): string {
  if (!displayName) return 'Athlete'
  const trimmed = displayName.trim()
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx !== -1) {
    const first = trimmed.slice(0, spaceIdx)
    const lastInitial = trimmed[spaceIdx + 1]
    return lastInitial ? `${first} ${lastInitial}.` : first
  }
  return trimmed.slice(0, 12)
}

function isAmrap(format: string | null): boolean {
  return format === 'amrap'
}

function getBestResult(results: MetconResult[]): MetconResult {
  if (results.length === 1) return results[0]
  const format = results[0].metcon_format
  if (isAmrap(format)) {
    return results.slice().sort((a, b) => {
      const ar = a.metcon_rounds ?? -1
      const br = b.metcon_rounds ?? -1
      if (br !== ar) return br - ar
      return (b.metcon_partial_reps ?? -1) - (a.metcon_partial_reps ?? -1)
    })[0]
  }
  // for_time / emom / chipper: sort by seconds ASC (time_cap_hit after)
  return results.slice().sort((a, b) => {
    const as = a.metcon_time_seconds
    const bs = b.metcon_time_seconds
    if (as == null && bs == null) return 0
    if (as == null) return 1
    if (bs == null) return -1
    if (a.time_cap_hit && !b.time_cap_hit) return 1
    if (!a.time_cap_hit && b.time_cap_hit) return -1
    return as - bs
  })[0]
}

function rankResults(rawResults: MetconResult[], profiles: UserProfile[]): RankedResult[] {
  // Group by user_id
  const byUser = new Map<string, MetconResult[]>()
  for (const r of rawResults) {
    const existing = byUser.get(r.user_id) ?? []
    existing.push(r)
    byUser.set(r.user_id, existing)
  }

  // Take best per user
  const bests: MetconResult[] = []
  for (const [, entries] of byUser) {
    bests.push(getBestResult(entries))
  }

  // Build profile lookup
  const profileMap = new Map<string, string | null>()
  for (const p of profiles) {
    profileMap.set(p.id, p.display_name)
  }

  // Determine format from first result
  const format = bests[0]?.metcon_format ?? null
  const sorted = bests.slice().sort((a, b) => {
    if (isAmrap(format)) {
      const ar = a.metcon_rounds ?? -1
      const br = b.metcon_rounds ?? -1
      if (br !== ar) return br - ar
      return (b.metcon_partial_reps ?? -1) - (a.metcon_partial_reps ?? -1)
    }
    // for_time etc
    const as = a.metcon_time_seconds
    const bs = b.metcon_time_seconds
    if (as == null && bs == null) return 0
    if (as == null) return 1
    if (bs == null) return -1
    if (a.time_cap_hit && !b.time_cap_hit) return 1
    if (!a.time_cap_hit && b.time_cap_hit) return -1
    return as - bs
  })

  return sorted.map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    displayName: anonymizeName(profileMap.get(r.user_id) ?? null),
    result: formatResult(r),
    rx: r.metcon_rx ?? false,
    timeCap: r.time_cap_hit ?? false,
    rawSeconds: r.metcon_time_seconds,
    rawRounds: r.metcon_rounds,
    rawPartial: r.metcon_partial_reps,
  }))
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AresLeaderboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const aresWeekNumber = getAresWeekNumber()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [rankedResults, setRankedResults] = useState<RankedResult[]>([])
  const [wodDescription, setWodDescription] = useState<string | null>(null)
  const [dayName, setDayName] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [userRowVisible, setUserRowVisible] = useState<boolean>(true)
  const userRowRef = useRef<HTMLDivElement | null>(null)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setCurrentUserId(user.id)
    }
    checkAuth()
  }, [router])

  // Data fetch on day change
  useEffect(() => {
    if (currentUserId === null) return
    const fetchData = async () => {
      setLoading(true)

      // Fetch MetCon results
      const { data: results } = await supabase
        .from('ares_session_logs')
        .select('*')
        .eq('log_type', 'metcon')
        .eq('week_number', aresWeekNumber)
        .eq('day_number', selectedDay)

      const metconResults: MetconResult[] = (results ?? []) as MetconResult[]

      // Fetch user profiles for unique user_ids
      const uniqueUserIds = [...new Set(metconResults.map(r => r.user_id))]
      let profiles: UserProfile[] = []
      if (uniqueUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('id, display_name')
          .in('id', uniqueUserIds)
        profiles = (profileData ?? []) as UserProfile[]
      }

      // Fetch WOD context
      const { data: workoutData } = await supabase
        .from('generated_workouts')
        .select('workout_data')
        .eq('program_slug', 'ares')
        .eq('week_number', aresWeekNumber)
        .eq('day_number', selectedDay)
        .maybeSingle()

      if (workoutData?.workout_data) {
        const wd = workoutData.workout_data as {
          day?: {
            dayName?: string
            metcon?: { description?: string }
          }
        }
        setDayName(wd.day?.dayName ?? null)
        setWodDescription(wd.day?.metcon?.description ?? null)
      } else {
        setDayName(null)
        setWodDescription(null)
      }

      if (metconResults.length > 0) {
        setRankedResults(rankResults(metconResults, profiles))
      } else {
        setRankedResults([])
      }

      setLoading(false)
    }

    fetchData()
  }, [selectedDay, currentUserId, aresWeekNumber])

  // Observe user row visibility for fixed banner
  useEffect(() => {
    if (!userRowRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => setUserRowVisible(entry.isIntersecting),
      { threshold: 0.5 }
    )
    observer.observe(userRowRef.current)
    return () => observer.disconnect()
  }, [rankedResults])

  const userRanked = rankedResults.find(r => r.userId === currentUserId)
  const showBanner = !!userRanked && !userRowVisible

  function getRankIcon(rank: number) {
    if (rank === 1) return <Crown size={16} className="text-yellow-400" strokeWidth={1.5} />
    if (rank === 2) return <Medal size={16} className="text-slate-400" strokeWidth={1.5} />
    if (rank === 3) return <Medal size={16} className="text-amber-600" strokeWidth={1.5} />
    return (
      <span className="text-[11px] font-display text-muted-foreground w-4 text-center inline-block">
        {rank}
      </span>
    )
  }

  // Truncate description to first 2 lines (by newline or ~80 chars)
  function truncateDescription(desc: string): string {
    const lines = desc.split('\n').filter(l => l.trim().length > 0)
    return lines.slice(0, 2).join('\n')
  }

  if (currentUserId === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="w-6 h-6 border border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-brand/30 transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Trophy size={15} className="text-brand shrink-0" strokeWidth={1.5} />
              <h1 className="text-lg font-display tracking-wide uppercase text-foreground leading-none truncate">
                Ares Leaderboard
              </h1>
            </div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5 font-semibold">
              {formatAresWeek(aresWeekNumber)}
            </p>
          </div>
        </div>

        {/* Day tab selector */}
        <div className="flex gap-2 mb-5">
          {[1, 2, 3, 4].map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`flex-1 py-2 rounded-full text-[11px] font-display uppercase tracking-[0.12em] transition-all ${
                selectedDay === day
                  ? 'bg-brand text-background font-semibold'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-brand/30'
              }`}
            >
              Day {day}
            </button>
          ))}
        </div>

        {/* WOD preview card */}
        {(dayName || wodDescription) && (
          <div className="bg-card border border-border rounded-xl p-4 mb-5">
            {dayName && (
              <p className="text-[9px] uppercase tracking-[0.18em] text-brand font-semibold font-display mb-1">
                {dayName}
              </p>
            )}
            {wodDescription && (
              <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-line">
                {truncateDescription(wodDescription)}
              </p>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rankedResults.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-8 text-center"
          >
            <Trophy size={28} className="text-muted-foreground/30 mx-auto mb-3" strokeWidth={1} />
            <p className="text-sm text-foreground font-semibold mb-1">No results yet for Day {selectedDay}</p>
            <p className="text-[11px] text-muted-foreground">Be the first to post!</p>
          </motion.div>
        ) : (
          <motion.div
            key={selectedDay}
            className="space-y-2"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {rankedResults.map((r) => {
              const isCurrentUser = r.userId === currentUserId
              return (
                <motion.div
                  key={r.userId}
                  ref={isCurrentUser ? userRowRef : undefined}
                  variants={fadeUp}
                  custom={r.rank - 1}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                    isCurrentUser
                      ? 'border-brand/30 bg-brand/5'
                      : 'border-border bg-card'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-6 flex items-center justify-center shrink-0">
                    {getRankIcon(r.rank)}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[13px] font-semibold leading-none truncate ${
                        isCurrentUser ? 'text-brand' : 'text-foreground'
                      }`}
                    >
                      {r.displayName}
                      {isCurrentUser && (
                        <span className="ml-1.5 text-[9px] text-brand/70 font-normal normal-case tracking-normal">
                          (you)
                        </span>
                      )}
                    </p>
                    {!r.rx && (
                      <p className="text-[9px] text-muted-foreground mt-0.5 tracking-wide">
                        Scaled
                      </p>
                    )}
                  </div>

                  {/* Result */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] font-display font-semibold text-foreground tabular-nums">
                      {r.result}
                    </span>
                    {r.rx && (
                      <span className="text-[8px] font-display font-bold uppercase tracking-[0.1em] bg-brand/10 text-brand px-1.5 py-0.5 rounded-sm">
                        RX
                      </span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      {/* Your position banner */}
      {showBanner && userRanked && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-safe">
          <div className="max-w-md w-full px-4 pb-4">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-brand text-background rounded-xl px-5 py-3 flex items-center justify-center gap-2 shadow-lg"
            >
              <Trophy size={13} strokeWidth={2} />
              <p className="text-[11px] font-display uppercase tracking-[0.14em] font-semibold">
                You&apos;re #{userRanked.rank} of {rankedResults.length} athletes
              </p>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  )
}
