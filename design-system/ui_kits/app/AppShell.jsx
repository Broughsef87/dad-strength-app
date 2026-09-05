/* dad strength — shell: phone frame, header, bottom nav, theme switch. */
function AppShell({ theme, onTheme, tab, onTab, children, chromeless }) {
  const { Eyebrow } = window.__DS;
  const tabs = [
    { id: "today", label: "today" },
    { id: "week", label: "week" },
    { id: "log", label: "log" },
  ];
  return (
    <div
      data-theme={theme === "graphite" ? "graphite" : undefined}
      style={{
        width: 390,
        height: 720,
        borderRadius: 40,
        background: "var(--ds-background)",
        color: "var(--ds-ink)",
        fontFamily: "var(--ds-font-sans)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 30px 80px -30px rgba(20,20,18,0.45)",
      }}
    >
      {!chromeless && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "20px 20px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="../../assets/ds-mark-volt.svg" width="24" height="24" alt="" />
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>dad strength</span>
          </div>
          <button
            type="button"
            onClick={onTheme}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              background: "var(--ds-recessed)",
              color: "var(--ds-ink)",
              borderRadius: "var(--ds-radius-control)",
              padding: "7px 14px",
              fontFamily: "var(--ds-font-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
            }}
          >
            {theme === "graphite" ? "graphite" : "chalk"}
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>{children}</div>

      {!chromeless && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 22px" }}>
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTab(t.id)}
                style={{
                  appearance: "none",
                  border: "none",
                  cursor: "pointer",
                  flex: 1,
                  borderRadius: "var(--ds-radius-control)",
                  padding: "11px 0",
                  fontFamily: "var(--ds-font-sans)",
                  fontSize: 14,
                  fontWeight: on ? 600 : 500,
                  background: on ? "var(--ds-volt-fill)" : "var(--ds-recessed)",
                  color: on ? "var(--ds-on-volt)" : "var(--ds-concrete)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
window.AppShell = AppShell;
