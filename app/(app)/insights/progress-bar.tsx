// Composed from tokens only -- not a first-class design-system component
// (see design/CHANGELOG.md "Components with no design-system match"),
// same status as inventory/sparkline.tsx.
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}
