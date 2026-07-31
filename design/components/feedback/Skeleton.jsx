import React from "react";

export function Skeleton({ width = "100%", height = 16, radius = "var(--radius-sm)", style }) {
  return (
    <div style={{ width, height, borderRadius: radius, background: "linear-gradient(90deg, var(--color-surface-sunken) 25%, var(--color-border) 50%, var(--color-surface-sunken) 75%)", backgroundSize: "200% 100%", animation: "inv-shimmer 1.4s ease-in-out infinite", ...style }}>
      <style>{`@keyframes inv-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}
