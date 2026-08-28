'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Bot, User } from 'lucide-react'

// Three tabs, matching what the app actually is. The four-pillar shell
// (home/mind/body/spirit) advertised pillars the product never grew: it left
// training and morning protocol without a tab while /mind and /spirit held five
// cards between them, one of which was a duplicate mount. Twelve dead components
// and twenty-three unreachable routes accumulated in that gap.
//
// Adding a fourth entry later is one line HERE and nothing else — which is the
// point of the table. Do not add a tab for a feature that does not exist yet;
// that is the exact mistake being undone. Fuel gets an entry when Fuel ships.
//
// Profile is a genuine addition, not a survivor: the old nav had no Profile tab
// at all, so settings, billing and account deletion were reachable only from a
// desktop-only header.
const NAV_ITEMS = [
  { id: 'today', label: 'today', path: '/dashboard', icon: Shield },
  { id: 'train', label: 'train', path: '/train', icon: Bot },
  { id: 'profile', label: 'profile', path: '/profile', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  // FOLDER TABS (FOR-186). The tabs are the top edge of the card, so they sit
  // flush against it: square-ish shoulders, no bottom border, and the active
  // tab is the same paper as the sheet it fronts — that shared fill is what
  // makes it read as ONE object rather than a button above a panel.
  //
  // It stays bottom-fixed. Real folder tabs are at the top, but the thumb is at
  // the bottom of a phone, and a tab you cannot reach is a worse tab. The
  // shoulders are rounded on the bottom here for the same reason: this edge
  // faces down.
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 items-end justify-center gap-1 px-3"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Sections"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.path || pathname.startsWith(item.path + '/')

        return (
          <Link
            key={item.id}
            href={item.path}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'relative flex min-w-[92px] flex-1 flex-col items-center gap-0.5 px-4 pt-2',
              'rounded-b-[6px] border border-t-0 border-[hsl(var(--border))]',
              'font-display text-[11px] uppercase tracking-[0.12em] transition-colors duration-200',
              isActive
                ? 'z-[2] bg-[hsl(var(--card))] pb-3 font-semibold text-[hsl(var(--foreground))]'
                : 'bg-[hsl(var(--muted))] pb-2 text-[hsl(var(--muted-foreground))]',
            ].join(' ')}
          >
            <Icon
              size={16}
              strokeWidth={isActive ? 2 : 1.5}
              className="transition-colors duration-200"
              aria-hidden="true"
            />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
