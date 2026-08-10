'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, fadeUp } from '../../components/ui/motion'
import { Zap, Check, ScrollText, ArrowRight, PenLine } from 'lucide-react'
import BottomNav from '../../components/BottomNav'
import AppHeader from '../../components/AppHeader'
import MorningProtocol from '../../components/MorningProtocol'
import { type StoicEntry, getTodaysStoicEntry } from '../../data/stoicEntries'

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

const ACT_KEY  = 'dad-strength-spirit-act'

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

  // Stoic
  const [stoic, setStoic] = useState<StoicEntry>(() => getTodaysStoicEntry())
  const [activeGod, setActiveGod] = useState<string | undefined>(undefined)

  // Act
  const [challenge, setChallenge] = useState<Challenge>(() => pickChallenge())
  const [actDone, setActDone]     = useState(false)

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

  if (!mounted) return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <AppHeader />
      <main className="max-w-md mx-auto px-6 pt-6 space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card rounded-2xl border border-border/50 p-5 animate-pulse space-y-4">
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
          <p className="telemetry mb-1">SYS // CORE.REACTOR</p>
          <h1 className="font-display text-4xl tracking-[0.1em] uppercase">Reactor</h1>
        </div>

        <motion.div className="space-y-6" initial="hidden" animate="visible" variants={staggerContainer}>

          {/* ── Morning Protocol ──────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
              <div className="h-0.5 w-full bg-gradient-to-r from-brand/60 via-brand to-brand/60" />
              <div className="p-5">
                <MorningProtocol />
              </div>
            </div>
          </motion.div>

          {/* ── Stoic for Today ───────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
              <div className="h-0.5 w-full bg-gradient-to-r from-brand/60 via-brand to-brand/60" />
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
            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
              <div className="h-0.5 w-full bg-gradient-to-r from-brand/60 via-brand to-brand/60" />
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

        </motion.div>
      </main>
      <BottomNav />
    </div>
  )
}
