import React from "react";

/**
 * DayPills — the training week. A volt pill is a day that is done.
 */
export function DayPills({ days = [], style, ...rest }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-space-3)", ...style }} {...rest}>
      {days.map((d) => (
        <span
          key={d.label}
          style={{
            width: "var(--ds-day-pill-size)",
            height: "var(--ds-day-pill-size)",
            borderRadius: "var(--ds-radius-control)",
            background: d.done ? "var(--ds-volt-fill)" : "var(--ds-recessed)",
            color: d.done ? "var(--ds-on-volt)" : "var(--ds-concrete)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--ds-font-mono)",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          {d.label}
        </span>
      ))}
    </div>
  );
}
