import * as React from "react";

/** A row inside a Tile, recessed by fill rather than divided by a line. */
export interface RecessedRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Left-hand label, prose. */
  label?: React.ReactNode;
  /** Right-hand value, rendered in data-mono with tabular numerals. */
  value?: React.ReactNode;
  /** Recede the value to concrete. Never use opacity for this. */
  muted?: boolean;
  /** Bypass label/value and lay the row out yourself. */
  children?: React.ReactNode;
}

export function RecessedRow(props: RecessedRowProps): JSX.Element;
