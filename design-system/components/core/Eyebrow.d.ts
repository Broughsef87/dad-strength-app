import * as React from "react";

/** The mono voice: section eyebrows and card metadata. Lowercase, letter-spaced, concrete. */
export interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  /** "sm" 10px / 0.14em · "md" 11px / 0.16em. Default "md". */
  size?: "sm" | "md";
}

export function Eyebrow(props: EyebrowProps): JSX.Element;
