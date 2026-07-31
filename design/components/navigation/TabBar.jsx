import React from "react";

const ITEMS = [
  { key: "today", label: "Today" },
  { key: "inventory", label: "Inventory" },
  { key: "add", label: "Add" },
  { key: "plan", label: "Plan" },
  { key: "insights", label: "Insights" },
];

export function TabBar({ active = "today", onNavigate, items = ITEMS }) {
  return (
    <nav style={{
      display: "flex", height: 64, background: "var(--color-surface)", borderTop: "1px solid var(--color-border)",
      paddingBottom: "var(--safe-bottom)",
    }}>
      {items.map((it) => {
        const isActive = it.key === active;
        const isCenter = it.key === "add";
        return (
          <a key={it.key} href={it.href || "#"} onClick={(e) => { if (onNavigate) { e.preventDefault(); onNavigate(it.key); } }}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
              textDecoration: "none", minHeight: 44,
              color: isActive ? "var(--color-primary)" : "var(--color-foreground-muted)",
            }}
          >
            <span style={{
              width: isCenter ? 34 : 22, height: isCenter ? 34 : 22, borderRadius: isCenter ? "var(--radius-full)" : 0,
              background: isCenter ? "var(--color-primary)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: isCenter ? "var(--color-primary-foreground)" : "inherit", font: "700 15px/1 var(--font-sans)",
            }}>{isCenter ? "+" : "•"}</span>
            <span style={{ font: isActive ? "600 10.5px/1 var(--font-sans)" : "400 10.5px/1 var(--font-sans)" }}>{it.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
