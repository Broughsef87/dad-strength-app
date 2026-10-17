import Logo from '../Logo';

// The public site's header, shared by / and /programs. Links are absolute
// paths so they work from any public page.
export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between py-5">
      {/* Lockup: mark 34px + wordmark, gap 12 (DS brand marks). */}
      <a href="/" className="flex items-center gap-3" aria-label="dad strength home">
        <Logo className="h-[34px] w-[34px]" />
        <span className="font-display text-xl font-semibold tracking-[-0.03em] lowercase text-foreground">
          dad strength
        </span>
      </a>
      <nav className="flex items-center gap-2" aria-label="site">
        <a href="/programs" className="px-3 py-2 text-sm lowercase text-muted-foreground transition-colors hover:text-foreground">
          programs
        </a>
        <a href="/#sign-in" className="pill-quiet px-4 py-2 text-sm">
          sign in
        </a>
      </nav>
    </header>
  );
}
