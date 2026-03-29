'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../utils/supabase/client'
import { ChevronLeft, Target, Loader2, Check, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

export default function MissionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [progress, setProgress] = useState(0)
  const [milestone, setMilestone] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('mission_title, mission_description, mission_progress, mission_milestone')
        .eq('id', user.id)
        .maybeSingle()

      if (profile) {
        setTitle(profile.mission_title || '')
        setDescription(profile.mission_description || '')
        setProgress(profile.mission_progress ?? 0)
        setMilestone(profile.mission_milestone || '')
      }

      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    await supabase.from('user_profiles').update({
      mission_title: title,
      mission_description: description,
      mission_progress: Math.min(100, Math.max(0, progress)),
      mission_milestone: milestone,
    }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)

    // Mark first_week_checklist set_mission as done
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_week_checklist')
      .eq('id', userId)
      .maybeSingle()

    if (profile?.first_week_checklist) {
      const updated = { ...profile.first_week_checklist, set_mission: true }
      await supabase.from('user_profiles').update({ first_week_checklist: updated }).eq('id', userId)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="flex items-center gap-4 border-b border-border bg-background/90 px-6 py-4 backdrop-blur-md sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black italic uppercase tracking-tight">My Mission</h1>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6">

        {/* Intro */}
        <div className="text-center pt-2 pb-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/10 mb-4">
            <Target size={28} className="text-brand" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            What are you building toward? Define your mission and track your progress here.
          </p>
        </div>

        {/* Mission Title */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Mission Name</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Financial Freedom, Run a Marathon, Be Present"
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand transition-colors"
            maxLength={60}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">What does it look like when you get there?</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Be specific. Paint the picture. Why does this matter to your family?"
            rows={3}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand transition-colors resize-none leading-relaxed"
            maxLength={300}
          />
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Progress</label>
            <span className="text-sm font-black text-brand">{progress}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={e => setProgress(Number(e.target.value))}
            className="w-full accent-brand"
          />
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Next Milestone */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium flex items-center gap-1.5">
            <TrendingUp size={11} /> Next Milestone
          </label>
          <input
            type="text"
            value={milestone}
            onChange={e => setMilestone(e.target.value)}
            placeholder="e.g. Hit $10k/month, Run a 5k, 30 days alcohol-free"
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand transition-colors"
            maxLength={80}
          />
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || !title}
          className="w-full flex items-center justify-center gap-2.5 bg-brand hover:bg-brand/90 disabled:opacity-50 text-foreground font-black py-4 rounded-xl uppercase tracking-widest text-sm transition-all active:scale-[0.98]"
        >
          {saving
            ? <Loader2 size={16} className="animate-spin" />
            : saved
              ? <><Check size={16} /> Saved!</>
              : 'Save Mission'
          }
        </button>

        {/* Preview card */}
        {title && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-card border border-border p-5 space-y-3"
          >
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Mission Preview</p>
            <h3 className="text-lg font-black italic uppercase tracking-tight">{title}</h3>
            {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Progress</span>
                <span className="font-black text-brand">{progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
            {milestone && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Next:</span> {milestone}
              </p>
            )}
          </motion.div>
        )}

      </main>
    </div>
  )
}
