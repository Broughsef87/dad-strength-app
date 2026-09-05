import * as React from "react";

/** A status line. There are two tones — there is deliberately no warning. */
export interface StatusMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "good" (volt fill, brand-text ink) or "danger". Default "good". */
  tone?: "good" | "danger";
  children?: React.ReactNode;
}

export function StatusMessage(props: StatusMessageProps): JSX.Element;
