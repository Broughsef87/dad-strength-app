import * as React from "react";

/** Vertical cells where a spent cell means a completed set. */
export interface AmmoCellsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Prescribed sets. Default 5. */
  total?: number;
  /** Completed sets. Default 0. */
  spent?: number;
}

export function AmmoCells(props: AmmoCellsProps): JSX.Element;
