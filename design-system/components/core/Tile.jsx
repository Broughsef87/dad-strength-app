import React from "react";

/**
 * Tile — the base surface. Floats on shadow, never a border.
 */
export function Tile({ size = "md", as: Tag = "div", style, children, ...rest }) {
  const pad = size === "lg" ? "var(--ds-tile-lg-padding)" : "var(--ds-tile-padding)";
  const radius = size === "lg" ? "var(--ds-radius-tile-lg)" : "var(--ds-radius-tile)";
  return (
    <Tag
      style={{
        background: "var(--ds-tile)",
        borderRadius: radius,
        padding: pad,
        boxShadow: "var(--ds-shadow-tile)",
        color: "var(--ds-ink)",
        fontFamily: "var(--ds-font-sans)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--ds-space-5)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
