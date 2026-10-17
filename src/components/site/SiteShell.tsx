import type { ReactNode } from 'react';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

// The public site's frame. It is always graphite: its paths are listed in
// GRAPHITE_PATHS (src/lib/publicSite.ts), which ThemeProvider and the root
// layout read. A class on this wrapper cannot do it — the @theme colors are
// resolved on :root, so a nested `.dark` leaves them light.
export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <SiteHeader />
        {children}
        <SiteFooter />
      </div>
    </div>
  );
}
