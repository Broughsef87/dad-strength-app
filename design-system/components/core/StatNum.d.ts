import * as React from "react";

/** The hero numeral — the load, the week, the streak. Numerals lead every card. */
export interface StatNumProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  /** lg 72px · md 44px · sm 30px. Default "lg". */
  size?: "lg" | "md" | "sm";
  /** Optional mono micro-label rendered beneath. */
  label?: React.ReactNode;
}

export function StatNum(props: StatNumProps): JSX.Element;
