import * as React from "react";

/**
 * The week: day pills over a list of sessions. Supports an "anytime" session with no fixed day.
 *
 * @startingPoint section="Training" subtitle="Day pills over the week's sessions" viewport="700x340"
 */
export interface WeekListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Eyebrow title. Default "the week". */
  title?: React.ReactNode;
  /** Days that carry a pill. */
  days?: Array<{ label: string; done?: boolean }>;
  /** Session rows. `when` is mono metadata — "mon · morning done" or "anytime". */
  sessions?: Array<{ name: string; when: string; axis?: string }>;
}

export function WeekList(props: WeekListProps): React.JSX.Element;
