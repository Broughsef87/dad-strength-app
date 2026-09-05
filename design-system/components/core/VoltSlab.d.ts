import * as React from "react";

/** The highlighter. A squared volt slab marking the number you lift. */
export interface VoltSlabProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The load. Numerals only. */
  children?: React.ReactNode;
  /** sm 22px · md 30px · lg 44px. Default "md". */
  size?: "sm" | "md" | "lg";
}

export function VoltSlab(props: VoltSlabProps): JSX.Element;
