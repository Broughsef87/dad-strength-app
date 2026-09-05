import React from "react";

/**
 * Pill — the control. volt (fill + brand-ink) or quiet (recessed fill).
 */
export function Pill({ variant = "volt", full = false, disabled = false, style, children, onPointerDown, onPointerUp, onPointerLeave, ...rest }) {
  const volt = variant === "volt";
  const [down, setDown] = React.useState(false);
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      onPointerDown={(e) => { setDown(true); onPointerDown?.(e); }}
      onPointerUp={(e) => { setDown(false); onPointerUp?.(e); }}
      onPointerLeave={(e) => { setDown(false); onPointerLeave?.(e); }}
      style={{
        appearance: "none",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        borderRadius: "var(--ds-radius-control)",
        padding: "11px 22px",
        fontFamily: "var(--ds-font-sans)",
        fontSize: "14px",
        fontWeight: volt ? 600 : 500,
        width: full ? "100%" : undefined,
        background: volt
          ? down
            ? "var(--ds-volt-fill-pressed)"
            : "var(--ds-volt-fill)"
          : down
            ? "var(--ds-line)"
            : "var(--ds-recessed)",
        color: volt ? "var(--ds-on-volt)" : "var(--ds-ink)",
        filter: disabled ? "saturate(0.15)" : undefined,
        transition: "background var(--ds-dur-press) var(--ds-ease-out)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
