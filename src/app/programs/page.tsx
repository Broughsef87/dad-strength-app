import type { Metadata } from 'next';
import SiteShell from '../../components/site/SiteShell';
import { COACH, FOUNDING_SPOTS } from '../../components/site/content';
import { PROGRAMS } from '../../lib/programs';

// The public programs page. Server-rendered, like /, so the copy ships in the
// HTML. Names, block length, days and the maxes each program asks for are read
// from the program registry, so this page cannot drift from what buildDay runs;
// only the prose below is written here.

// Title and description from Herald's SEO audit (2026-10-17).
const TITLE = 'Dad Workout Plans: 3 Strength Programs — Dad Strength';
const DESCRIPTION =
  'Power Dad, Dad Built and Hybrid Dad: 13-week strength blocks that adjust to what you actually lifted last week. Built for home training and short windows.';
const OG_IMAGE = {
  url: '/logo-suite/ds_banner_dark.png',
  width: 1500,
  height: 500,
  alt: 'Dad Strength — workout app for busy dads',
};

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
    forWho: 'for the dad who wants to stay fast and explosive.',
    body: [
      'power dad is built around the olympic lifts. two days a week you snatch and clean heavy, then work sub-max back-offs. no technique drills eat the window. a third gym day covers presses, single-leg strength and ballistic power, and the fourth puts a heavy deadlift and the week\'s conditioning in one session.',
      'outside the gym there is one speed day, where quality beats quantity and every rep gets a full rest, and one interval session on a bike, rower or road. every gym day caps at six blocks, so the session ends when your window does.',
    ],
  },
  'dad-built': {
    forWho: 'for the dad who wants to look like he lifts and still move like an athlete.',
    body: [
      'dad built is powerbuilding. four gym days, two upper and two lower. each one opens with a single heavy top set off your tested max, then moves into the rep work that builds muscle.',
      'the volume progresses on one plain rule: hold the weight until every set reaches the top of its rep range, then add load. two easy, conversational runs keep your conditioning honest without eating your recovery.',
    ],
  },
  'hybrid-dad': {
    forWho: 'for the dad who wants a real engine without losing his strength.',
    body: [
      'hybrid dad builds a serious aerobic base and keeps your strength in place. two short lifting days hold the squat, press and hinge, at low volume on purpose so your legs are there for the running.',
      'the rest of the week is running: intervals for the hard effort, tempo at comfortably hard, easy zone 2 with core work, and a long session that grows across the block. every pace comes from your 5k time, and the block ends with a 5k time trial.',
    ],
  },
};

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const HOW = [
  {
    heading: 'the numbers are calculated',
    body: 'every working weight comes from your own maxes and what you logged last week. log the session and next week adjusts. nothing is generated.',
  },
  {
    heading: 'tired week',
    body: 'flag a deload any week you need one. the block picks back up after.',
  },
];

const PROGRAM_LIST = Object.values(PROGRAMS);

export default function ProgramsPage() {
  return (
    <SiteShell>
      <main>
        <section className="pt-12 pb-10 sm:pt-20 sm:pb-14">
          <p className="eyebrow-mono">programs</p>
          <h1 className="font-display mt-4 text-[40px] font-bold leading-[1.02] tracking-[-0.045em] lowercase text-foreground sm:text-[64px]">
            three strength programs for dads
          </h1>
          <p className="mt-5 max-w-md text-lg font-light leading-[1.65] text-muted-foreground">
            pick the one that fits the dad you want to be. each runs in {PROGRAM_LIST[0].macroWeeks}-week
            blocks
            and ends with a deload and a test week.
          </p>
          <p className="data-mono mt-5">
            written by {COACH.name.toLowerCase()} · {COACH.credentials.map((c) => c.code).join(' · ')}
          </p>
        </section>

        <div className="space-y-3">
          {PROGRAM_LIST.map((p, i) => {
            const copy = COPY[p.slug];
            return (
              <section key={p.slug} id={p.slug} className="tile scroll-mt-6 p-5.5 sm:p-7">
                <p className="eyebrow-mono">
                  {String(i + 1).padStart(2, '0')} · {p.tagline.toLowerCase()}
                </p>
                <h2 className="font-display mt-2.5 text-2xl font-semibold tracking-[-0.02em] lowercase text-foreground sm:text-[30px]">
                  {p.name.toLowerCase()}
                </h2>
                {copy && (
                  <>
                    <p className="mt-2 text-[15px] font-medium leading-[1.65] text-foreground">
                      {copy.forWho}
                    </p>
                    {copy.body.map((para) => (
                      <p key={para.slice(0, 24)} className="mt-2 text-[15px] font-light leading-[1.65] text-muted-foreground">
                        {para}
                      </p>
                    ))}
                  </>
                )}

                <p className="eyebrow-mono mt-6 mb-2.5">the week</p>
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

                <ul className="mt-3 space-y-2">
                  <li className="row-recessed flex items-center justify-between gap-3 px-3.5 py-3">
                    <span className="shrink-0 text-[15px] font-medium lowercase text-foreground">the block</span>
                    <span className="data-mono">
                      {p.macroWeeks} wk · deload wk {p.macroWeeks - 1} · test wk {p.macroWeeks}
                    </span>
                  </li>
                  <li className="row-recessed flex items-center justify-between gap-3 px-3.5 py-3">
                    <span className="shrink-0 text-[15px] font-medium lowercase text-foreground">to start</span>
                    <span className="data-mono text-right">
                      {p.requiredMaxes.map((m) => m.label.toLowerCase()).join(' · ')}
                    </span>
                  </li>
                </ul>
              </section>
            );
          })}
        </div>

        <section className="mt-12" aria-label="how the programs work">
          <p className="eyebrow-mono mb-3.5">how they work</p>
          <div className="tile p-5.5 sm:p-7">
            <ul className="space-y-5">
              {HOW.map((h) => (
                <li key={h.heading}>
                  <h2 className="font-display text-xl font-semibold tracking-[-0.02em] lowercase text-foreground">
                    {h.heading}
                  </h2>
                  <p className="mt-1.5 text-[15px] font-light leading-[1.65] text-muted-foreground">
                    {h.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-12 pb-4 text-center">
          <p className="font-display text-[26px] font-semibold tracking-[-0.02em] lowercase text-foreground">
            {FOUNDING_SPOTS} founding dads train free for life, for honest feedback.
          </p>
          <a href="/#sign-in" className="pill-volt mt-6 inline-block px-6 py-3.5 text-base font-semibold">
            claim a founding spot
          </a>
        </section>
      </main>
    </SiteShell>
  );
}
