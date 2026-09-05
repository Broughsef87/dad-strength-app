import * as React from "react";

/**
 * The system's only control shape — a 999px pill.
 *
 * @startingPoint section="Controls" subtitle="volt and quiet pills, plus the live chip" viewport="700x180"
 */
export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** "volt" = volt fill with brand-ink. "quiet" = recessed fill with ink. Default "volt". */
  variant?: "volt" | "quiet";
  /** Stretch to the container width. */
  full?: boolean;
  children?: React.ReactNode;
}

export function Pill(props: PillProps): JSX.Element;
