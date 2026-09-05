import * as React from "react";

/** The week as pills. A volt pill means earned. */
export interface DayPillsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ordered days. `label` is a 3-letter lowercase day. */
  days?: Array<{ label: string; done?: boolean }>;
}

export function DayPills(props: DayPillsProps): JSX.Element;
