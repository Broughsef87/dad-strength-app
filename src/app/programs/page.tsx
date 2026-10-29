import type { Metadata } from 'next';
import SiteShell from '../../components/site/SiteShell';
import { COACH, FOUNDING_SPOTS } from '../../components/site/content';
import { PROGRAMS } from '../../lib/programs';
import { TIME_CONSTRAINED_LIFTS, TIME_CONSTRAINED_MAX_SETS } from '../../lib/programs/timeConstrained';
import { OG_IMAGE } from '../../lib/publicSite';

// The public programs page. Server-rendered, like /, so the copy ships in the
// HTML. Names, block length, days and the maxes each program asks for are read
// from the program registry, so this page cannot drift from what buildDay runs;
// only the prose below is written here.

// Title and description from Herald's SEO audit (2026-10-17).
const TITLE = 'Dad Workout Plans: 3 Strength Programs — Dad Strength';
const DESCRIPTION =
  'Power Dad, Dad Built and Hybrid Dad: 13-week strength blocks that adjust to what you actually lifted last week. Built for home training and short windows.';
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/programs' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/programs',
    type: 'website',
    siteName: 'Dad Strength',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    images: [OG_IMAGE.url],
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Prose per program, keyed by registry slug. A slug missing here renders the
// program without prose rather than failing the page. Everything structural
// (the week, the block, what to test) is read from the registry below.
const COPY: Record<string, { forWho: string; body: string[] }> = {
  'hybrid-power': {
    forWho: 'two heavy snatch-and-clean days a week, for the dad who wants to stay fast.',
    body: [
      'power dad is built around the olympic lifts. two days a week you snatch and clean heavy, then work sub-max back-offs. no drill work eats your window. a third gym day covers presses, single-leg strength and ballistic power, and the fourth puts a heavy deadlift and the week\'s conditioning in one session.',
      'outside the gym there is one speed day, where quality beats quantity and every rep gets a full rest, and one interval session on a bike, rower or road. every gym day caps at six blocks, so the session ends when your window does.',
    ],
  },
  'dad-built': {
    forWho: 'four heavy working sets off your tested max, then the rep work that builds muscle.',
    body: [
      'dad built is powerbuilding. four gym days: push, legs, pull, then shoulders with hamstrings and glutes. bench, squat and press days open with four heavy working sets off your tested max, pull day with heavy weighted pull-ups, then the rep work that builds muscle.',
      'the volume progresses on one plain rule: hold the weight until every set reaches the top of its rep range, then add load. two easy aerobic days, a walk, a ruck or an easy bike, keep your conditioning honest without eating your recovery.',
    ],
  },
  'hybrid-dad': {
    forWho: 'run paces from your 5k, with two short lifting days to hold your strength.',
    body: [
      'hybrid dad builds a serious aerobic base and keeps your strength in place. two short lifting days hold the squat, press and hinge, at low volume on purpose so your legs are there for the aerobic work.',
      'the rest of the week is aerobic work: intervals for the hard effort, tempo at comfortably hard, easy zone 2 with core work, and a long session that grows across the block. your run paces come from your 5k time, and the block ends with a 5k time trial.',
    ],
  },
};

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const PROGRAM_LIST = Object.values(PROGRAMS);

export default function ProgramsPage() {
  return (
    <SiteShell>
      <main>
        <section className="grid gap-10 pt-10 pb-16 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-16 lg:pt-16 lg:pb-20">
          <div>
            <p className="eyebrow-mono">programs</p>
            <h1 className="font-display mt-5 text-[44px] font-bold leading-[0.98] tracking-[-0.045em] lowercase text-foreground sm:text-[76px]">
              three strength programs for dads
            </h1>
            <p className="mt-6 max-w-md text-lg font-light leading-[1.65] text-muted-foreground">
              pick the one that fits the dad you want to be. each runs in {PROGRAM_LIST[0].macroWeeks}-week
              blocks and ends with a deload and a test week.
            </p>
            <p className="data-mono mt-6">
              <a href="/#coach" className="underline-offset-4 hover:underline">
                written by {COACH.name.toLowerCase()}
              </a>{' '}
              · {COACH.credentials.map((c) => c.code).join(' · ')}
            </p>
          </div>
          {/* The index: one row per program, jumping to its section. */}
          <nav aria-label="the programs" className="space-y-2">
            {PROGRAM_LIST.map((p, i) => (
              <a
                key={p.slug}
                href={`#${p.slug}`}
                className="row-recessed flex items-center gap-4 px-4 py-3.5 transition-colors active:bg-muted"
              >
                <span className="data-mono w-6">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-display text-lg font-semibold tracking-[-0.02em] lowercase text-foreground">
                  {p.name.toLowerCase()}
                </span>
                <span className="data-mono ml-auto">{p.gymDayNumbers.length} gym days</span>
              </a>
            ))}
          </nav>
        </section>

        <div className="space-y-6">
          {PROGRAM_LIST.map((p, i) => {
            const copy = COPY[p.slug];
            return (
              <section
                key={p.slug}
                id={p.slug}
                className="tile scroll-mt-6 grid gap-10 p-5.5 sm:p-10 lg:grid-cols-[6fr_5fr] lg:gap-16"
              >
                <div>
                  <p className="eyebrow-mono">
                    {String(i + 1).padStart(2, '0')} · {p.tagline.toLowerCase()}
                  </p>
                  <h2 className="font-display mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] lowercase text-foreground sm:text-[44px]">
                    {p.name.toLowerCase()}
                  </h2>
                  {copy && (
                    <>
                      <p className="mt-4 text-lg font-medium leading-[1.5] text-foreground">{copy.forWho}</p>
                      {copy.body.map((para) => (
                        <p key={para.slice(0, 24)} className="mt-3 text-[15px] font-light leading-[1.65] text-muted-foreground">
                          {para}
                        </p>
                      ))}
                    </>
                  )}
                  <div className="mt-8 grid grid-cols-2 gap-6">
                    <div>
                      <p className="stat-num text-[44px] text-foreground">{p.macroWeeks}</p>
                      <p className="eyebrow-mono mt-2">
                        wk block · deload wk {p.macroWeeks - 1} · test wk {p.macroWeeks}
                      </p>
                    </div>
                    <div>
                      <p className="stat-num text-[44px] text-foreground">{p.gymDayNumbers.length}</p>
                      <p className="eyebrow-mono mt-2">gym days a week</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="eyebrow-mono mb-2.5">the week</p>
                  <ul className="space-y-1.5">
                    {DAYS.map((day, d) => {
                      // Week 1, no maxes: only the day's name and kind are read.
                      const plan = p.buildDay(1, d + 1, {});
                      return (
                        <li key={day} className="row-recessed flex items-center gap-3 px-3.5 py-2.5">
                          <span className="data-mono w-9 shrink-0">{day}</span>
                          <span className="text-[15px] lowercase text-foreground">{plan.dayName.toLowerCase()}</span>
                          <span className="data-mono ml-auto">{plan.dayType}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="eyebrow-mono mt-6 mb-2.5">to start, your</p>
                  <p className="data-mono leading-relaxed">
                    {p.requiredMaxes.map((m) => m.label.toLowerCase()).join(' · ')}
                  </p>
                </div>
              </section>
            );
          })}
        </div>

        {/* One paragraph, not a three-card grid: it is one engine. */}
        <section className="mt-20 max-w-2xl" aria-label="how the programs work">
          <p className="eyebrow-mono">how they work</p>
          <h2 className="font-display mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] lowercase text-foreground sm:text-[44px]">
            same engine under all three
          </h2>
          <p className="mt-6 text-base font-light leading-[1.75] text-muted-foreground">
            every working weight comes from your own maxes and what you logged last week, so log the
            session and next week adjusts. short on time on a gym day? tap time crunch and the day keeps
            its warm-up and up to {TIME_CONSTRAINED_LIFTS} of its first lifts, at up to{' '}
            {TIME_CONSTRAINED_MAX_SETS} working sets each. tired week? flag a deload whenever you need
            one, and the block picks back up after.
          </p>
        </section>

        <section className="mt-24 flex flex-col items-start justify-between gap-8 border-t border-border pt-12 md:flex-row md:items-center">
          <p className="font-display max-w-2xl text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] lowercase text-foreground sm:text-[40px]">
            {FOUNDING_SPOTS} founding dads train free for life, for honest feedback.
          </p>
          <a href="/#founding" className="pill-volt shrink-0 px-6 py-3.5 text-base font-semibold">
            claim a founding spot
          </a>
        </section>
      </main>
    </SiteShell>
  );
}
