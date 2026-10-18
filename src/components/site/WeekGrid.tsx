import { PROGRAMS } from '../../lib/programs';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SHORT: Record<string, string> = { gym: 'gym', outside: 'out', test: 'test', rest: 'rest' };

// Every program's week side by side, read from buildDay (week 1, no maxes:
// only each day's name and kind are used). Gym days are tiles, outside days
// are recessed, rest days are bare ground — the app's own depth language.
export default function WeekGrid() {
  const programs = Object.values(PROGRAMS);
  return (
    <div className="space-y-6 md:space-y-2">
      <div className="hidden grid-cols-[150px_repeat(7,minmax(0,1fr))] gap-2 md:grid" aria-hidden="true">
        <span />
        {DAYS.map((d) => (
          <span key={d} className="eyebrow-mono px-1">{d}</span>
        ))}
      </div>
      {programs.map((p) => (
        <div key={p.slug} className="grid grid-cols-7 gap-1.5 md:grid-cols-[150px_repeat(7,minmax(0,1fr))] md:gap-2">
          <a
            href={`/programs#${p.slug}`}
            className="col-span-7 flex items-baseline gap-3 md:col-span-1 md:flex-col md:justify-center md:gap-1"
          >
            <span className="font-display text-lg font-semibold tracking-[-0.02em] lowercase text-foreground">
              {p.name.toLowerCase()}
            </span>
            <span className="data-mono">{p.gymDayNumbers.length} gym days</span>
          </a>
          {DAYS.map((day, d) => {
            const plan = p.buildDay(1, d + 1, {});
            const surface =
              plan.dayType === 'gym' ? 'tile' : plan.dayType === 'rest' ? '' : 'row-recessed';
            return (
              <div
                key={day}
                className={`${surface} flex min-h-[64px] flex-col justify-between gap-2 !rounded-sm px-1.5 py-2 md:min-h-[96px] md:px-3 md:py-3`}
              >
                <span className="data-mono md:hidden">{day}</span>
                <span className="hidden text-[13px] leading-snug lowercase text-foreground md:block">
                  {plan.dayType === 'rest' ? '' : plan.dayName.toLowerCase()}
                </span>
                {/* A phone cell is ~45px wide: "outside" does not fit, so it
                    shortens there and spells out from md up. */}
                <span className="eyebrow-mono-sm eyebrow-mono">
                  <span className="md:hidden">{SHORT[plan.dayType]}</span>
                  <span className="hidden md:inline">{plan.dayType}</span>
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
