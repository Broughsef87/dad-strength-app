import * as React from "react";

/**
 * The entry surface. Reads "pilot authentication" — that is the level of restraint.
 *
 * @startingPoint section="Training" subtitle="pilot authentication — the entry surface" viewport="700x400"
 */
export interface SignInCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  /** Field placeholder names, lowercase. */
  fields?: string[];
  action?: React.ReactNode;
  /** Footer line. Default "DS-01 // built for the long haul". */
  footer?: React.ReactNode;
  onAction?: () => void;
}

export function SignInCard(props: SignInCardProps): React.JSX.Element;
