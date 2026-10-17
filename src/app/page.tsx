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

const SECTIONS = [
  {
    heading: 'programs that fit your window',
    body: 'power dad, dad built and hybrid dad. three 13-week strength blocks, each with a deload and a test week.',
  },
  {
    heading: 'a morning routine before the house wakes up',
    body: 'tell it how you slept and how much time you have. you get a short list for the morning.',
  },
  {
    heading: 'fuel: dinners to shopping list',
    body: 'pick a dinner menu, open any meal for the full recipe, tick off what is already at home, and get a shopping list in store order.',
  },
  {
    heading: 'join the first 20 founding dads',
    body: 'founding dads get dad strength free for life in exchange for honest feedback. sign in with google above. paid plans are not live yet.',
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-background p-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <main className="relative z-10 w-full max-w-sm space-y-10 py-8">
        {/* Brand lockup — stacked suite asset, dark/light aware */}
        <div className="flex flex-col items-center text-center">
          <Logo className="w-24 h-24" />
          <p className="font-display font-semibold text-2xl lowercase text-foreground mt-5">
            Dad Strength
          </p>
          <h1 className="font-display font-semibold text-lg lowercase text-foreground mt-3">
            the workout app for busy dads
          </h1>
          <p className="text-sm font-light text-muted-foreground mt-2">
            strength programs built for the hours you actually have.
          </p>
        </div>

        <AuthPanel />

        <div className="space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display font-semibold text-base lowercase text-foreground">
                {s.heading}
              </h2>
              <p className="text-sm font-light leading-relaxed text-muted-foreground mt-1">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        <p className="eyebrow-mono text-center">
          DS-01 // BUILT FOR THE LONG HAUL
        </p>

        {/* Legal footer */}
        <div className="flex items-center justify-center gap-4 -mt-4">
          <a href="/terms" className="text-[10px] lowercase text-muted-foreground/60 hover:text-muted-foreground transition-colors">terms</a>
          <a href="/privacy" className="text-[10px] lowercase text-muted-foreground/60 hover:text-muted-foreground transition-colors">privacy</a>
          <a href="/disclaimer" className="text-[10px] lowercase text-muted-foreground/60 hover:text-muted-foreground transition-colors">disclaimer</a>
        </div>

        {/* Who this is for (FOR-267). Its own line rather than a fourth item in
            the row above: that row is legal, this is an attribution.

            NOT `lowercase`, and NOT a faded ink. The row above is both, and
            copying it would have rendered "romans xii men" — the site names
            itself Romans XII, and lowercasing somebody else's name to satisfy
            our own voice rule is the wrong trade. Full-opacity muted ink
            because the contrast check bans NEW faded ink, and the /60 above is
            pre-existing debt in faded-ink-debt.json. */}
        <p className="text-[10px] text-center text-muted-foreground">
          <a
            href="https://romansxiimen.com"
            target="_blank"
            rel="noopener"
            className="hover:text-foreground transition-colors"
          >
            training for Romans XII men
          </a>
          {' · '}
          <a
            href="https://www.forge-automations.com/dad-strength"
            className="hover:text-foreground transition-colors"
          >
            built by Forge Automations
          </a>
        </p>
      </main>
    </div>
  );
}
