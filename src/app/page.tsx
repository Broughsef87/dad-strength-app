import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import AuthPanel from '../components/AuthPanel';
import SiteShell from '../components/site/SiteShell';
import SampleSession from '../components/site/SampleSession';
import WeekGrid from '../components/site/WeekGrid';
import BlockBar from '../components/site/BlockBar';
import { COACH, FOUNDING_SPOTS } from '../components/site/content';
import { SAMPLE, SAMPLE_SESSION as S } from '../components/site/sample';
import { PROGRAMS } from '../lib/programs';
import { TIME_CONSTRAINED_LIFTS, TIME_CONSTRAINED_MAX_SETS } from '../lib/programs/timeConstrained';

// The public front door. A server component so the copy, headings and links
// below ship in the HTML: before this, / rendered client-side and crawlers and
// link previews saw only "Loading". Signed-in visitors see it too; AuthPanel
// offers them a way into the app.

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
      founder: { '@id': `${SITE}/#coach` },
      sameAs: ['https://www.instagram.com/dad_strength.tech/'],
    },
    {
      '@type': 'Person',
      '@id': `${SITE}/#coach`,
      url: `${SITE}/#coach`,
      name: COACH.name,
      worksFor: { '@id': `${SITE}/#organization` },
      jobTitle: 'Strength coach',
      hasCredential: COACH.credentials.map((c) => ({
        '@type': 'EducationalOccupationalCredential',
        name: c.formal,
      })),
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

const PROGRAM_LIST = Object.values(PROGRAMS);
const L = S.lead;
// The first rest-of-day lift that runs on a rep range: the double-progression
// example in "how it decides".
const RANGED = S.rest.find((r) => r.top != null && r.step != null);

const CTA = 'claim a founding spot';

// Section heading, shared so every section opens the same way.
function Heading({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <>
      <p className="eyebrow-mono">{eyebrow}</p>
      <h2 className="font-display mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] lowercase text-foreground sm:text-[44px]">
        {children}
      </h2>
    </>
  );
}

const STEPS = [
  {
    n: '01',
    heading: 'your numbers set the weight',
    body: 'tell it your maxes once. the main lifts are a percentage of them, rounded to a load you can build from plates. accessory weights come from what you log.',
    trace: `${L.maxLabel.toLowerCase()} ${L.max} × ${L.percent}% = ${((L.max * L.percent) / 100).toFixed(1)} → ${L.load} lb${L.plates ? ` · ${L.plates}` : ''}`,
  },
  {
    n: '02',
    heading: 'last week moves this week',
    body: 'log the sets and the next session uses them. accessory work adds load once every set reaches the top of its range. on the main lifts, how hard a session felt against its target rpe nudges the next week\'s percentage.',
    trace: RANGED
      ? `${RANGED.name.toLowerCase()} · ${RANGED.sets}×${RANGED.reps} · all sets at ${RANGED.top} → +${RANGED.step} lb`
      : null,
  },
  {
    n: '03',
    heading: 'short on time, do the start of the day',
    body: `tap time crunch on any gym day you have not started. the day keeps its warm-up and up to ${TIME_CONSTRAINED_LIFTS} of its first lifts, at up to ${TIME_CONSTRAINED_MAX_SETS} sets each. the rest of the day is skipped.`,
    trace: `${S.dayName.toLowerCase()} · ${S.fullCount} lifts → ${S.crunchCount} lifts, up to ${S.crunchSets} sets each`,
  },
];

export default function Home() {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <main>
        {/* Hero: the claim on the left, a real session on the right. */}
        <section className="grid items-center gap-12 pt-10 pb-20 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:pt-16 lg:pb-28">
          <div>
            <p className="eyebrow-mono">strength training for dads</p>
            <h1 className="font-display mt-5 text-[44px] font-bold leading-[0.98] tracking-[-0.045em] lowercase text-foreground sm:text-[76px]">
              real programming, worked out to the plate
            </h1>
            <p className="mt-6 max-w-md text-lg font-light leading-[1.65] text-muted-foreground sm:text-xl">
              three {PROGRAM_LIST[0].macroWeeks}-week programs for dads who train around a job and a
              family. put in your maxes, log what you lift, and next week&apos;s weights follow from it.
            </p>
            <p className="data-mono mt-4">
              <a href="#coach" className="underline-offset-4 hover:underline">
                written by {COACH.name.toLowerCase()}
              </a>{' '}
              · {COACH.credentials.map((c) => c.code).join(' · ')}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#sign-in" className="pill-volt px-6 py-3.5 text-base">
                {CTA}
              </a>
              <a href="/programs" className="pill-quiet px-6 py-3.5 text-base">
                see the programs
              </a>
            </div>
            <p className="eyebrow-mono mt-6">
              {FOUNDING_SPOTS} founding spots · paid plans are not live yet
            </p>
          </div>
          <SampleSession />
        </section>

        {/* How it decides: the claim pinned left, the three steps right. */}
        <section id="how" className="scroll-mt-6 mt-20 grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <Heading eyebrow="how it decides">the coach writes it. the app does the math.</Heading>
            <p className="mt-5 max-w-sm text-base font-light leading-[1.65] text-muted-foreground">
              nothing about your training is generated. every number traces back to your maxes and your
              log, and you can see the working.
            </p>
          </div>
          {/* A worksheet, not cards: ruled lines on the ground, the working
              shown in the margin of each step. */}
          <ol className="border-b border-border">
            {STEPS.map((st) => (
              <li key={st.n} className="grid gap-3 border-t border-border py-7 sm:grid-cols-[56px_1fr]">
                <span className="data-mono pt-1.5">{st.n}</span>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-[-0.02em] lowercase text-foreground sm:text-2xl">
                    {st.heading}
                  </h3>
                  <p className="mt-2 text-[15px] font-light leading-[1.65] text-muted-foreground">{st.body}</p>
                  {st.trace && (
                    <p className="data-mono mt-4 border-l-2 border-brand pl-3.5 leading-relaxed">{st.trace}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* The week, every program side by side, and the block it sits in. */}
        <section id="programs" className="scroll-mt-6 mt-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Heading eyebrow="the programs">three programs. seven days each.</Heading>
              <p className="mt-5 max-w-lg text-base font-light leading-[1.65] text-muted-foreground">
                gym days are the full sessions. the other days are outside sessions or rest, and the
                lifting days anchor the week.
              </p>
            </div>
            <a href="/programs" className="pill-quiet px-5 py-2.5 text-sm">
              read the programs
            </a>
          </div>
          <div className="mt-10">
            <WeekGrid />
          </div>
          <div className="tile mt-6 p-5.5 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-display text-xl font-semibold tracking-[-0.02em] lowercase text-foreground">
                the block
              </p>
              <p className="eyebrow-mono">example · wk {SAMPLE.week} of {S.macroWeeks}</p>
            </div>
            <p className="mt-1.5 mb-6 max-w-xl text-[15px] font-light leading-[1.65] text-muted-foreground">
              every program runs in {S.macroWeeks}-week blocks. the load climbs, a deload week lets it
              settle, and a test week sets the numbers for the next block.
            </p>
            <BlockBar weeks={S.macroWeeks} at={SAMPLE.week} />
          </div>
        </section>

        {/* The other two features, side by side. */}
        <section aria-label="beyond the gym" className="mt-16 grid gap-3 md:grid-cols-2">
          <div className="tile p-5.5 sm:p-8">
            <p className="eyebrow-mono">morning</p>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-[-0.02em] lowercase text-foreground sm:text-[30px]">
              a morning routine before the house wakes up
            </h2>
            <p className="mt-3 text-[15px] font-light leading-[1.65] text-muted-foreground">
              tell it how you slept, how you feel and how many minutes you have, and it splits them
              across prayer, meditation, reading and your goals for the day. this is the one part of
              the app written by ai. your training never is.
            </p>
          </div>
          <div className="tile p-5.5 sm:p-8">
            <p className="eyebrow-mono">fuel</p>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-[-0.02em] lowercase text-foreground sm:text-[30px]">
              fuel: dinners to shopping list
            </h2>
            <p className="mt-3 text-[15px] font-light leading-[1.65] text-muted-foreground">
              pick a dinner menu, open any meal for the full recipe, tick off what is already at home,
              and get a shopping list in store order.
            </p>
          </div>
        </section>

        {/* The coach. Credentials come from COACH, the one copy. */}
        <section id="coach" className="scroll-mt-6 mt-24 grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-16" aria-label="your coach">
          <div>
            <p className="eyebrow-mono">your coach</p>
            <p className="font-display mt-3 text-[44px] font-bold leading-[0.98] tracking-[-0.045em] lowercase text-foreground sm:text-[64px]">
              {COACH.name.toLowerCase()}
            </p>
            <p className="data-mono mt-4">{COACH.credentials.map((c) => c.code).join(' · ')}</p>
            {/* Real photographs live on the public site only, never the app
                (design-system/readme.md, Imagery). Bystanders are blurred. */}
            <figure className="tile-lg mt-8 overflow-hidden">
              <Image
                src="/site/coach-family.jpg"
                alt={`${COACH.name} with his wife and baby at a hockey game`}
                width={960}
                height={1200}
                sizes="(min-width: 1024px) 420px, 100vw"
                className="h-auto w-full"
              />
            </figure>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] lowercase text-foreground sm:text-[30px]">
              a coach with a baby at home
            </h2>
            <p className="mt-3 max-w-xl text-base font-light leading-[1.65] text-muted-foreground">
              {COACH.name.toLowerCase()} coaches weightlifting and strength and has a baby daughter at
              home. he wrote all three programs, and he trains on power dad himself.
            </p>
            <ul className="mt-6 space-y-2">
              {COACH.credentials.map((c) => (
                <li
                  key={c.code}
                  className="row-recessed flex items-center justify-between gap-3 px-3.5 py-3"
                >
                  <span className="text-[15px] font-medium lowercase text-foreground">{c.name}</span>
                  <span className="data-mono">{c.code}</span>
                </li>
              ))}
            </ul>
            {/* Source is 731px wide, so it stays small enough to stay sharp. */}
            <figure className="tile-lg mt-8 w-full max-w-[340px] overflow-hidden">
              <Image
                src="/site/coach-gym-fit.jpg"
                alt={`${COACH.name} in the gym`}
                width={731}
                height={971}
                sizes="340px"
                className="h-auto w-full"
              />
            </figure>
          </div>
        </section>

        {/* Founding dads and sign-in, one surface: the CTA everywhere above
            lands here. The hero's pill is the page's one volt control. */}
        <section id="sign-in" className="tile-lg scroll-mt-6 mt-28 grid gap-10 p-6 sm:p-10 lg:grid-cols-2 lg:gap-16" aria-label="sign in">
          <div id="founding">
            <p className="eyebrow-mono">founding dads</p>
            <p className="stat-num mt-5 text-[72px] text-foreground" aria-hidden="true">
              {FOUNDING_SPOTS}
            </p>
            <h2 className="font-display mt-4 text-[30px] font-semibold leading-tight tracking-[-0.03em] lowercase text-foreground sm:text-[40px]">
              join the first {FOUNDING_SPOTS} founding dads
            </h2>
            <p className="mt-4 max-w-md text-base font-light leading-[1.65] text-muted-foreground">
              founding dads get dad strength free for life in exchange for honest feedback. sign in with
              google to claim a spot. paid plans are not live yet.
            </p>
          </div>
          <div className="w-full max-w-sm lg:justify-self-end">
            <p className="eyebrow-mono mb-4">sign in</p>
            <AuthPanel />
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
