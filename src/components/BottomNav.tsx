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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
      <div className="flex items-stretch">
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
              {/* Active indicator - top border */}
              {active && (
                <span className="absolute top-0 left-4 right-4 h-0.5 bg-brand rounded-b-full" />
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
