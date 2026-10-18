import { PROGRAMS } from '../../lib/programs';
import type { LiftPrescription } from '../../lib/programs';
import { plateString } from '../../lib/plates';

// The sample session the public site shows: a real buildDay run, done at build
// time, for a dad with these maxes. Every number on the page that describes
// "what a session looks like" is read from here, so the site shows what the
// engine prescribes rather than a mock-up of it.

export const SAMPLE = {
  slug: 'dad-built',
  week: 3,
  day: 1,
  maxes: { back_squat: 315, bench: 225, deadlift: 405, ohp: 145 } as Record<string, number>,
  // How many of the lead lift's sets the sample shows as already logged.
  logged: 2,
};

const program = PROGRAMS[SAMPLE.slug];
const full = program.buildDay(SAMPLE.week, SAMPLE.day, SAMPLE.maxes);
const crunch = program.buildDay(SAMPLE.week, SAMPLE.day, SAMPLE.maxes, undefined, { timeConstrained: true });

const lifts = (items: typeof full.items) =>
  items.filter((i): i is LiftPrescription => i.kind === 'lift');

// The day's first loaded lift: the one that gets the volt slab.
const lead = lifts(full.items).find((i) => i.targetWeightLbs != null && i.maxKey)!;

export const SAMPLE_SESSION = {
  programName: program.name,
  dayName: full.dayName,
  intent: full.sessionIntent,
  lead: {
    name: lead.name,
    sets: lead.sets,
    reps: lead.reps,
    percent: lead.percent!,
    rpe: lead.targetRpe,
    load: lead.targetWeightLbs!,
    max: SAMPLE.maxes[lead.maxKey!],
    maxLabel: program.requiredMaxes.find((m) => m.key === lead.maxKey)!.label,
    plates: plateString(lead.targetWeightLbs),
  },
  // The rest of the day, by name and sets × reps.
  rest: lifts(full.items)
    .filter((i) => i !== lead)
    .map((i) => ({
      name: i.name,
      sets: i.sets,
      reps: i.repRange ? `${i.repRange[0]}–${i.repRange[1]}` : String(i.reps),
      top: i.repRange?.[1],
      step: i.loadStepLbs,
    })),
  fullCount: full.items.length,
  crunchCount: crunch.items.length,
  crunchSets: Math.max(...lifts(crunch.items).map((i) => i.sets)),
  macroWeeks: program.macroWeeks,
};
