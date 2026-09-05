import * as React from "react";

/**
 * The base surface of the system. Tiles float on shadow, not borders.
 *
 * @startingPoint section="Surfaces" subtitle="Shadow-floated surface, 20px or 24px" viewport="700x300"
 */
export interface TileProps extends React.HTMLAttributes<HTMLElement> {
  /** md = 20px radius / 22px padding. lg = 24px / 28px. Default "md". */
  size?: "md" | "lg";
  /** Element to render. Default "div". */
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
}

export function Tile(props: TileProps): JSX.Element;
