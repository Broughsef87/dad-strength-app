'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { label: 'HQ', href: '/dashboard' },
  { label: 'MIND', href: '/mind' },
  { label: 'BODY', href: '/body' },
  { label: 'SPIRIT', href: '/spirit' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/30">
      <div className="flex items-center justify-around px-6 py-4">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-[10px] font-semibold tracking-[0.25em] transition-colors ${
                active ? 'text-brand' : 'text-muted-foreground/30 hover:text-muted-foreground/60'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
