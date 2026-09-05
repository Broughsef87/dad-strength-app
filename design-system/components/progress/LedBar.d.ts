import * as React from "react";

/** Segmented progress. Lit cells are volt — one of its three permitted meanings (earned). */
export interface LedBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Total cells. Default 4. */
  total?: number;
  /** How many are lit. Default 0. */
  lit?: number;
  /** Optional trailing mono label. */
  label?: React.ReactNode;
}

export function LedBar(props: LedBarProps): JSX.Element;
