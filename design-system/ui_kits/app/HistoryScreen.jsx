/* dad strength — the log. */
function HistoryScreen({ entries }) {
  const { Tile, Eyebrow, RecessedRow, CategoryChip, StatNum } = window.__DS;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
      <Tile style={{ gap: 14 }}>
        <Eyebrow size="sm">the log</Eyebrow>
        <StatNum size="md" label="sessions logged">42</StatNum>
      </Tile>
      <Tile style={{ gap: 8 }}>
        {entries.map((e, i) => (
          <RecessedRow key={i}>
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{e.name}</span>
              <Eyebrow size="sm">{e.meta}</Eyebrow>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--ds-font-mono)", fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{e.load}</span>
              <CategoryChip axis={e.axis} />
            </span>
          </RecessedRow>
        ))}
      </Tile>
    </div>
  );
}
window.HistoryScreen = HistoryScreen;
