// The public site's footer, shared by / and /programs.
export default function SiteFooter() {
  return (
    <footer className="space-y-4 py-12 text-center">
      <p className="eyebrow-mono">DS-01 // built for the long haul</p>

      <div className="flex items-center justify-center gap-4">
        <a href="/programs" className="text-xs lowercase text-muted-foreground transition-colors hover:text-foreground">programs</a>
        <a href="/terms" className="text-xs lowercase text-muted-foreground transition-colors hover:text-foreground">terms</a>
        <a href="/privacy" className="text-xs lowercase text-muted-foreground transition-colors hover:text-foreground">privacy</a>
        <a href="/disclaimer" className="text-xs lowercase text-muted-foreground transition-colors hover:text-foreground">disclaimer</a>
      </div>

      {/* Who this is for (FOR-267). Its own line rather than another item in
          the row above: that row is site links, this is an attribution.

          NOT `lowercase`: the site names itself Romans XII, and lowercasing
          somebody else's name to satisfy our own voice rule is the wrong
          trade. Full-opacity muted ink — inks never fade. */}
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
    </footer>
  );
}
