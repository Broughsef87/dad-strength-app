import Logo from '../Logo';

// The public site's footer, shared by / and /programs.
const COLUMNS = [
  {
    label: 'the app',
    links: [
      { href: '/programs', text: 'programs' },
      { href: '/#how', text: 'how it works' },
      { href: '/#coach', text: 'coach' },
      { href: '/#sign-in', text: 'sign in' },
    ],
  },
  {
    label: 'legal',
    links: [
      { href: '/terms', text: 'terms' },
      { href: '/privacy', text: 'privacy' },
      { href: '/disclaimer', text: 'disclaimer' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border py-12">
      <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <a href="/" className="flex items-center gap-3" aria-label="dad strength home">
            <Logo className="h-[28px] w-[28px]" />
            <span className="font-display text-lg font-semibold tracking-[-0.03em] lowercase text-foreground">
              dad strength
            </span>
          </a>
          <p className="mt-4 max-w-xs text-sm font-light leading-[1.65] text-muted-foreground">
            strength programs for the hours dads actually have.
          </p>
        </div>

        {COLUMNS.map((c) => (
          <div key={c.label}>
            <p className="eyebrow-mono mb-3">{c.label}</p>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-sm lowercase text-muted-foreground transition-colors hover:text-foreground">
                    {l.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="eyebrow-mono">dad strength · written by andrew brough</p>
        {/* Who this is for (FOR-267). NOT `lowercase`: the site names itself
            Romans XII, and lowercasing somebody else's name to satisfy our own
            voice rule is the wrong trade. Full-opacity muted ink — inks never
            fade. */}
        <p className="text-xs text-muted-foreground">
          <a
            href="https://romansxiimen.com"
            target="_blank"
            rel="noopener"
            className="transition-colors hover:text-foreground"
          >
            training for Romans XII men
          </a>
          {' · '}
          <a
            href="https://www.forge-automations.com/dad-strength"
            className="transition-colors hover:text-foreground"
          >
            built by Forge Automations
          </a>
        </p>
      </div>
    </footer>
  );
}
