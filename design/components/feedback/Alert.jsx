import React from "react";

const TONES = {
  info: { bg: "var(--color-info-subtle)", fg: "var(--color-info-foreground)", border: "var(--info-300)" },
  warning: { bg: "var(--color-warning-subtle)", fg: "var(--color-warning-foreground)", border: "var(--gold-300)" },
  success: { bg: "var(--color-success-subtle)", fg: "var(--color-success-foreground)", border: "var(--success-300)" },
  error: { bg: "var(--color-error-subtle)", fg: "var(--color-error-foreground)", border: "var(--red-300)" },
};

export function Alert({ tone = "info", title, children, action }) {
  const t = TONES[tone] || TONES.info;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: "var(--radius-md)", background: t.bg, border: `1px solid ${t.border}` }}>
      {title && <strong style={{ font: "600 13px/1.3 var(--font-sans)", color: t.fg }}>{title}</strong>}
      <span style={{ font: "400 13px/1.45 var(--font-sans)", color: t.fg }}>{children}</span>
      {action && <div style={{ marginTop: 2 }}>{action}</div>}
    </div>
  );
}
