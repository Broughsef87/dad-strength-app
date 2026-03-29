'use client';

import { useState } from 'react';
import { ArrowLeft, Zap, Clock, ChefHat, Moon, Brain, Check, Copy, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BottomNav from '../../components/BottomNav';

const AUTOMATION_PLAYS = [
  {
    icon: ChefHat,
    title: 'Batch Cook Protocol',
    category: 'Fuel',
    time: '2 hrs / week',
    description: "One Sunday session feeds you clean all week. No daily decisions, no bad choices at 7 PM when you're exhausted.",
    steps: [
      'Sunday 7 PM: 3 proteins (ground beef, chicken thighs, eggs) + 2 carb sources (rice, oats)',
      'Portion into containers: 5 lunches, 5 dinners. Done.',
      'Breakfast is always the same — 3 eggs + oats. Zero decision fatigue.',
      'Keep a protein bar in the gym bag, car, and desk. Never be caught off guard.',
    ],
    tag: 'Save 45 min/day',
  },
  {
    icon: Clock,
    title: 'Morning Stack (Pre-Baby)',
    category: 'Routine',
    time: '5 AM window',
    description: "The hour before everyone wakes up is yours. Protect it. Same sequence every day = zero ramp-up time.",
    steps: [
      '5:00 AM — Water + black coffee. No phone for 10 min.',
      '5:10 AM — 20-min workout (body or mind, never skip both)',
      '5:35 AM — Top 3 tasks for the day. Written down. Nothing else counts.',
      '5:45 AM — Deep work block until baby wakes.',
    ],
    tag: 'Protect 2–3 hrs/day',
  },
  {
    icon: Moon,
    title: 'Shutdown Ritual',
    category: 'Recovery',
    time: '9 PM',
    description: 'Your brain needs a hard stop or it keeps running background processes all night. This closes the tabs.',
    steps: [
      'Review what got done (honest, 2 min)',
      "Write tomorrow's first task before you close the laptop",
      'No screens 30 min before bed — non-negotiable',
      'Same bedtime every night. Sleep is the performance drug you\'re ignoring.',
    ],
    tag: 'Better sleep quality',
  },
  {
    icon: Brain,
    title: 'Decision Batch',
    category: 'Mental Load',
    time: '15 min / week',
    description: 'Every micro-decision you make costs energy. Batch the recurring ones once and stop making them daily.',
    steps: [
      "Sunday: plan the week's workouts. Written. Done.",
      'Sunday: pick 5 meals for the week. No daily "what should I eat" loops.',
      "Keep a running 'maybe later' list for non-urgent ideas — get them out of your head.",
      "One weekly review: what's working, what's not, what changes.",
    ],
    tag: 'Reduce cognitive load',
  },
  {
    icon: Zap,
    title: 'Nap Window Squeeze',
    category: 'Time',
    time: '45 min',
    description: "Baby's nap is a compressed work sprint, not a break. Have the task ready before they sleep.",
    steps: [
      'Know the ONE thing to work on before the nap starts',
      'Phone on DND. Laptop open and ready.',
      "Work in 25-min blocks. Don't context-switch.",
      'Stop 5 min before expected wake — wind-down buffer.',
    ],
    tag: 'Reclaim nap windows',
  },
  {
    icon: ChefHat,
    title: 'Evening Handoff',
    category: 'Partnership',
    time: '5 min / day',
    description: 'Two parents, one baby, no coordination = constant friction. This eliminates 80% of it.',
    steps: [
      'End-of-day check-in: what does tomorrow look like?',
      'Who has the morning? Who has the nap window? Agreed, not assumed.',
      'One shared grocery list. Never duplicate-buy, never run out.',
      'No big decisions after 8 PM — you\'re both depleted.',
    ],
    tag: 'Reduce household friction',
  },
];

function PlayCard({ play }: { play: typeof AUTOMATION_PLAYS[0] }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const Icon = play.icon;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${play.title}\n\n${play.description}\n\n${play.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`bg-card border rounded-2xl p-5 transition-all cursor-pointer ${
        expanded ? 'border-brand/30' : 'border-border hover:border-border/80'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand/10 rounded-xl">
            <Icon size={16} className="text-brand" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{play.category} · {play.time}</p>
            <h3 className="font-black text-base text-foreground leading-tight mt-0.5">{play.title}</h3>
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider text-brand bg-brand/10 px-2 py-1 rounded-lg border border-brand/20 shrink-0">
          {play.tag}
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{play.description}</p>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="space-y-2.5 mb-4">
            {play.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-[10px] font-black text-brand mt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <p className="text-xs text-foreground/80 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-brand transition-colors"
          >
            {copied ? <CheckCheck size={12} className="text-brand" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy play'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SystemsPage() {
  const router = useRouter();
  const [habitChecks, setHabitChecks] = useState<Record<string, boolean>>({});

  const DAILY_HABITS = [
    { id: 'workout', label: 'Movement (20+ min)' },
    { id: 'batch_food', label: 'Ate prepped food' },
    { id: 'top3', label: 'Worked top 3 tasks' },
    { id: 'shutdown', label: 'Shutdown ritual done' },
    { id: 'present', label: '30 min phone-free with family' },
  ];

  const toggleHabit = (id: string) => {
    setHabitChecks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const checkedCount = Object.values(habitChecks).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-28 p-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="p-2 bg-card rounded-xl text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <Zap className="w-8 h-8 text-brand" />
          <h1 className="font-black text-2xl tracking-tighter italic uppercase">Systems</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-8">

        <div className="bg-card border border-brand/20 rounded-3xl p-6">
          <p className="text-[10px] font-black text-brand uppercase tracking-widest mb-2">The Principle</p>
          <p className="font-black text-lg leading-tight text-foreground mb-3">
            Automate the noise.<br />Show up for what matters.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every system here is designed to buy back time and reduce the decisions that drain you —
            so you have more of yourself left for your family.
          </p>
        </div>

        {/* Daily habit tracker */}
        <div className="bg-card border border-border rounded-3xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Daily Stack</p>
              <h2 className="font-black text-lg mt-0.5">Today&apos;s 5</h2>
            </div>
            <div className={`text-2xl font-black tabular-nums ${checkedCount === 5 ? 'text-brand' : 'text-foreground'}`}>
              {checkedCount}/5
            </div>
          </div>
          <div className="space-y-2">
            {DAILY_HABITS.map(habit => (
              <button
                key={habit.id}
                onClick={() => toggleHabit(habit.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  habitChecks[habit.id]
                    ? 'bg-brand/10 border-brand/30 text-brand'
                    : 'bg-background/40 border-border text-muted-foreground hover:border-border/60'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                  habitChecks[habit.id] ? 'bg-brand border-brand' : 'border-border'
                }`}>
                  {habitChecks[habit.id] && <Check size={11} className="text-white" />}
                </div>
                <span className="text-xs font-bold">{habit.label}</span>
              </button>
            ))}
          </div>
          {checkedCount === 5 && (
            <p className="mt-4 text-center text-[10px] font-black text-brand uppercase tracking-widest">
              System locked in. Good day.
            </p>
          )}
        </div>

        {/* Automation plays */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Playbook</p>
              <h2 className="font-black text-lg mt-0.5">Life Automation Plays</h2>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {AUTOMATION_PLAYS.length} plays
            </span>
          </div>
          <div className="space-y-3">
            {AUTOMATION_PLAYS.map((play) => (
              <PlayCard key={play.title} play={play} />
            ))}
          </div>
        </div>

        <div className="bg-card/60 border border-dashed border-border rounded-2xl p-5 text-center">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Coming Soon</p>
          <p className="text-xs text-muted-foreground">AI-personalized system recommendations based on your week.</p>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
