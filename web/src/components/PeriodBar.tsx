export const PERIODS = [
  { key: "1g", label: "1G" },
  { key: "1h", label: "1H" },
  { key: "1a", label: "1A" },
  { key: "3a", label: "3A" },
  { key: "6a", label: "6A" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
] as const;

export function PeriodBar({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div role="group" aria-label="Dönem">
      {PERIODS.map((p) => (
        <button key={p.key} type="button" aria-pressed={value === p.key} onClick={() => onChange(p.key)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}
