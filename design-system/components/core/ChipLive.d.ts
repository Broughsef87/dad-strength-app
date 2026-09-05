import * as React from "react";

/** The in-progress marker: volt tint, brand-text, leading volt dot. */
export interface ChipLiveProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Label. Default "live". */
  children?: React.ReactNode;
  /** Show the leading dot. Default true. */
  dot?: boolean;
  /** "sm" for inside a tile header. Default "md". */
  size?: "sm" | "md";
}

export function ChipLive(props: ChipLiveProps): JSX.Element;
