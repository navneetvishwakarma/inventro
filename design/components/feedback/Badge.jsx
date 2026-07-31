import React from "react";

const TONES = {
  neutral: { bg: "var(--color-surface-sunken)", fg: "var(--color-foreground-muted)" },
  brand: { bg: "var(--color-primary-subtle)", fg: "var(--color-primary-subtle-foreground)" },
  gold: { bg: "var(--color-secondary-subtle)", fg: "var(--color-secondary-subtle-foreground)" },
  success: { bg: "var(--color-success-subtle)", fg: "var(--color-success-foreground)" },
  warning: { bg: "var(--color-warning-subtle)", fg: "var(--color-warning-foreground)" },
  error: { bg: "var(--color-error-subtle)", fg: "var(--color-error-foreground)" },
  info: { bg: "var(--color-info-subtle)", fg: "var(--color-info-foreground)" },
};

export function Badge({ children, tone = "neutral" }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: "var(--radius-full)", background: t.bg, color: t.fg, font: "600 11px/1 var(--font-sans)", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
