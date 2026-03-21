'use client'

import { useState } from 'react'
import { Heart, Plus, Trash2, Star } from 'lucide-react'

interface Deposit {
  id: string
  text: string
  timestamp: string
}

const FAMILY_KEY = 'dad-strength-relationship-ledger'
const PARTNER_KEY = 'dad-strength-partner-ledger'
const INTENTION_KEY = 'dad-strength-relationship-intention'
const todayKey = () => new Date().toLocaleDateString()

function loadDeposits(key: string): Deposit[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(key)
    if (!saved) return []
    const data = JSON.parse(saved)
    if (data.date !== todayKey()) return []
    return data.deposits || []
  } catch { return [] }
}

function loadIntention(): string {
  if (typeof window === 'undefined') return ''
  try {
    const saved = localStorage.getItem(INTENTION_KEY)
    if (!saved) return ''
    const data = JSON.parse(saved)
    // Intention is weekly, not daily
    const monday = new Date()
    monday.setDate(monday.getDate() - monday.getDay() + 1)
    const weekKey = monday.toLocaleDateString()
    if (data.week !== weekKey) return ''
    return data.intention || ''
  } catch { return '' }
}

export default function RelationshipLedger() {
  const [familyDeposits, setFamilyDeposits] = useState<Deposit[]>(() => loadDeposits(FAMILY_KEY))
  const [partnerDeposits, setPartnerDeposits] = useState<Deposit[]>(() => loadDeposits(PARTNER_KEY))
  const [familyInput, setFamilyInput] = useState('')
  const [partnerInput, setPartnerInput] = useState('')
  const [intention, setIntention] = useState(() => loadIntention())
  const [activeTab, setActiveTab] = useState<'partner' | 'family'>('partner')
  const target = 3

  const persist = (key: string, deposits: Deposit[]) => {
    localStorage.setItem(key, JSON.stringify({ date: todayKey(), deposits }))
  }

  const saveIntention = (val: string) => {
    const monday = new Date()
    monday.setDate(monday.getDate() - monday.getDay() + 1)
    const weekKey = monday.toLocaleDateString()
    localStorage.setItem(INTENTION_KEY, JSON.stringify({ week: weekKey, intention: val }))
  }

  const addDeposit = (type: 'family' | 'partner') => {
    const text = type === 'family' ? familyInput : partnerInput
    if (!text.trim()) return
    const newDeposit: Deposit = {
      id: Math.random().toString(36).substring(2, 9),
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    if (type === 'family') {
      const next = [...familyDeposits, newDeposit].slice(-target)
      setFamilyDeposits(next)
      persist(FAMILY_KEY, next)
      setFamilyInput('')
    } else {
      const next = [...partnerDeposits, newDeposit].slice(-target)
      setPartnerDeposits(next)
      persist(PARTNER_KEY, next)
      setPartnerInput('')
    }
  }

  const removeDeposit = (type: 'family' | 'partner', id: string) => {
    if (type === 'family') {
      const next = familyDeposits.filter(d => d.id !== id)
      setFamilyDeposits(next)
      persist(FAMILY_KEY, next)
    } else {
      const next = partnerDeposits.filter(d => d.id !== id)
      setPartnerDeposits(next)
      persist(PARTNER_KEY, next)
    }
  }

  const DepositList = ({ type, deposits, input, setInput }: {
    type: 'family' | 'partner'
    deposits: Deposit[]
    input: string
    setInput: (v: string) => void
  }) => (
    <div className="space-y-3">
      <div className="flex gap-1.5 mb-4">
        {[...Array(target)].map((_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
            i < deposits.length
              ? type === 'partner' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]' : 'bg-brand shadow-[0_0_8px_rgba(232,87,42,0.3)]'
              : 'bg-muted'
          }`} />
        ))}
      </div>

      <div className="space-y-2">
        {deposits.map(d => (
          <div key={d.id} className="flex items-center justify-between p-2.5 rounded-xl bg-background/50 border border-border group animate-in fade-in slide-in-from-left-1">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground font-medium truncate italic">"{d.text}"</p>
              <p className="text-[9px] text-muted-foreground font-medium uppercase mt-0.5">{d.timestamp}</p>
            </div>
            <button onClick={() => removeDeposit(type, d.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); addDeposit(type) }} className="relative">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={type === 'partner' ? "What'd you do for her today?" : "Act of service for the kids..."}
          className="w-full bg-background border border-border rounded-xl p-3 pr-12 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-rose-500/50 transition-colors"
        />
        <button type="submit" className={`absolute right-2 top-1.5 p-1.5 rounded-lg transition-colors shadow-lg ${
          type === 'partner' ? 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/20' : 'bg-brand hover:bg-brand/80 shadow-brand/20'
        } text-white`}>
          <Plus size={16} />
        </button>
      </form>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Heart className="w-5 h-5 text-rose-500" />
        <h3 className="font-bold text-foreground uppercase tracking-tighter italic">Relationship Ledger</h3>
      </div>

      {/* Weekly Intention */}
      <div className="bg-card/50 p-4 rounded-xl border border-border space-y-2">
        <div className="flex items-center gap-1.5">
          <Star size={11} className="text-rose-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Weekly Intention</p>
        </div>
        <input
          type="text"
          value={intention}
          onChange={e => { setIntention(e.target.value); saveIntention(e.target.value) }}
          placeholder="How will you invest in your marriage this week?"
          className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-rose-500/50 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="bg-card/50 p-4 rounded-xl border border-border">
        <div className="flex rounded-xl bg-muted p-1 mb-4">
          <button
            onClick={() => setActiveTab('partner')}
            className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'partner' ? 'bg-rose-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Partner
          </button>
          <button
            onClick={() => setActiveTab('family')}
            className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'family' ? 'bg-brand text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Kids
          </button>
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
            {activeTab === 'partner' ? 'Daily Deposits — Her' : 'Daily Deposits — Kids'}
          </p>
          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
            {activeTab === 'partner' ? partnerDeposits.length : familyDeposits.length}/{target}
          </span>
        </div>

        {activeTab === 'partner' ? (
          <DepositList type="partner" deposits={partnerDeposits} input={partnerInput} setInput={setPartnerInput} />
        ) : (
          <DepositList type="family" deposits={familyDeposits} input={familyInput} setInput={setFamilyInput} />
        )}
      </div>

      <p className="text-[10px] text-center text-muted-foreground/40 uppercase font-black tracking-widest">
        Small wins build the legacy.
      </p>
    </div>
  )
}
