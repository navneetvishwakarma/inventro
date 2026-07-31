import React from "react";

const ITEMS = [
  { key: "today", label: "Today" },
  { key: "add", label: "Add" },
  { key: "review", label: "Review" },
  { key: "inventory", label: "Inventory" },
  { key: "plan", label: "Plan" },
  { key: "shopping-list", label: "Shopping list" },
  { key: "insights", label: "Insights" },
  { key: "catalog", label: "Catalog" },
  { key: "settings", label: "Settings" },
];

export function Sidebar({ active = "today", onNavigate, items = ITEMS, householdName = "Household" }) {
  return (
    <nav style={{ width: 220, flexShrink: 0, height: "100%", background: "var(--color-surface)", borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", padding: "20px 12px", gap: 4 }}>
      <div style={{ font: "700 16px/1.2 var(--font-sans)", color: "var(--color-foreground)", padding: "0 10px 16px" }}>{householdName}</div>
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <a key={it.key} href={it.href || "#"} onClick={(e) => { if (onNavigate) { e.preventDefault(); onNavigate(it.key); } }}
            style={{
              display: "flex", alignItems: "center", gap: 10, height: 38, padding: "0 10px", borderRadius: "var(--radius-md)",
              font: isActive ? "600 14px/1 var(--font-sans)" : "400 14px/1 var(--font-sans)",
              color: isActive ? "var(--color-primary-subtle-foreground)" : "var(--color-foreground-muted)",
              background: isActive ? "var(--color-primary-subtle)" : "transparent",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--color-surface-sunken)"; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
          >
            {it.label}{it.count ? <span style={{ marginLeft: "auto", font: "600 11px/1 var(--font-mono)", color: "var(--color-foreground-subtle)" }}>{it.count}</span> : null}
          </a>
        );
      })}
    </nav>
  );
}
