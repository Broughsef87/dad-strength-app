import type { Metadata } from 'next';
import Logo from '../components/Logo';
import AuthPanel from '../components/AuthPanel';

// The public front door. A server component so the copy, headings and links
// below ship in the HTML: before this, / rendered client-side and crawlers and
// link previews saw only "Loading". Signed-in visitors never see it —
// middleware sends them to /dashboard.

// Next merges metadata shallowly: a page-level openGraph replaces the
// layout's whole object, so the image and site name are restated here.
const OG_IMAGE = {
  url: '/logo-suite/ds_banner_dark.png',
  width: 1500,
  height: 500,
  alt: 'Dad Strength — workout app for busy dads',
};

const DESCRIPTION =
  'Strength programs built for the hours dads actually have, a morning routine, and Fuel: pick dinners, get a shopping list in store order. Founding dads wanted.';

export const metadata: Metadata = {
  title: { absolute: 'Dad Strength — Workout App for Busy Dads' },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Dad Strength — Workout App for Busy Dads',
    description: DESCRIPTION,
    url: '/',
    type: 'website',
    siteName: 'Dad Strength',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    images: [OG_IMAGE.url],
    title: 'Dad Strength — Workout App for Busy Dads',
    description: DESCRIPTION,
  },
};

const SITE = 'https://www.dadstrength.tech';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE}/#organization`,
      name: 'Dad Strength',
      url: `${SITE}/`,
      logo: { '@type': 'ImageObject', url: `${SITE}/logo-suite/ds_app_icon.png` },
      parentOrganization: {
        '@type': 'Organization',
        name: 'Forge Automations',
        url: 'https://www.forge-automations.com/',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      name: 'Dad Strength',
      url: `${SITE}/`,
      publisher: { '@id': `${SITE}/#organization` },
      inLanguage: 'en-US',
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE}/#app`,
      name: 'Dad Strength',
      url: `${SITE}/`,
      description:
        'A workout app for busy dads: three 13-week strength programs, a morning routine, and Fuel, a meal planner that builds a shopping list in store order.',
      applicationCategory: 'HealthApplication',
      applicationSubCategory: 'Fitness',
      operatingSystem: 'Web browser (iOS, Android, desktop)',
      browserRequirements: 'Requires JavaScript',
      featureList: [
        'Three 13-week strength programs: Power Dad, Dad Built, Hybrid Dad',
        'Morning routine',
        'Fuel: dinner menu, full recipes, and a shopping list in store order',
      ],
      image: `${SITE}/logo-suite/ds_banner_dark.png`,
      publisher: { '@id': `${SITE}/#organization` },
    },
  ],
};

// The page's content. Headings and body copy are the approved SEO wording
// from #45; `label` is the tile's mono eyebrow and `meta` its data line.
// The founding section is not a tile like the other three — it is the volt
// slab further down, so it lives in FOUNDING rather than in this list.
const SECTIONS = [
  {
    id: 'programs',
    label: '01 · programs',
    heading: 'programs that fit your window',
    body: 'power dad, dad built and hybrid dad. three 13-week strength blocks, each with a deload and a test week.',
    stat: { num: '13', unit: 'weeks a block' },
    rows: ['power dad', 'dad built', 'hybrid dad'],
  },
  {
    id: 'morning',
    label: '02 · morning',
    heading: 'a morning routine before the house wakes up',
    body: 'tell it how you slept and how much time you have. you get a short list for the morning.',
    meta: 'sleep · time you have · a short list',
  },
  {
    id: 'fuel',
    label: '03 · fuel',
    heading: 'fuel: dinners to shopping list',
    body: 'pick a dinner menu, open any meal for the full recipe, tick off what is already at home, and get a shopping list in store order.',
    meta: 'menu · recipe · pantry · list in store order',
  },
];

const FOUNDING = {
  count: '20',
  heading: 'join the first 20 founding dads',
  body: 'founding dads get dad strength free for life in exchange for honest feedback. sign in with google below. paid plans are not live yet.',
};

const CTA = 'claim a founding spot';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        {/* Lockup: mark 34px + wordmark, gap 12 (DS brand marks). */}
        <header className="flex items-center justify-between py-5">
          <a href="/" className="flex items-center gap-3" aria-label="Dad Strength home">
            <Logo className="h-[34px] w-[34px]" />
            <span className="font-display text-xl font-semibold tracking-[-0.03em] lowercase text-foreground">
              dad strength
            </span>
          </a>
          <a href="#sign-in" className="pill-quiet px-4 py-2 text-sm">
            sign in
          </a>
        </header>

        <main>
          {/* Hero */}
          <section className="pt-12 pb-14 sm:pt-20 sm:pb-20">
            <p className="eyebrow-mono">DS-01 · strength training for fathers</p>
            <h1 className="font-display mt-4 text-[40px] font-bold leading-[1.02] tracking-[-0.045em] lowercase text-foreground sm:text-[76px]">
              the workout app for busy dads
            </h1>
            <p className="mt-5 max-w-md text-lg font-light leading-[1.65] text-muted-foreground sm:text-xl">
              strength programs built for the hours you actually have.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#sign-in" className="pill-volt px-6 py-3.5 text-base">
                {CTA}
              </a>
              <a href="#inside" className="pill-quiet px-6 py-3.5 text-base">
                see what is inside
              </a>
            </div>
            <p className="eyebrow-mono-sm eyebrow-mono mt-5">
              {FOUNDING.count} founding spots · paid plans are not live yet
            </p>
          </section>

          {/* What is inside: one tile per feature, a vertical stack. */}
          <section id="inside" className="scroll-mt-6" aria-label="what is inside">
            <p className="eyebrow-mono mb-3.5">what is inside</p>
            <div className="space-y-3">
              {SECTIONS.map((s) => (
                <section key={s.id} className="tile p-5.5 sm:p-7">
                  <p className="eyebrow-mono">{s.label}</p>
                  <h2 className="font-display mt-2.5 text-2xl font-semibold tracking-[-0.02em] lowercase text-foreground sm:text-[26px]">
                    {s.heading}
                  </h2>
                  <p className="mt-2 text-[15px] font-light leading-[1.65] text-muted-foreground">
                    {s.body}
                  </p>

                  {s.stat && (
                    <div className="mt-5 flex items-end gap-3">
                      <span className="stat-num text-[44px] text-foreground">{s.stat.num}</span>
                      <span className="eyebrow-mono pb-1">{s.stat.unit}</span>
                    </div>
                  )}

                  {s.rows && (
                    <ul className="mt-4 space-y-2">
                      {s.rows.map((r) => (
                        <li
                          key={r}
                          className="row-recessed flex items-center justify-between px-3.5 py-3"
                        >
                          <span className="text-[15px] font-medium lowercase text-foreground">{r}</span>
                          <span className="data-mono">{s.stat?.num} wk · deload · test week</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {s.meta && <p className="data-mono mt-4">{s.meta}</p>}
                </section>
              ))}
            </div>
          </section>

          {/* Founding dads: the volt slab. Brand-ink is the only ink on it;
              the CTA is a quiet pill, its own recessed fill and ink. */}
          <section
            id="founding"
            className="mt-12 rounded-3xl bg-brand p-7 text-brand-ink shadow-[var(--shadow-tile-lg)] sm:p-10"
          >
            <p className="font-mono text-[11px] tracking-[0.16em] lowercase text-brand-ink">
              founding dads
            </p>
            <p className="stat-num mt-4 text-[72px] text-brand-ink" aria-hidden="true">
              {FOUNDING.count}
            </p>
            <h2 className="font-display mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] lowercase text-brand-ink sm:text-[40px]">
              {FOUNDING.heading}
            </h2>
            <p className="mt-3 max-w-md text-base font-normal leading-[1.65] text-brand-ink">
              {FOUNDING.body}
            </p>
            <a
              href="#sign-in"
              className="pill-quiet mt-7 inline-block px-6 py-3.5 text-base font-semibold"
            >
              {CTA}
            </a>
          </section>

          {/* Sign in. AuthPanel is unchanged; this section only frames it. */}
          <section id="sign-in" className="scroll-mt-6 pt-14 pb-4" aria-label="sign in">
            <div className="mx-auto w-full max-w-sm">
              <p className="eyebrow-mono">sign in</p>
              <p className="font-display mt-2 mb-5 text-[26px] font-semibold tracking-[-0.02em] lowercase text-foreground">
                sign in to claim your spot.
              </p>
              <AuthPanel />
            </div>
          </section>
        </main>

        <footer className="space-y-4 py-12 text-center">
          <p className="eyebrow-mono">DS-01 // built for the long haul</p>

          <div className="flex items-center justify-center gap-4">
            <a href="/terms" className="text-xs lowercase text-muted-foreground transition-colors hover:text-foreground">terms</a>
            <a href="/privacy" className="text-xs lowercase text-muted-foreground transition-colors hover:text-foreground">privacy</a>
            <a href="/disclaimer" className="text-xs lowercase text-muted-foreground transition-colors hover:text-foreground">disclaimer</a>
          </div>

          {/* Who this is for (FOR-267). Its own line rather than a fourth item in
              the row above: that row is legal, this is an attribution.

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
      </div>
    </div>
  );
}
