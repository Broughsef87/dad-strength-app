import React from "react";

/**
 * ChipLive — the "live" chip. brand-muted tint, brand-text, leading dot.
 */
export function ChipLive({ children = "live", dot = true, size = "md", style, ...rest }) {
  const sm = size === "sm";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        background: "var(--ds-brand-muted)",
        color: "var(--ds-brand-text)",
        borderRadius: "var(--ds-radius-control)",
        padding: sm ? "5px 11px" : "9px 15px",
        fontFamily: "var(--ds-font-mono)",
        fontSize: sm ? "10px" : "11px",
        letterSpacing: "0.06em",
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          style={{
            width: sm ? "5px" : "6px",
            height: sm ? "5px" : "6px",
            borderRadius: "50%",
            background: "var(--ds-volt-fill)",
            flex: "none",
          }}
        />
      )}
      {children}
    </span>
  );
}
