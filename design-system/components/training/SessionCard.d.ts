import * as React from "react";

/**
 * The core training surface: exercise, prescribed load as a volt slab, set rows, progress, finish action.
 *
 * @startingPoint section="Training" subtitle="Exercise, load slab, set rows, finish pill" viewport="700x420"
 */
export interface SessionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Exercise name, lowercase. */
  name?: React.ReactNode;
  /** Prescribed load. Rendered as the volt slab. */
  load?: React.ReactNode;
  /** Mono metadata line, e.g. "lb @ 65% · 4×5 · tgt rpe 7". */
  meta?: React.ReactNode;
  /** Set rows. Omit `value` for a set not yet done. */
  sets?: Array<{ label: string; value?: React.ReactNode }>;
  /** Completed sets, drives the LedBar. */
  lit?: number;
  /** Action label. Default "finish session". */
  action?: React.ReactNode;
  onAction?: () => void;
}

export function SessionCard(props: SessionCardProps): React.JSX.Element;
