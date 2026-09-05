import * as React from "react";

/**
 * The base surface of the system. Tiles float on shadow, not borders.
 *
 * @startingPoint section="Surfaces" subtitle="Shadow-floated surface, 20px or 24px" viewport="700x300"
 */
export type TileProps<T extends keyof React.JSX.IntrinsicElements = "div"> =
  Omit<React.ComponentPropsWithoutRef<T>, "as" | "children"> & {
    /** md = 20px radius / 22px padding. lg = 24px / 28px. Default "md". */
    size?: "md" | "lg";
    /** Element to render. Default "div". Its attributes follow: `<Tile as="a" href="…">`. */
    as?: T;
    children?: React.ReactNode;
  };

export function Tile<T extends keyof React.JSX.IntrinsicElements = "div">(props: TileProps<T>): React.JSX.Element;
