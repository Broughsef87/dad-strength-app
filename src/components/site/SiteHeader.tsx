import Logo from '../Logo';

// The public site's header, shared by / and /programs. Links are absolute
// paths so they work from any public page.
const LINKS = [
  { href: '/programs', label: 'programs' },
  { href: '/#how', label: 'how it works' },
  { href: '/#coach', label: 'coach' },
];

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 py-6">
      {/* Lockup: mark 34px + wordmark, gap 12 (DS brand marks). */}
      <a href="/" className="flex shrink-0 items-center gap-3" aria-label="dad strength home">
        <Logo className="h-[34px] w-[34px]" />
        <span className="font-display text-xl font-semibold tracking-[-0.03em] lowercase text-foreground">
          dad strength
        </span>
      </a>
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="site">
        {LINKS.map((l, i) => (
          <a
            key={l.href}
            href={l.href}
            className={`${i === 0 ? 'inline-block' : 'hidden md:inline-block'} px-3 py-2 text-sm lowercase text-muted-foreground transition-colors hover:text-foreground`}
          >
            {l.label}
          </a>
        ))}
        <a href="/#sign-in" className="pill-quiet ml-1 px-4 py-2 text-sm">
          sign in
        </a>
      </nav>
    </header>
  );
}
