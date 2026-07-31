import React from "react";

export function Label({ children, htmlFor, style }) {
  return <label htmlFor={htmlFor} style={{ font: "600 13px/1.3 var(--font-sans)", color: "var(--color-foreground)", ...style }}>{children}</label>;
}
