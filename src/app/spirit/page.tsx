'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, fadeUp } from '../../components/ui/motion'
import { Zap, Users, Check, ScrollText, ArrowRight, PenLine } from 'lucide-react'
import BottomNav from '../../components/BottomNav'
import AppHeader from '../../components/AppHeader'
import MorningProtocol from '../../components/MorningProtocol'
import { type StoicEntry, getTodaysStoicEntry } from '../../data/stoicEntries'
import { createClient } from '../../utils/supabase/client'

// ── Challenge data ─────────────────────────────────────────────────────────────

type Category = 'wife' | 'kids' | 'brotherhood' | 'self'

const CATEGORY_CONFIG: Record<Category, { label: string; color: string; bg: string }> = {
  wife:        { label: 'Wife',        color: 'text-rose-400',  bg: 'bg-rose-500/10'   },
  kids:        { label: 'Kids',        color: 'text-amber-400', bg: 'bg-amber-500/10'  },
  brotherhood: { label: 'Brotherhood', color: 'text-blue-400',  bg: 'bg-blue-500/10'   },
  self:        { label: 'Self',        color: 'text-brand',     bg: 'bg-brand/10'      },
}

type Challenge = { id: number; category: Category; text: string }

const CHALLENGES: Challenge[] = [
  // Wife
  { id:  1, category: 'wife', text: 'Put your phone face-down at dinner tonight and hold eye contact.' },
  { id:  2, category: 'wife', text: 'Text her one specific thing you noticed and appreciated about her today.' },
  { id:  3, category: 'wife', text: 'Ask what she needs from you this week — then just listen.' },
  { id:  4, category: 'wife', text: 'Do one task she\'s been handling without being asked and without mentioning it.' },
  { id:  5, category: 'wife', text: 'Tell the kids, in front of her, something you love about their mom.' },
  { id:  6, category: 'wife', text: 'Make the bed before she gets to it.' },
  { id:  7, category: 'wife', text: 'Ask her about something she\'s working on — nothing to do with kids.' },
  { id:  8, category: 'wife', text: 'Plan the next date, even if it\'s just a walk after the kids are in bed.' },
  { id:  9, category: 'wife', text: 'Bring her coffee or tea exactly the way she likes it — no reason needed.' },
  { id: 10, category: 'wife', text: 'Say "I\'ve got the kids tonight" and actually mean it.' },
  { id: 11, category: 'wife', text: 'Ask her what she\'d do with 2 free hours and make it happen this week.' },
  { id: 12, category: 'wife', text: 'Tell her something you\'re proud of her for — out loud, not over text.' },
  { id: 13, category: 'wife', text: 'Put your phone away an hour before bed and just be present with her.' },
  { id: 14, category: 'wife', text: 'Write her a note — actual paper, not a text.' },
  { id: 15, category: 'wife', text: 'Ask her what she needs more of from you. Don\'t get defensive.' },
  // Kids
  { id: 16, category: 'kids', text: 'Get on the floor and play whatever they want for 20 minutes — no directing.' },
  { id: 17, category: 'kids', text: 'Ask "what was the best part of your day?" then ask one follow-up question.' },
  { id: 18, category: 'kids', text: 'Tell your kid one specific thing you noticed them do well this week.' },
  { id: 19, category: 'kids', text: 'Put your phone in another room for the next hour.' },
  { id: 20, category: 'kids', text: 'Let them teach you something — a game, a move, a song. Be a real student.' },
  { id: 21, category: 'kids', text: 'Say "I\'m proud of you" for who they are, not something they achieved.' },
  { id: 22, category: 'kids', text: 'Do the bedtime routine tonight with full presence — no rushing.' },
  { id: 23, category: 'kids', text: 'Ask them what they\'d build if they could build anything in the world.' },
  { id: 24, category: 'kids', text: 'Leave a note in their lunchbox, backpack, or under their pillow.' },
  { id: 25, category: 'kids', text: 'Make up a secret handshake together right now.' },
  { id: 26, category: 'kids', text: 'Tell them a story from when you were exactly their age.' },
  { id: 27, category: 'kids', text: 'Let them pick what\'s for dinner tonight, no complaints.' },
  { id: 28, category: 'kids', text: 'Wrestle or roughhouse for 10 minutes. They need it more than you think.' },
  { id: 29, category: 'kids', text: 'Ask them what they want to be when they grow up and dig into the why.' },
  { id: 30, category: 'kids', text: 'Let them stay up 20 minutes late just to talk.' },
  // Brotherhood
  { id: 31, category: 'brotherhood', text: 'Text a friend you haven\'t talked to in 30+ days. No agenda — just check in.' },
  { id: 32, category: 'brotherhood', text: 'Share something you\'re actually struggling with with a man you trust.' },
  { id: 33, category: 'brotherhood', text: 'Send a voice message instead of a text to someone who matters.' },
  { id: 34, category: 'brotherhood', text: 'Tell a friend specifically what you respect about him — today.' },
  { id: 35, category: 'brotherhood', text: 'Invite someone to train with you this week.' },
  { id: 36, category: 'brotherhood', text: 'Check in on a friend who\'s going through something hard.' },
  { id: 37, category: 'brotherhood', text: 'Set up a recurring hang with one friend — monthly is enough to start.' },
  { id: 38, category: 'brotherhood', text: 'Tell your dad or a father figure something you\'re grateful for.' },
  { id: 39, category: 'brotherhood', text: 'Be the one who makes the plan today. Stop waiting for someone else.' },
  { id: 40, category: 'brotherhood', text: 'Reply to someone who reached out to you and you never responded.' },
  { id: 41, category: 'brotherhood', text: 'Share a win with a friend — don\'t only reach out when things are hard.' },
  { id: 42, category: 'brotherhood', text: 'Be honest with someone about where you actually are right now.' },
  { id: 43, category: 'brotherhood', text: 'Introduce two people in your life who should know each other.' },
  { id: 44, category: 'brotherhood', text: 'Ask a mentor or someone you admire for 15 minutes of their time.' },
  { id: 45, category: 'brotherhood', text: 'Write down the names of 3 men who make you better. Reach out to one today.' },
  // Self
  { id: 46, category: 'self', text: 'Spend 10 minutes outside with no phone. Just walk and look around.' },
  { id: 47, category: 'self', text: 'Write down 3 things that are actually going well right now.' },
  { id: 48, category: 'self', text: 'Name the one thing you\'ve been avoiding. Take one small step on it today.' },
  { id: 49, category: 'self', text: 'Read for 15 minutes before picking up your phone this morning.' },
  { id: 50, category: 'self', text: 'Eat one meal today with no screens. Just food.' },
  { id: 51, category: 'self', text: 'Name one thing you\'re proud of yourself for this week.' },
  { id: 52, category: 'self', text: 'Do one thing today just because you enjoy it. Not productive — just good.' },
  { id: 53, category: 'self', text: 'Go to sleep 30 minutes earlier tonight.' },
  { id: 54, category: 'self', text: 'Identify your #1 priority for tomorrow and block time for it now.' },
  { id: 55, category: 'self', text: 'Say no to one thing today that drains you.' },
  { id: 56, category: 'self', text: 'Cancel or defer one commitment you said yes to but shouldn\'t have.' },
  { id: 57, category: 'self', text: 'Write 5 sentences about what you want your life to look like in 5 years.' },
  { id: 58, category: 'self', text: 'Drink a full glass of water before you look at your phone this morning.' },
  { id: 59, category: 'self', text: 'Sit in silence for 5 minutes. No music, no podcast, no phone.' },
  { id: 60, category: 'self', text: 'Ask yourself: am I who I want my kids to become? Act accordingly today.' },
]

function getDayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000)
}

function pickChallenge(skipCategory?: Category): Challenge {
  const day = getDayOfYear()
  const pool = skipCategory ? CHALLENGES.filter(c => c.category !== skipCategory) : CHALLENGES
  return pool[day % pool.length]
}

// ── Heat map types ─────────────────────────────────────────────────────────────

type Connection = { date: string; note?: string }
type HeatSlot   = { id: string; label: string; name: string; connections: Connection[] }

const DEFAULT_SLOTS: HeatSlot[] = [
  { id: 'wife',   label: 'Wife',   name: '', connections: [] },
  { id: 'kid1',   label: 'Kid 1',  name: '', connections: [] },
  { id: 'kid2',   label: 'Kid 2',  name: '', connections: [] },
  { id: 'kid3',   label: 'Kid 3',  name: '', connections: [] },
  { id: 'friend', label: 'Friend', name: '', connections: [] },
]

function heatColor(slot: HeatSlot) {
  if (!slot.connections.length)
    return { bg: 'bg-surface-3/40', border: 'border-border/40', text: 'text-muted-foreground/50', label: 'No data' }
  const days = Math.floor(
    (Date.now() - new Date(slot.connections[slot.connections.length - 1].date).getTime()) / 86_400_000
  )
  if (days <= 1) return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: days === 0 ? 'Today' : 'Yesterday' }
  if (days <= 3) return { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   label: `${days}d ago` }
  return              { bg: 'bg-red-500/10',        border: 'border-red-500/30',     text: 'text-red-400',     label: `${days}d ago` }
}

const HEAT_KEY = 'dad-strength-spirit-heat'
const ACT_KEY  = 'dad-strength-spirit-act'

function getMondayIso(): string {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

const GOD_LABELS: Record<string, string> = {
  atlas:    'Atlas',
  adonis:   'Adonis',
  hercules: 'Hercules',
  ares:     'Ares',
  chronos:  'Chronos',
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SpiritPage() {
  const [mounted, setMounted] = useState(false)
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState('')

  // Stoic
  const [stoic, setStoic] = useState<StoicEntry>(() => getTodaysStoicEntry())
  const [activeGod, setActiveGod] = useState<string | undefined>(undefined)

  // Act
  const [challenge, setChallenge] = useState<Challenge>(() => pickChallenge())
  const [actDone, setActDone]     = useState(false)

  // Heat map
  const [slots, setSlots]         = useState<HeatSlot[]>(DEFAULT_SLOTS)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [logNote, setLogNote]     = useState('')

  useEffect(() => {
    setMounted(true)
    const today = new Date().toISOString().split('T')[0]

    // Get today's entry (deterministic, no async needed)
    setStoic(getTodaysStoicEntry())

    // Read active god from custom config
    try {
      const raw = localStorage.getItem('dad-strength-custom-config')
      if (raw) {
        const cfg = JSON.parse(raw)
        if (cfg.god) setActiveGod(cfg.god)
      }
    } catch { /* ignore */ }

    // Restore act
    try {
      const raw = localStorage.getItem(ACT_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.date === today) {
          setActDone(saved.done ?? false)
          const c = CHALLENGES.find(x => x.id === saved.challengeId)
          if (c) setChallenge(c)
        }
      }
    } catch { /* ignore */ }

    // Restore heat map from localStorage (fast, synchronous)
    let localSlots: HeatSlot[] = DEFAULT_SLOTS
    try {
      const raw = localStorage.getItem(HEAT_KEY)
      if (raw) { localSlots = JSON.parse(raw); setSlots(localSlots) }
    } catch { /* ignore */ }

    // Hydrate from Supabase in background (overwrites localStorage with fresh DB data)
    const ws = getMondayIso()
    setWeekStart(ws);
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        // family_pulse for wife/kid slots
        const { data: pulse } = await supabase
          .from('family_pulse')
          .select('moments')
          .eq('user_id', user.id)
          .eq('week_start', ws)
          .maybeSingle()

        // brotherhood_contacts for friend slot
        const { data: contacts } = await supabase
          .from('brotherhood_contacts')
          .select('name, last_contacted_at')
          .eq('user_id', user.id)
          .order('last_contacted_at', { ascending: false })

        setSlots(prev => {
          let next = [...prev]

          // Merge family_pulse moments into wife/kid slots
          if (pulse?.moments?.length) {
            type Moment = { slot: string; date: string; note?: string }
            const parsed = (pulse.moments as string[]).map((m: string) => {
              try { return JSON.parse(m) as Moment } catch { return null }
            }).filter((m): m is Moment => m !== null)

            next = next.map(slot => {
              if (slot.id === 'friend') return slot
              const slotMoments = parsed.filter(m => m.slot === slot.id)
              if (!slotMoments.length) return slot
              const dbConns: Connection[] = slotMoments.map(m => ({ date: m.date, note: m.note }))
              const localDates = new Set(slot.connections.map(c => c.date))
              const merged = [...slot.connections, ...dbConns.filter(c => !localDates.has(c.date))]
                .sort((a, b) => a.date.localeCompare(b.date))
              return { ...slot, connections: merged }
            })
          }

          // Merge most-recent brotherhood contact into friend slot
          if (contacts && contacts.length > 0) {
            const contact = contacts[0]
            next = next.map(slot => {
              if (slot.id !== 'friend') return slot
              const dbConns: Connection[] = contact.last_contacted_at
                ? [{ date: (contact.last_contacted_at as string).split('T')[0] }]
                : []
              const localDates = new Set(slot.connections.map(c => c.date))
              const merged = [...slot.connections, ...dbConns.filter(c => !localDates.has(c.date))]
                .sort((a, b) => a.date.localeCompare(b.date))
              return { ...slot, name: slot.name || (contact.name as string) || '', connections: merged }
            })
          }

          localStorage.setItem(HEAT_KEY, JSON.stringify(next))
          return next
        })
      } catch { /* ignore — localStorage state remains */ }
    })()
  }, [])

  // ── Act handlers ──────────────────────────────────────────────────────────────

  function saveAct(done: boolean, c: Challenge) {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(ACT_KEY, JSON.stringify({ date: today, done, challengeId: c.id }))
  }

  function handleToggleDone() {
    const next = !actDone
    setActDone(next)
    saveAct(next, challenge)
  }

  function handleNotToday() {
    const next = pickChallenge(challenge.category)
    setChallenge(next)
    setActDone(false)
    saveAct(false, next)
  }

  // ── Heat map handlers ─────────────────────────────────────────────────────────

  async function syncToSupabase(next: HeatSlot[]) {
    if (!userId || !weekStart) return
    try {
      // ── family_pulse (wife / kids) ──────────────────────────────────────────
      const familySlots = next.filter(s => s.id !== 'friend')
      const moments: string[] = []
      for (const slot of familySlots) {
        for (const conn of slot.connections) {
          moments.push(JSON.stringify({ slot: slot.id, date: conn.date, note: conn.note }))
        }
      }
      const wCount = moments.filter(m => { try { return JSON.parse(m).slot === 'wife' } catch { return false } }).length
      const kCount = moments.filter(m => { try { return ['kid1','kid2','kid3'].includes(JSON.parse(m).slot) } catch { return false } }).length
      await supabase.from('family_pulse').upsert({
        user_id: userId,
        week_start: weekStart,
        moments,
        marriage_vibe: wCount > 0 ? Math.min(5, wCount) : null,
        kid_score:     kCount > 0 ? Math.min(5, kCount) : null,
      }, { onConflict: 'user_id,week_start' })

      // ── brotherhood_contacts (friend slot) ──────────────────────────────────
      const friendSlot = next.find(s => s.id === 'friend')
      if (friendSlot && friendSlot.connections.length > 0) {
        const name = friendSlot.name || 'Friend'
        const lastDate = friendSlot.connections[friendSlot.connections.length - 1].date
        const lastContactedAt = new Date(`${lastDate}T12:00:00`).toISOString()
        const { data: existing } = await supabase
          .from('brotherhood_contacts')
          .select('id')
          .eq('user_id', userId)
          .order('created_at')
          .limit(1)
          .maybeSingle()
        if (existing) {
          await supabase.from('brotherhood_contacts')
            .update({ name, last_contacted_at: lastContactedAt })
            .eq('id', (existing as any).id)
        } else {
          await supabase.from('brotherhood_contacts')
            .insert({ user_id: userId, name, last_contacted_at: lastContactedAt })
        }
      }
    } catch (e) {
      console.error('Connection sync error:', e)
    }
  }

  function persistSlots(next: HeatSlot[]) {
    setSlots(next)
    localStorage.setItem(HEAT_KEY, JSON.stringify(next))
    syncToSupabase(next)
  }

  function handleRename(id: string) {
    persistSlots(slots.map(s => s.id === id ? { ...s, name: editName.trim() || s.label } : s))
    setEditingId(null)
    setEditName('')
  }

  function handleLogConnection(id: string) {
    const today = new Date().toISOString().split('T')[0]
    persistSlots(slots.map(s => {
      if (s.id !== id) return s
      const rest = s.connections.filter(c => c.date !== today)
      return { ...s, connections: [...rest, { date: today, note: logNote.trim() || undefined }] }
    }))
    setLoggingId(null)
    setLogNote('')
  }

  function handleUndoConnection(id: string) {
    const today = new Date().toISOString().split('T')[0]
    persistSlots(slots.map(s =>
      s.id === id ? { ...s, connections: s.connections.filter(c => c.date !== today) } : s
    ))
  }

  if (!mounted) return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <AppHeader />
      <main className="max-w-md mx-auto px-6 pt-6 space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="ds-card p-5 animate-pulse space-y-4">
            <div className="h-3 bg-muted rounded w-1/4" />
            <div className="h-14 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        ))}
      </main>
    </div>
  )

  const today     = new Date().toISOString().split('T')[0]
  const catConfig = CATEGORY_CONFIG[challenge.category]

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <AppHeader />
      <main className="max-w-md mx-auto px-6 pt-6">

        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2 font-display">Inner Life</p>
          <h1 className="font-display text-4xl tracking-[0.1em] uppercase">Spirit</h1>
        </div>

        <motion.div className="space-y-6" initial="hidden" animate="visible" variants={staggerContainer}>

          {/* ── Morning Protocol ──────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <div className="ds-card overflow-hidden">

              <div className="p-5">
                <MorningProtocol />
              </div>
            </div>
          </motion.div>

          {/* ── Stoic for Today ───────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <div className="ds-card overflow-hidden">

              <div className="p-5 space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ScrollText size={14} className="text-brand" strokeWidth={2.5} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground font-display">Stoic for Today</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                      {stoic.theme}
                    </span>
                    {activeGod && GOD_LABELS[activeGod] && (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-brand/10 text-brand">
                        {GOD_LABELS[activeGod]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quote */}
                <blockquote className="space-y-2">
                  <p className="text-sm font-semibold leading-relaxed text-foreground italic">
                    &ldquo;{stoic.quote}&rdquo;
                  </p>
                  <footer className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                    — {stoic.author}{stoic.work ? `, ${stoic.work}` : ''}
                  </footer>
                </blockquote>

                {/* Reflection */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {stoic.reflection}
                </p>

                {/* Meditation line */}
                <div className="border-t border-border/40 pt-4">
                  <p className="text-sm font-semibold text-foreground italic text-center leading-snug">
                    {stoic.meditation}
                  </p>
                </div>

                {/* Action + Journal */}
                <div className="border-t border-border/40 pt-4 space-y-3">
                  <div className="flex gap-2.5">
                    <div className="flex-shrink-0 mt-0.5">
                      <ArrowRight size={12} className="text-brand" strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand mb-1">Action</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{stoic.action}</p>
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <div className="flex-shrink-0 mt-0.5">
                      <PenLine size={12} className="text-muted-foreground" strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Journal</p>
                      <p className="text-xs text-muted-foreground leading-relaxed italic">{stoic.journal}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>

          {/* ── The Act ──────────────────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <div className="ds-card overflow-hidden">

              <div className="p-5 space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-brand" strokeWidth={2.5} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground font-display">The Act</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${catConfig.bg} ${catConfig.color}`}>
                    {catConfig.label}
                  </span>
                </div>

                {/* Challenge text */}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={challenge.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className={`text-base font-semibold leading-relaxed transition-colors ${
                      actDone ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground'
                    }`}
                  >
                    {challenge.text}
                  </motion.p>
                </AnimatePresence>

                {/* Actions */}
                <div className="flex gap-2.5">
                  <button
                    onClick={handleToggleDone}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
                      actDone
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-brand text-background brand-glow hover:bg-brand/90'
                    }`}
                  >
                    {actDone && <Check size={12} strokeWidth={3} />}
                    {actDone ? 'Done' : 'Mark Done'}
                  </button>
                  {!actDone && (
                    <button
                      onClick={handleNotToday}
                      className="px-4 py-3 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all text-xs font-bold uppercase tracking-widest active:scale-95"
                    >
                      Not today
                    </button>
                  )}
                </div>

              </div>
            </div>
          </motion.div>

          {/* ── Connection Heat Map ───────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <div className="ds-card overflow-hidden">

              <div className="p-5 space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-brand" strokeWidth={2.5} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground font-display">Connection</p>
                  </div>
                  <button
                    onClick={() => { setIsEditing(!isEditing); setEditingId(null) }}
                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isEditing ? 'Done' : 'Edit Names'}
                  </button>
                </div>

                {/* Slots */}
                <div className="space-y-2">
                  {slots.map(slot => {
                    const { bg, border, text, label } = heatColor(slot)
                    const displayName = slot.name || slot.label
                    const loggedToday = slot.connections.some(c => c.date === today)

                    /* Edit mode */
                    if (isEditing) {
                      return (
                        <div key={slot.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-surface-3/30">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-14 flex-shrink-0">
                            {slot.label}
                          </span>
                          {editingId === slot.id ? (
                            <div className="flex gap-2 flex-1 items-center">
                              <input
                                autoFocus
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRename(slot.id)}
                                placeholder={slot.label}
                                className="flex-1 bg-transparent text-sm text-foreground outline-none border-b border-brand pb-0.5"
                              />
                              <button onClick={() => handleRename(slot.id)} className="text-brand text-xs font-black uppercase tracking-wider">
                                Save
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingId(slot.id); setEditName(slot.name) }}
                              className="flex-1 text-left text-sm font-semibold text-foreground hover:text-brand transition-colors"
                            >
                              {displayName}
                              <span className="text-muted-foreground/40 font-normal text-xs ml-2">tap to rename</span>
                            </button>
                          )}
                        </div>
                      )
                    }

                    /* Normal mode */
                    return (
                      <div key={slot.id}>
                        <button
                          onClick={() => {
                            if (loggedToday) {
                              handleUndoConnection(slot.id)
                            } else {
                              setLoggingId(loggingId === slot.id ? null : slot.id)
                              setLogNote('')
                            }
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] ${bg} ${border}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                              loggedToday ? 'bg-emerald-500/20 border-emerald-500/40' : 'border-border/60'
                            }`}>
                              {loggedToday && <Check size={10} className="text-emerald-400" strokeWidth={3} />}
                            </div>
                            <span className="text-sm font-bold text-foreground">{displayName}</span>
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${text}`}>
                            {loggedToday ? 'Logged ✓' : label}
                          </span>
                        </button>

                        {/* Note expander */}
                        <AnimatePresence>
                          {loggingId === slot.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-2 pb-1 space-y-2">
                                <input
                                  autoFocus
                                  value={logNote}
                                  onChange={e => setLogNote(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleLogConnection(slot.id)}
                                  placeholder="What did you do? (optional)"
                                  className="w-full bg-surface-3/50 border border-border/50 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-brand transition-colors"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleLogConnection(slot.id)}
                                    className="flex-1 py-2.5 bg-brand text-background text-xs font-black uppercase tracking-widest rounded-xl active:scale-95 brand-glow"
                                  >
                                    Log Connection
                                  </button>
                                  <button
                                    onClick={() => setLoggingId(null)}
                                    className="px-4 py-2.5 border border-border/50 text-muted-foreground rounded-xl text-xs font-bold uppercase tracking-wider active:scale-95"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 pt-1">
                  {[
                    { dot: 'bg-emerald-500', label: 'Recent' },
                    { dot: 'bg-amber-500',   label: '3+ days' },
                    { dot: 'bg-red-500',     label: '7+ days' },
                  ].map(({ dot, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${dot} opacity-60`} />
                      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-medium">{label}</span>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </motion.div>

        </motion.div>
      </main>
      <BottomNav />
    </div>
  )
}
