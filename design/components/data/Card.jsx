import React from "react";

export function Card({ children, style, padding = 16 }) {
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)", overflow: "hidden", ...style }}>
      <div style={{ padding }}>{children}</div>
    </div>
  );
}
export function CardHeader({ children, style }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, ...style }}>{children}</div>;
}
export function CardTitle({ children }) {
  return <div style={{ font: "var(--text-h4)" }}>{children}</div>;
}
export function CardDescription({ children }) {
  return <div style={{ font: "var(--text-body-sm)", color: "var(--color-foreground-muted)" }}>{children}</div>;
}
export function CardContent({ children, style }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>{children}</div>;
}
export function CardFooter({ children, style }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)", ...style }}>{children}</div>;
}
