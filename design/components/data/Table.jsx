import React from "react";

export function Table({ columns, rows, keyField = "id" }) {
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", font: "var(--text-body-sm)" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || "left", padding: "8px 10px", borderBottom: "1px solid var(--color-border-strong)", color: "var(--color-foreground-muted)", font: "600 11px/1 var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[keyField]}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || "left", padding: "10px", borderBottom: "1px solid var(--color-border)", color: "var(--color-foreground)", fontVariantNumeric: c.numeric ? "tabular-nums" : undefined, fontFamily: c.numeric ? "var(--font-mono)" : undefined }}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableRowMobile({ primary, secondary, meta }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 4px", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", font: "500 14px/1.3 var(--font-sans)" }}>
        <span>{primary}</span>
        {secondary && <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{secondary}</span>}
      </div>
      {meta && <span style={{ font: "var(--text-caption)", color: "var(--color-foreground-muted)" }}>{meta}</span>}
    </div>
  );
}
