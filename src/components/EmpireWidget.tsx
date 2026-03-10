'use client'

import { TrendingUp, DollarSign, Youtube, MonitorSmartphone, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function EmpireWidget() {
  // Mock data - in production, this would come from a DB
  const stats = {
    revenue: 125000,
    target: 1000000,
    youtube: 12450,
    mrr: 2100
  }

  const percentage = Math.round((stats.revenue / stats.target) * 100)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          <h3 className="font-black text-white uppercase tracking-tighter italic">The Empire</h3>
        </div>
        <Link href="/profile/empire" className="text-gray-600 hover:text-white transition-colors">
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Operation Freedom Progress */}
      <div className="bg-gray-950/50 p-4 rounded-2xl border border-gray-800">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Operation: Freedom</p>
            <p className="font-bold text-sm text-white">${(stats.revenue / 1000).toFixed(0)}K <span className="text-gray-600 text-[10px]">/ $1M</span></p>
          </div>
          <span className="text-[10px] font-black text-indigo-400">{percentage}%</span>
        </div>
        <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden border border-gray-800">
          <div 
            className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)] transition-all duration-1000"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
          <Youtube size={16} className="text-red-500" />
          <div>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Subs</p>
            <p className="text-xs font-bold text-white">{stats.youtube.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
          <MonitorSmartphone size={16} className="text-indigo-400" />
          <div>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">MRR</p>
            <p className="text-xs font-bold text-white">${stats.mrr.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
