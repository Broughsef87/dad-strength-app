// A block as a strip of week cells, the LedBar at full width. Weeks up to
// `at` are lit (earned); the last two are the deload and the test week, the
// shape every program shares (macroWeeks - 1 and macroWeeks).
export default function BlockBar({ weeks, at }: { weeks: number; at: number }) {
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: weeks }, (_, i) => (
          <span
            key={i}
            className={`led-cell h-2.5${i < at ? ' lit' : ''}`}
            style={{ flex: '1 1 0', width: 'auto' }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1">
        <span className="eyebrow-mono">build · wk 1–{weeks - 2}</span>
        <span className="eyebrow-mono">deload wk {weeks - 1} · test wk {weeks}</span>
      </div>
    </div>
  );
}
