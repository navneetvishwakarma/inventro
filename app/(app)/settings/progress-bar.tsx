// Composed from tokens only -- not a first-class design-system component
// (see design/CHANGELOG.md "Components with no design-system match"),
// same status as insights/progress-bar.tsx.
export function ProgressBar({ value, max, tone = 'bg-primary' }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
