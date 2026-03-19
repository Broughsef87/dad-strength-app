'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  Brain,
  Dumbbell,
  Flame
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'hq', label: 'HQ', path: '/dashboard', icon: Shield },
  { id: 'mind', label: 'Mind', path: '/mind', icon: Brain },
  { id: 'body', label: 'Body', path: '/body', icon: Dumbbell },
  { id: 'spirit', label: 'Spirit', path: '/spirit', icon: Flame },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 border-t border-border px-6 py-3 flex items-center justify-between z-[100] backdrop-blur-md">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;

        return (
          <Link
            key={item.id}
            href={item.path}
            className={`flex flex-col items-center gap-1.5 transition-all min-w-[48px] ${
              isActive ? 'text-brand' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={18} />
            <span className="text-[9px] uppercase tracking-[0.15em] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
