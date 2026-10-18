import { SAMPLE, SAMPLE_SESSION as S } from './sample';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// The hero's session card: the app's SessionCard anatomy (DS readme, Cards),
// filled from a real buildDay run (./sample). The one volt slab is the load.
export default function SampleSession() {
  const L = S.lead;
  return (
    <figure>
      <div className="tile-lg p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow-mono">
            wk {SAMPLE.week} · {DAYS[SAMPLE.day - 1]} · {S.programName.toLowerCase()}
          </p>
          <span className="chip-live chip-live-sm">live</span>
        </div>
        <p className="font-display mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] lowercase text-foreground">
          {S.dayName.toLowerCase()}
        </p>
        <p className="mt-1 text-sm font-light leading-[1.65] text-muted-foreground">{S.intent.toLowerCase()}</p>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="font-display text-xl font-semibold tracking-[-0.02em] lowercase text-foreground">
              {L.name.toLowerCase()}
            </p>
            <p className="eyebrow-mono mt-1.5">
              lb @ {L.percent}% · {L.sets}×{L.reps}
              {L.rpe != null && <> · tgt rpe {L.rpe}</>}
            </p>
          </div>
          <span className="slab-volt text-[30px]">{L.load}</span>
        </div>
        {L.plates && <p className="data-mono mt-2 text-right">{L.plates}</p>}

        <ul className="mt-4 space-y-1.5">
          {Array.from({ length: L.sets }, (_, i) => (
            <li key={i} className="row-recessed flex items-center justify-between px-3.5 py-2.5">
              <span className="data-mono">set {i + 1}</span>
              <span className="data-mono">
                {i < SAMPLE.logged ? (
                  <>
                    <b>{L.reps}</b> reps{L.rpe != null && <> · rpe <b>{L.rpe}</b></>}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-3">
          <div className="led-bar" aria-hidden="true">
            {Array.from({ length: L.sets }, (_, i) => (
              <span key={i} className={`led-cell${i < SAMPLE.logged ? ' lit' : ''}`} />
            ))}
          </div>
          <span className="eyebrow-mono">
            {SAMPLE.logged} of {L.sets} sets
          </span>
        </div>

        <p className="eyebrow-mono mt-6 mb-2">then</p>
        <ul className="space-y-1">
          {S.rest.slice(0, 3).map((r) => (
            <li key={r.name} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="lowercase text-foreground">{r.name.toLowerCase()}</span>
              <span className="data-mono">
                {r.sets}×{r.reps}
              </span>
            </li>
          ))}
          {S.rest.length > 3 && <li className="data-mono">+ {S.rest.length - 3} more</li>}
        </ul>
      </div>
      <figcaption className="mt-3 text-sm font-light leading-[1.65] text-muted-foreground">
        a real session from the engine: week {SAMPLE.week} of {S.programName.toLowerCase()}, for a{' '}
        {L.max} lb {L.maxLabel.toLowerCase()}. yours is built from your numbers.
      </figcaption>
    </figure>
  );
}
