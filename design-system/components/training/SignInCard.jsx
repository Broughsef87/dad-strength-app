import React from "react";
import { Tile } from "../core/Tile.jsx";
import { Eyebrow } from "../core/Eyebrow.jsx";
import { RecessedRow } from "../core/RecessedRow.jsx";
import { Pill } from "../core/Pill.jsx";

/**
 * SignInCard — "pilot authentication". The restrained entry surface.
 */
export function SignInCard({ eyebrow = "pilot authentication", title = "sign in", fields = ["email", "passcode"], action = "continue", footer = "DS-01 // built for the long haul", onAction, style, ...rest }) {
  return (
    <Tile size="lg" style={{ gap: "var(--ds-space-6)", ...style }} {...rest}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-space-2)" }}>
        <Eyebrow size="sm">{eyebrow}</Eyebrow>
        <span style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-space-3)" }}>
        {fields.map((name) => (
          <RecessedRow key={name} style={{ padding: "13px 15px" }}>
            <span
              style={{
                fontFamily: "var(--ds-font-mono)",
                fontSize: "var(--ds-data-size-sm)",
                color: "var(--ds-concrete)",
              }}
            >
              {name}
            </span>
          </RecessedRow>
        ))}
      </div>
      <Pill full onClick={onAction}>{action}</Pill>
      {footer && <Eyebrow size="sm" style={{ textAlign: "center" }}>{footer}</Eyebrow>}
    </Tile>
  );
}
