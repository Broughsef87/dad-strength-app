'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Brain, Dumbbell, Flame } from 'lucide-react'

const items = [
  { label: 'HQ', href: '/dashboard', icon: Home },
  { label: 'Mind', href: '/mind', icon: Brain },
  { label: 'Body', href: '/body', icon: Dumbbell },
  { label: 'Spirit', href: '/spirit', icon: Flame },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-sm overflow-hidden"
      style={{
        background: 'linear-gradient(0deg, #0a0a0a 0%, #141414 100%)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.04) inset, 0 -8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {/* Carbon fiber texture on nav bar */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          repeating-linear-gradient(45deg, transparent 0px, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px),
          repeating-linear-gradient(-45deg, transparent 0px, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)
        `
      }} />
      {/* Steel top highlight */}
      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{
        background: 'linear-gradient(90deg, transparent 5%, rgba(140,140,140,0.18) 30%, rgba(170,170,170,0.3) 50%, rgba(140,140,140,0.18) 70%, transparent 95%)'
      }} />
      <div className="relative flex items-stretch">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 relative transition-colors ${
                active ? 'text-brand' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {/* Active indicator — glowing red top line */}
              {active && (
                <span
                  className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-brand"
                  style={{ boxShadow: '0 0 8px 1px rgba(230,26,26,0.6), 0 0 20px 2px rgba(230,26,26,0.2)' }}
                />
              )}
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span className={`text-[10px] font-medium tracking-wide ${active ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
