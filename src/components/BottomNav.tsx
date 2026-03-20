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
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 border-t border-border px-4 py-2 flex items-center justify-around z-[100] backdrop-blur-md safe-area-inset-bottom">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.path || pathname.startsWith(item.path + '/')

        return (
          <Link
            key={item.id}
            href={item.path}
            className="relative flex flex-col items-center gap-1 py-1.5 px-3 min-w-[56px]"
          >
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 bg-brand/10 rounded-xl"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <Icon
              size={20}
              strokeWidth={isActive ? 2 : 1.5}
              className={`relative z-10 transition-colors duration-200 ${
                isActive ? 'text-brand' : 'text-muted-foreground'
              }`}
            />
            <span
              className={`relative z-10 text-[9px] uppercase tracking-[0.12em] font-medium transition-colors duration-200 ${
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
