'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Shield, Brain, Dumbbell, Flame } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'hq', label: 'HQ', path: '/dashboard', icon: Shield },
  { id: 'mind', label: 'Mind', path: '/mind', icon: Brain },
  { id: 'body', label: 'Body', path: '/body', icon: Dumbbell },
  { id: 'spirit', label: 'Spirit', path: '/spirit', icon: Flame },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-4 left-4 right-4 z-[100] px-2 py-1.5 flex items-center justify-around overflow-hidden"
      style={{
        // Steel rail: cool slate base with subtle linear highlight
        background:
          'linear-gradient(180deg, hsl(224 31% 13%) 0%, hsl(222 21% 8%) 100%)',
        border: '1px solid hsl(214 35% 20%)',
        borderRadius: '14px',
        boxShadow:
          '0 12px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.6)',
      }}
    >
      {/* Forge amber underline — brand signature rail */}
      <span
        className="pointer-events-none absolute bottom-0 left-6 right-6 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(200,130,10,0.45) 50%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.path || pathname.startsWith(item.path + '/')

        return (
          <Link
            key={item.id}
            href={item.path}
            className="relative flex flex-col items-center gap-1 py-2 px-3 min-w-[60px]"
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <>
                {/* Amber glow pill — stamped active state */}
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(200,130,10,0.14) 0%, rgba(200,130,10,0.05) 100%)',
                    border: '1px solid rgba(200,130,10,0.35)',
                    borderRadius: '10px',
                    boxShadow:
                      '0 0 14px 0 rgba(200,130,10,0.28), inset 0 1px 0 rgba(255,220,150,0.08)',
                  }}
                  transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                />
                {/* Top amber tick — like a stamped notch */}
                <motion.span
                  layoutId="nav-tick"
                  className="absolute -top-[1px] left-1/2 -translate-x-1/2 h-[2px] w-5 rounded-full bg-brand"
                  style={{ boxShadow: '0 0 6px 1px rgba(200,130,10,0.7)' }}
                  transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                />
              </>
            )}
            <Icon
              size={19}
              strokeWidth={isActive ? 2 : 1.5}
              className={`relative z-10 transition-all duration-200 ${
                isActive ? 'text-brand' : 'text-muted-foreground'
              }`}
              style={
                isActive
                  ? { filter: 'drop-shadow(0 0 4px rgba(200,130,10,0.55))' }
                  : undefined
              }
            />
            <span
              className={`relative z-10 text-[9px] uppercase tracking-[0.16em] font-semibold transition-colors duration-200 font-display ${
                isActive ? 'text-brand' : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
