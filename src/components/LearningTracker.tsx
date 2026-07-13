'use client'

// ── Currently Learning ─────────────────────────────────────────────────────────
// Growth-mindset skill tracker for the Neural tab. Track the skills you're
// actively developing (hobby or professional), the milestone you're working
// toward, and log practice. A couple words and a tap — never a journal.
// A skill's growth loop: set a milestone → practice → reach it → set the next.

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Sprout, Plus, X, Check, Target, TrendingUp, Loader2 } from 'lucide-react'
import { localDay } from '../utils/day'

type Category = 'hobby' | 'professional'

interface Skill {
  id: string
  skill: string
  category: Category
  milestone: string | null
  sessions: number
  milestones_hit: number
  last_practiced: string | null
}

const MAX_ACTIVE = 3

function agoLabel(date: string | null): string {
  if (!date) return 'not yet'
  const today = localDay()
  if (date === today) return 'today'
  const d = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000)
  if (d <= 1) return 'yesterday'
  return `${d}d ago`
}

export default function LearningTracker() {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('hobby')
  const [milestone, setMilestone] = useState('')

  // Inline milestone editing, keyed by skill id.
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      setUser(user)
      if (!user) { setLoading(false); return }
      supabase
        .from('user_learning')
        .select('id, skill, category, milestone, sessions, milestones_hit, last_practiced')
        .eq('user_id', user.id).eq('active', true)
        .order('created_at', { ascending: true })
        .then(({ data }: { data: Skill[] | null }) => {
          setSkills(data ?? [])
          setLoading(false)
        })
    })
  }, [supabase])

  const totalMastered = skills.reduce((n, s) => n + s.milestones_hit, 0)

  const addSkill = async () => {
    const s = name.trim()
    if (!s || !user || skills.length >= MAX_ACTIVE) return
    const m = milestone.trim() || null
    const { data } = await supabase.from('user_learning')
      .insert({ user_id: user.id, skill: s, category, milestone: m })
      .select('id, skill, category, milestone, sessions, milestones_hit, last_practiced')
      .single()
    if (data) setSkills(prev => [...prev, data as Skill])
    setName(''); setMilestone(''); setCategory('hobby'); setAdding(false)
  }

  const patch = (id: string, fields: Partial<Skill>) => {
    setSkills(prev => prev.map(s => (s.id === id ? { ...s, ...fields } : s)))
    void supabase.from('user_learning')
      .update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
  }

  const logPractice = (s: Skill) =>
    patch(s.id, { sessions: s.sessions + 1, last_practiced: localDay() })

  const reachMilestone = (s: Skill) =>
    patch(s.id, { milestones_hit: s.milestones_hit + 1, milestone: null })

  const archive = (id: string) => {
    setSkills(prev => prev.filter(s => s.id !== id))
    void supabase.from('user_learning')
      .update({ active: false, updated_at: new Date().toISOString() }).eq('id', id)
  }

  const saveMilestone = (id: string) => {
    patch(id, { milestone: editVal.trim() || null })
    setEditId(null); setEditVal('')
  }

  return (
    <div className="glass-card relative rounded-xl p-6 pt-8">
      <span className="panel-id">MND-02 // ACQUISITION</span>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Sprout size={16} className="text-brand" />
          <h3 className="font-display font-semibold text-sm uppercase tracking-wide">Currently Learning</h3>
        </div>
        {totalMastered > 0 && (
          <span className="telemetry-dim flex items-center gap-1">
            <TrendingUp size={10} /> {totalMastered} REACHED
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-5">
        Stay a student. Track what you&apos;re building into yourself — a craft, a hobby, a professional edge.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-4">
          <Loader2 size={14} className="animate-spin" /> <span className="text-xs">Loading…</span>
        </div>
      ) : (
        <div className="space-y-3">
          {skills.length === 0 && !adding && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-brand/30 pl-3">
              Nothing tracked yet. Pick one skill to grow — depth beats breadth.
            </p>
          )}

          {skills.map(s => (
            <div key={s.id} className="panel-cut-sm border border-border/70 bg-background/40 p-3.5 group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-sm uppercase tracking-wide text-foreground truncate">{s.skill}</p>
                  <span className={`inline-block mt-1 text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 border rounded-sm ${
                    s.category === 'professional' ? 'border-brand/40 text-brand' : 'border-steel/40 text-steel'
                  }`}>
                    {s.category}
                  </span>
                </div>
                <button onClick={() => archive(s.id)} title="Archive (mastered / paused)"
                  className="text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <X size={13} />
                </button>
              </div>

              {/* Milestone — the current target */}
              <div className="mt-2.5 flex items-center gap-2">
                <Target size={11} className="text-brand/70 shrink-0" />
                {editId === s.id ? (
                  <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveMilestone(s.id)}
                    onBlur={() => saveMilestone(s.id)}
                    placeholder="Working toward…"
                    className="flex-1 bg-transparent border-b border-border focus:border-brand text-xs text-foreground py-0.5 outline-none placeholder:text-muted-foreground/50" />
                ) : (
                  <button onClick={() => { setEditId(s.id); setEditVal(s.milestone ?? '') }}
                    className="flex-1 text-left text-xs text-foreground/80 hover:text-foreground transition-colors truncate">
                    {s.milestone || <span className="text-muted-foreground/60 italic">Set a milestone…</span>}
                  </button>
                )}
              </div>

              {/* Momentum */}
              <p className="telemetry-dim mt-2">
                {s.sessions} SESSION{s.sessions === 1 ? '' : 'S'} · LAST {agoLabel(s.last_practiced).toUpperCase()}
              </p>

              {/* Actions */}
              <div className="flex gap-2 mt-2.5">
                <button onClick={() => logPractice(s)}
                  className="panel-cut-sm flex-1 py-2 bg-brand/10 border border-brand/40 text-brand text-[10px] font-semibold uppercase tracking-widest hover:bg-brand/20 transition-colors">
                  + Log Practice
                </button>
                {s.milestone && (
                  <button onClick={() => reachMilestone(s)} title="Milestone reached — set the next one"
                    className="panel-cut-sm py-2 px-3 border border-border/70 text-muted-foreground text-[10px] font-semibold uppercase tracking-widest hover:text-brand hover:border-brand/50 transition-colors flex items-center gap-1">
                    <Check size={11} /> Reached
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add form */}
          {adding ? (
            <div className="panel-cut-sm border border-brand/30 bg-background/40 p-3.5 space-y-3">
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder="What are you learning?"
                className="w-full bg-transparent border-b border-border focus:border-brand text-sm text-foreground py-1 outline-none placeholder:text-muted-foreground/50" />
              <div className="flex gap-2">
                {(['hobby', 'professional'] as Category[]).map(c => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`flex-1 text-[9px] font-mono uppercase tracking-widest py-1.5 border rounded-sm transition-colors ${
                      category === c ? 'border-brand text-brand bg-brand/10' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
              <input value={milestone} onChange={e => setMilestone(e.target.value)}
                placeholder="First milestone (optional)…"
                className="w-full bg-transparent border-b border-border focus:border-brand text-xs text-foreground py-1 outline-none placeholder:text-muted-foreground/50" />
              <div className="flex gap-2">
                <button onClick={() => void addSkill()} disabled={!name.trim()}
                  className="panel-cut-sm flex-1 py-2 bg-brand text-white text-[10px] font-semibold uppercase tracking-widest hover:bg-brand/90 disabled:opacity-40 transition-colors">
                  Start Tracking
                </button>
                <button onClick={() => { setAdding(false); setName(''); setMilestone('') }}
                  className="panel-cut-sm py-2 px-3 border border-border/70 text-muted-foreground text-[10px] font-semibold uppercase tracking-widest hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : skills.length < MAX_ACTIVE ? (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1">
              <Plus size={14} /> Add a skill
            </button>
          ) : (
            <p className="telemetry-dim pt-1">FOCUS SLOTS FULL · MASTER ONE BEFORE ADDING ANOTHER</p>
          )}
        </div>
      )}
    </div>
  )
}
