import type { ReactNode } from 'react';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

// The public site's frame. It is always graphite: its paths are listed in
// GRAPHITE_PATHS (src/lib/publicSite.ts), which ThemeProvider and the root
// layout read. A class on this wrapper cannot do it — the @theme colors are
// resolved on :root, so a nested `.dark` leaves them light.
//
// The site is a website, not the app: the app is one phone-width column of
// tiles, and the site uses the full width on a desktop. The design system's
// tokens, type roles and kit classes are the app's; only the layout differs.
export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
        <SiteHeader />
        {children}
        <SiteFooter />
      </div>
    </div>
  );
}
