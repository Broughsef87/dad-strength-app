import * as React from "react";

/** Taxonomy chip. Six axes only — color is grouping, so it stays quiet. */
export interface CategoryChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** One of the six axes. Default "general". */
  axis?: "push" | "pull" | "legs" | "core" | "condition" | "general";
  /** Label. Defaults to the axis name. */
  children?: React.ReactNode;
}

export function CategoryChip(props: CategoryChipProps): JSX.Element;
export const CATEGORY_AXES: readonly string[];
