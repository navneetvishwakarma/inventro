/* @ds-bundle: {"format":4,"namespace":"InventroDesignSystem_2cd99f","components":[{"name":"Card","sourcePath":"components/data/Card.jsx"},{"name":"CardHeader","sourcePath":"components/data/Card.jsx"},{"name":"CardTitle","sourcePath":"components/data/Card.jsx"},{"name":"CardDescription","sourcePath":"components/data/Card.jsx"},{"name":"CardContent","sourcePath":"components/data/Card.jsx"},{"name":"CardFooter","sourcePath":"components/data/Card.jsx"},{"name":"ListRow","sourcePath":"components/data/ListRow.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"TableRowMobile","sourcePath":"components/data/Table.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Label","sourcePath":"components/forms/Label.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/data/Card.jsx":"203c690dad6d","components/data/ListRow.jsx":"c09306deced4","components/data/Table.jsx":"a00b75308f51","components/feedback/Alert.jsx":"2082dec6eafd","components/feedback/Badge.jsx":"78dda61a48bc","components/feedback/EmptyState.jsx":"3f2a3183c10b","components/feedback/Skeleton.jsx":"59624cac7b85","components/forms/Button.jsx":"7b3a4f3a92cc","components/forms/Checkbox.jsx":"37912ab85f7f","components/forms/Input.jsx":"ee90d813b924","components/forms/Label.jsx":"f687669f65ae","components/forms/Radio.jsx":"de4818ff1432","components/forms/Select.jsx":"ff9246120601","components/forms/Switch.jsx":"66f9c37dda90","components/forms/Textarea.jsx":"e81b7e60ed6a","components/navigation/Sidebar.jsx":"1c2943707836","components/navigation/TabBar.jsx":"8820abbf61d8","components/navigation/Tabs.jsx":"3f1d4458bc20"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.InventroDesignSystem_2cd99f = window.InventroDesignSystem_2cd99f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data/Card.jsx
try { (() => {
function Card({
  children,
  style,
  padding = 16
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-sm)",
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding
    }
  }, children));
}
function CardHeader({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      marginBottom: 12,
      ...style
    }
  }, children);
}
function CardTitle({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-h4)"
    }
  }, children);
}
function CardDescription({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-body-sm)",
      color: "var(--color-foreground-muted)"
    }
  }, children);
}
function CardContent({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      ...style
    }
  }, children);
}
function CardFooter({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
      borderTop: "1px solid var(--color-border)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/ListRow.jsx
try { (() => {
function ListRow({
  title,
  subtitle,
  meta = [],
  trailing,
  href,
  onClick
}) {
  const Tag = href ? "a" : "div";
  return /*#__PURE__*/React.createElement(Tag, {
    href: href,
    onClick: onClick,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      padding: 12,
      borderRadius: "var(--radius-md)",
      border: "1px solid var(--color-border)",
      textDecoration: "none",
      color: "inherit",
      cursor: href || onClick ? "pointer" : "default",
      transition: "background var(--duration-fast) var(--ease-standard)"
    },
    onMouseEnter: e => e.currentTarget.style.background = "var(--color-surface-sunken)",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "600 14px/1.3 var(--font-sans)",
      color: "var(--color-foreground)"
    }
  }, title), trailing), subtitle && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-body-sm)",
      color: "var(--color-foreground-muted)"
    }
  }, subtitle), meta.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      font: "var(--text-caption)",
      color: "var(--color-foreground-muted)"
    }
  }, meta.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, m))));
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
function Table({
  columns,
  rows,
  keyField = "id"
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      font: "var(--text-body-sm)"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      textAlign: c.align || "left",
      padding: "8px 10px",
      borderBottom: "1px solid var(--color-border-strong)",
      color: "var(--color-foreground-muted)",
      font: "600 11px/1 var(--font-sans)",
      textTransform: "uppercase",
      letterSpacing: "0.04em"
    }
  }, c.header)))), /*#__PURE__*/React.createElement("tbody", null, rows.map(row => /*#__PURE__*/React.createElement("tr", {
    key: row[keyField]
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      textAlign: c.align || "left",
      padding: "10px",
      borderBottom: "1px solid var(--color-border)",
      color: "var(--color-foreground)",
      fontVariantNumeric: c.numeric ? "tabular-nums" : undefined,
      fontFamily: c.numeric ? "var(--font-mono)" : undefined
    }
  }, c.render ? c.render(row) : row[c.key])))))));
}
function TableRowMobile({
  primary,
  secondary,
  meta
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      padding: "12px 4px",
      borderBottom: "1px solid var(--color-border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      font: "500 14px/1.3 var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("span", null, primary), secondary && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontVariantNumeric: "tabular-nums"
    }
  }, secondary)), meta && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-caption)",
      color: "var(--color-foreground-muted)"
    }
  }, meta));
}
Object.assign(__ds_scope, { Table, TableRowMobile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
const TONES = {
  info: {
    bg: "var(--color-info-subtle)",
    fg: "var(--color-info-foreground)",
    border: "var(--info-300)"
  },
  warning: {
    bg: "var(--color-warning-subtle)",
    fg: "var(--color-warning-foreground)",
    border: "var(--gold-300)"
  },
  success: {
    bg: "var(--color-success-subtle)",
    fg: "var(--color-success-foreground)",
    border: "var(--success-300)"
  },
  error: {
    bg: "var(--color-error-subtle)",
    fg: "var(--color-error-foreground)",
    border: "var(--red-300)"
  }
};
function Alert({
  tone = "info",
  title,
  children,
  action
}) {
  const t = TONES[tone] || TONES.info;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      padding: "12px 14px",
      borderRadius: "var(--radius-md)",
      background: t.bg,
      border: `1px solid ${t.border}`
    }
  }, title && /*#__PURE__*/React.createElement("strong", {
    style: {
      font: "600 13px/1.3 var(--font-sans)",
      color: t.fg
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 13px/1.45 var(--font-sans)",
      color: t.fg
    }
  }, children), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2
    }
  }, action));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
const TONES = {
  neutral: {
    bg: "var(--color-surface-sunken)",
    fg: "var(--color-foreground-muted)"
  },
  brand: {
    bg: "var(--color-primary-subtle)",
    fg: "var(--color-primary-subtle-foreground)"
  },
  gold: {
    bg: "var(--color-secondary-subtle)",
    fg: "var(--color-secondary-subtle-foreground)"
  },
  success: {
    bg: "var(--color-success-subtle)",
    fg: "var(--color-success-foreground)"
  },
  warning: {
    bg: "var(--color-warning-subtle)",
    fg: "var(--color-warning-foreground)"
  },
  error: {
    bg: "var(--color-error-subtle)",
    fg: "var(--color-error-foreground)"
  },
  info: {
    bg: "var(--color-info-subtle)",
    fg: "var(--color-info-foreground)"
  }
};
function Badge({
  children,
  tone = "neutral"
}) {
  const t = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      height: 22,
      padding: "0 8px",
      borderRadius: "var(--radius-full)",
      background: t.bg,
      color: t.fg,
      font: "600 11px/1 var(--font-sans)",
      letterSpacing: "0.01em",
      whiteSpace: "nowrap"
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  icon,
  title,
  description,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: 8,
      padding: "40px 20px",
      color: "var(--color-foreground-muted)"
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--color-foreground-subtle)"
    }
  }, icon), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: "600 15px/1.3 var(--font-sans)",
      color: "var(--color-foreground)"
    }
  }, title), description && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 14px/1.5 var(--font-sans)",
      maxWidth: 320
    }
  }, description), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, action));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
function Skeleton({
  width = "100%",
  height = 16,
  radius = "var(--radius-sm)",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      borderRadius: radius,
      background: "linear-gradient(90deg, var(--color-surface-sunken) 25%, var(--color-border) 50%, var(--color-surface-sunken) 75%)",
      backgroundSize: "200% 100%",
      animation: "inv-shimmer 1.4s ease-in-out infinite",
      ...style
    }
  }, /*#__PURE__*/React.createElement("style", null, `@keyframes inv-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    height: 32,
    padding: "0 12px",
    font: "600 13px/1 var(--font-sans)",
    gap: 6,
    radius: "var(--radius-md)"
  },
  md: {
    height: 40,
    padding: "0 16px",
    font: "600 14px/1 var(--font-sans)",
    gap: 8,
    radius: "var(--radius-md)"
  },
  lg: {
    height: 48,
    padding: "0 20px",
    font: "600 15px/1 var(--font-sans)",
    gap: 8,
    radius: "var(--radius-lg)"
  },
  icon: {
    height: 40,
    width: 40,
    padding: 0,
    font: "600 14px/1 var(--font-sans)",
    gap: 0,
    radius: "var(--radius-md)"
  }
};
function paletteFor(variant) {
  switch (variant) {
    case "primary":
      return {
        bg: "var(--color-primary)",
        bgHover: "var(--color-primary-hover)",
        bgActive: "var(--color-primary-active)",
        fg: "var(--color-primary-foreground)",
        border: "transparent"
      };
    case "secondary":
      return {
        bg: "var(--color-secondary)",
        bgHover: "var(--color-secondary-hover)",
        bgActive: "var(--gold-700)",
        fg: "var(--color-secondary-foreground)",
        border: "transparent"
      };
    case "tertiary":
      return {
        bg: "transparent",
        bgHover: "var(--color-tertiary-subtle)",
        bgActive: "var(--color-tertiary-subtle)",
        fg: "var(--color-tertiary)",
        border: "transparent"
      };
    case "outline":
      return {
        bg: "var(--color-surface)",
        bgHover: "var(--color-surface-sunken)",
        bgActive: "var(--color-surface-sunken)",
        fg: "var(--color-foreground)",
        border: "var(--color-border-strong)"
      };
    case "ghost":
      return {
        bg: "transparent",
        bgHover: "var(--color-surface-sunken)",
        bgActive: "var(--color-surface-sunken)",
        fg: "var(--color-foreground)",
        border: "transparent"
      };
    case "destructive":
      return {
        bg: "var(--color-error-subtle)",
        bgHover: "color-mix(in oklch, var(--color-error-subtle), var(--color-error) 20%)",
        bgActive: "color-mix(in oklch, var(--color-error-subtle), var(--color-error) 35%)",
        fg: "var(--color-error-foreground)",
        border: "transparent"
      };
    default:
      return {
        bg: "var(--color-primary)",
        bgHover: "var(--color-primary-hover)",
        bgActive: "var(--color-primary-active)",
        fg: "var(--color-primary-foreground)",
        border: "transparent"
      };
  }
}
function Button({
  variant = "primary",
  size = "md",
  icon = null,
  iconPosition = "start",
  loading = false,
  disabled = false,
  children,
  onClick,
  type = "button",
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const s = SIZES[size] || SIZES.md;
  const p = paletteFor(variant);
  const isDisabled = disabled || loading;
  const bg = isDisabled ? p.bg : active ? p.bgActive : hover ? p.bgHover : p.bg;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: isDisabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: s.gap,
      height: s.height,
      width: s.width,
      padding: s.padding,
      font: s.font,
      borderRadius: s.radius,
      background: bg,
      color: p.fg,
      border: `1px solid ${p.border}`,
      cursor: isDisabled ? "not-allowed" : "pointer",
      opacity: isDisabled && !loading ? 0.5 : 1,
      transition: `background var(--duration-fast) var(--ease-standard), transform var(--duration-instant) var(--ease-standard)`,
      transform: active && !isDisabled ? "translateY(1px)" : "none",
      outline: "none",
      boxShadow: "none",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), loading ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      borderRadius: "50%",
      border: `2px solid currentColor`,
      borderTopColor: "transparent",
      animation: "inv-spin 0.6s linear infinite"
    }
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, icon && iconPosition === "start" && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 16,
      height: 16
    }
  }, icon), size !== "icon" && children, icon && iconPosition === "end" && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 16,
      height: 16
    }
  }, icon), size === "icon" && !icon && children), /*#__PURE__*/React.createElement("style", null, `@keyframes inv-spin{to{transform:rotate(360deg)}}`));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  checked = false,
  onChange,
  label,
  disabled = false,
  id
}) {
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      font: "400 14px/1.3 var(--font-sans)",
      color: "var(--color-foreground)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      width: 18,
      height: 18,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: id,
    type: "checkbox",
    checked: checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      margin: 0,
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "var(--radius-sm)",
      border: `1.5px solid ${checked ? "var(--color-primary)" : "var(--color-border-strong)"}`,
      background: checked ? "var(--color-primary)" : "var(--color-surface)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)"
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2.5 6.2 5 8.7 9.5 3.5",
    stroke: "var(--color-primary-foreground)",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })))), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  label,
  error,
  helperText,
  size = "md",
  disabled = false,
  style,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const height = size === "sm" ? 36 : 44;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      width: "100%"
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      font: "600 13px/1.3 var(--font-sans)",
      color: "var(--color-foreground)"
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    disabled: disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      height,
      width: "100%",
      padding: "0 12px",
      font: "400 15px/1.4 var(--font-sans)",
      background: disabled ? "var(--color-surface-sunken)" : "var(--color-surface)",
      color: "var(--color-foreground)",
      border: `1px solid ${error ? "var(--color-error)" : focused ? "var(--color-primary)" : "var(--color-border)"}`,
      borderRadius: "var(--radius-md)",
      outline: "none",
      boxShadow: focused ? error ? "0 0 0 3px color-mix(in oklch, var(--color-error) 25%, transparent)" : "var(--ring-focus)" : "none",
      transition: "border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
      cursor: disabled ? "not-allowed" : "text",
      opacity: disabled ? 0.6 : 1,
      ...style
    }
  }, rest)), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 12px/1.3 var(--font-sans)",
      color: "var(--color-error)"
    }
  }, error) : helperText ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 12px/1.3 var(--font-sans)",
      color: "var(--color-foreground-muted)"
    }
  }, helperText) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Label.jsx
try { (() => {
function Label({
  children,
  htmlFor,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: htmlFor,
    style: {
      font: "600 13px/1.3 var(--font-sans)",
      color: "var(--color-foreground)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Label.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function Radio({
  checked = false,
  onChange,
  label,
  name,
  disabled = false,
  id
}) {
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      font: "400 14px/1.3 var(--font-sans)",
      color: "var(--color-foreground)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      width: 18,
      height: 18,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: id,
    type: "radio",
    name: name,
    checked: checked,
    disabled: disabled,
    onChange: () => onChange && onChange(),
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      margin: 0,
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "var(--radius-full)",
      border: `1.5px solid ${checked ? "var(--color-primary)" : "var(--color-border-strong)"}`,
      background: "var(--color-surface)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "border-color var(--duration-fast) var(--ease-standard)"
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: "var(--color-primary)"
    }
  }))), label);
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  label,
  error,
  helperText,
  options = [],
  placeholder,
  disabled = false,
  style,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      width: "100%"
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      font: "600 13px/1.3 var(--font-sans)",
      color: "var(--color-foreground)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    disabled: disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    defaultValue: "",
    style: {
      height: 44,
      width: "100%",
      padding: "0 36px 0 12px",
      font: "400 15px/1.4 var(--font-sans)",
      appearance: "none",
      background: disabled ? "var(--color-surface-sunken)" : "var(--color-surface)",
      color: "var(--color-foreground)",
      border: `1px solid ${error ? "var(--color-error)" : focused ? "var(--color-primary)" : "var(--color-border)"}`,
      borderRadius: "var(--radius-md)",
      outline: "none",
      boxShadow: focused ? "var(--ring-focus)" : "none",
      cursor: disabled ? "not-allowed" : "pointer",
      ...style
    }
  }, rest), placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 12,
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
      color: "var(--color-foreground-muted)",
      fontSize: 10
    }
  }, "\u25BE")), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 12px/1.3 var(--font-sans)",
      color: "var(--color-error)"
    }
  }, error) : helperText ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 12px/1.3 var(--font-sans)",
      color: "var(--color-foreground-muted)"
    }
  }, helperText) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked = false,
  onChange,
  label,
  disabled = false,
  id
}) {
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      font: "400 14px/1.3 var(--font-sans)",
      color: "var(--color-foreground)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      width: 40,
      height: 24,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: id,
    type: "checkbox",
    checked: checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      margin: 0,
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "var(--radius-full)",
      background: checked ? "var(--color-primary)" : "var(--color-border-strong)",
      transition: "background var(--duration-fast) var(--ease-standard)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: checked ? 19 : 3,
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "var(--shadow-sm)",
      transition: "left var(--duration-fast) var(--ease-standard)"
    }
  }))), label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  label,
  error,
  helperText,
  rows = 4,
  disabled = false,
  style,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      width: "100%"
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      font: "600 13px/1.3 var(--font-sans)",
      color: "var(--color-foreground)"
    }
  }, label), /*#__PURE__*/React.createElement("textarea", _extends({
    rows: rows,
    disabled: disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      width: "100%",
      padding: "10px 12px",
      font: "400 15px/1.5 var(--font-sans)",
      resize: "vertical",
      background: disabled ? "var(--color-surface-sunken)" : "var(--color-surface)",
      color: "var(--color-foreground)",
      border: `1px solid ${error ? "var(--color-error)" : focused ? "var(--color-primary)" : "var(--color-border)"}`,
      borderRadius: "var(--radius-md)",
      outline: "none",
      boxShadow: focused ? "var(--ring-focus)" : "none",
      transition: "border-color var(--duration-fast) var(--ease-standard)",
      ...style
    }
  }, rest)), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 12px/1.3 var(--font-sans)",
      color: "var(--color-error)"
    }
  }, error) : helperText ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 12px/1.3 var(--font-sans)",
      color: "var(--color-foreground-muted)"
    }
  }, helperText) : null);
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
const ITEMS = [{
  key: "today",
  label: "Today"
}, {
  key: "add",
  label: "Add"
}, {
  key: "review",
  label: "Review"
}, {
  key: "inventory",
  label: "Inventory"
}, {
  key: "plan",
  label: "Plan"
}, {
  key: "shopping-list",
  label: "Shopping list"
}, {
  key: "insights",
  label: "Insights"
}, {
  key: "catalog",
  label: "Catalog"
}, {
  key: "settings",
  label: "Settings"
}];
function Sidebar({
  active = "today",
  onNavigate,
  items = ITEMS,
  householdName = "Household"
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      width: 220,
      flexShrink: 0,
      height: "100%",
      background: "var(--color-surface)",
      borderRight: "1px solid var(--color-border)",
      display: "flex",
      flexDirection: "column",
      padding: "20px 12px",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "700 16px/1.2 var(--font-sans)",
      color: "var(--color-foreground)",
      padding: "0 10px 16px"
    }
  }, householdName), items.map(it => {
    const isActive = it.key === active;
    return /*#__PURE__*/React.createElement("a", {
      key: it.key,
      href: it.href || "#",
      onClick: e => {
        if (onNavigate) {
          e.preventDefault();
          onNavigate(it.key);
        }
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 38,
        padding: "0 10px",
        borderRadius: "var(--radius-md)",
        font: isActive ? "600 14px/1 var(--font-sans)" : "400 14px/1 var(--font-sans)",
        color: isActive ? "var(--color-primary-subtle-foreground)" : "var(--color-foreground-muted)",
        background: isActive ? "var(--color-primary-subtle)" : "transparent",
        textDecoration: "none"
      },
      onMouseEnter: e => {
        if (!isActive) e.currentTarget.style.background = "var(--color-surface-sunken)";
      },
      onMouseLeave: e => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }
    }, it.label, it.count ? /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        font: "600 11px/1 var(--font-mono)",
        color: "var(--color-foreground-subtle)"
      }
    }, it.count) : null);
  }));
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
const ITEMS = [{
  key: "today",
  label: "Today"
}, {
  key: "inventory",
  label: "Inventory"
}, {
  key: "add",
  label: "Add"
}, {
  key: "plan",
  label: "Plan"
}, {
  key: "insights",
  label: "Insights"
}];
function TabBar({
  active = "today",
  onNavigate,
  items = ITEMS
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      height: 64,
      background: "var(--color-surface)",
      borderTop: "1px solid var(--color-border)",
      paddingBottom: "var(--safe-bottom)"
    }
  }, items.map(it => {
    const isActive = it.key === active;
    const isCenter = it.key === "add";
    return /*#__PURE__*/React.createElement("a", {
      key: it.key,
      href: it.href || "#",
      onClick: e => {
        if (onNavigate) {
          e.preventDefault();
          onNavigate(it.key);
        }
      },
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        textDecoration: "none",
        minHeight: 44,
        color: isActive ? "var(--color-primary)" : "var(--color-foreground-muted)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: isCenter ? 34 : 22,
        height: isCenter ? 34 : 22,
        borderRadius: isCenter ? "var(--radius-full)" : 0,
        background: isCenter ? "var(--color-primary)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: isCenter ? "var(--color-primary-foreground)" : "inherit",
        font: "700 15px/1 var(--font-sans)"
      }
    }, isCenter ? "+" : "•"), /*#__PURE__*/React.createElement("span", {
      style: {
        font: isActive ? "600 10.5px/1 var(--font-sans)" : "400 10.5px/1 var(--font-sans)"
      }
    }, it.label));
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items,
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, items.map(it => {
    const isActive = it.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      onClick: () => onChange && onChange(it.value),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 32,
        padding: "0 12px",
        borderRadius: "var(--radius-full)",
        border: `1px solid ${isActive ? "var(--color-primary)" : "var(--color-border)"}`,
        background: isActive ? "var(--color-primary-subtle)" : "var(--color-surface)",
        color: isActive ? "var(--color-primary-subtle-foreground)" : "var(--color-foreground-muted)",
        font: isActive ? "600 13px/1 var(--font-sans)" : "400 13px/1 var(--font-sans)",
        cursor: "pointer"
      }
    }, it.label, it.count !== undefined ? /*#__PURE__*/React.createElement("span", {
      style: {
        font: "600 11px/1 var(--font-mono)"
      }
    }, "(", it.count, ")") : null);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardTitle = __ds_scope.CardTitle;

__ds_ns.CardDescription = __ds_scope.CardDescription;

__ds_ns.CardContent = __ds_scope.CardContent;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.TableRowMobile = __ds_scope.TableRowMobile;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
