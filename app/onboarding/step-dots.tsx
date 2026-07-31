// Composed from tokens only -- not a first-class design-system component
// (see design/CHANGELOG.md "Components with no design-system match").
export function StepDots({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const state = n === step ? 'current' : n < step ? 'done' : 'upcoming';
        return (
          <div key={i} className="flex items-center">
            <span
              className={
                state === 'current'
                  ? 'flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground'
                  : state === 'done'
                    ? 'flex size-6 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary-subtle-foreground'
                    : 'flex size-6 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-foreground-subtle'
              }
            >
              {n}
            </span>
            {i < total - 1 && <span className="h-px w-[30px] bg-border-strong" />}
          </div>
        );
      })}
    </div>
  );
}
