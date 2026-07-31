# Inventro high-fidelity prototypes — changelog

Source wireframes: `design/wireframes/low-fidelity-wireframes.html` (approved).
Design system: `design/tokens/*.css`, `design/components/*` (real React components loaded via `design/_ds_bundle.js`).
Output: `design/screens/01-gate.html` … `14-settings.html`, `design/screens/index.html`.

Every screen file is self-contained (same pattern as the design system's own `*.card.html` specimens): loads `styles.css`, React/ReactDOM/Babel from CDN, `_ds_bundle.js`, then renders a `Demo` component with the web and mobile variant side by side. All 14 files were verified two ways before delivery: Babel-parsed for JSX syntax, and server-rendered end-to-end against the actual compiled component bundle (`react-dom/server`, 14/14 pass) — not just eyeballed.

No new screens, sections, or layout structures were introduced. Structure, element order, grouping, and responsive collapse behavior are carried over from the wireframe stage unchanged; nothing was reordered or dropped.

## Global mapping (applies to every screen)

- Gray text bars → real typography tokens: `--text-h2`/`h3`/`h4` for titles, `--text-body`/`body-sm` for copy, `--text-caption` for meta, `--text-mono`/mono font for prices and quantities (matches the source guideline `type-mono.html`: "Geist Mono for prices, quantities, ledger data").
- Gray boxes/buttons → real `Button` (variant `primary`/`outline`/`ghost`/`tertiary`/`destructive`), `Card`, `Input`, `Select`, `Checkbox`, `Radio` — colors, radius, and shadow all come from the component's own token bindings (`--color-primary*`, `--radius-lg`, `--shadow-sm`), never overridden.
- Placeholder nav → the real `Sidebar` (web, 9 items) and `TabBar` (mobile, 5 items) components, passed the approved item set as `items` props rather than their hardcoded defaults (see "IA note" below — this is normal, documented use of the components' own API, not a deviation).
- Cadence-bucket switcher (Plan) → real `Tabs` component (the design system explicitly built this "to formalize the cadence-bucket switcher on Plan").
- Web table / mobile stacked-card collapse (Review queue) → real `Table` (web) / `TableRowMobile` (mobile) — an exact, dedicated match for that wireframe behavior.
- All spacing uses `--space-*` tokens; all colors use semantic `--color-*` tokens (never a raw hex, never a raw `red-600` etc. reached around the semantic layer). Verified by grep against the design system's own adherence rules (`_adherence.oxlintrc.json`) — zero raw hex, zero raw px string literals found in the output.

**IA note (applies to Today, Add, Review, Inventory, Plan, Shopping list, Insights, Catalog, Settings):** the wireframe stage proposed a specific nav structure (9-item sidebar; 5-slot mobile tab bar — Today / Inventory / Add / **Shop** / **More**, folding Plan+Shopping list under "Shop" and Review+Insights+Catalog+Settings under "More") as its first open question, not yet confirmed. This pass implements that proposal via `Sidebar`'s and `TabBar`'s `items` prop, since both components accept a custom item list. **This still needs your explicit confirmation** — it's carried forward as-proposed, not silently finalized. If you'd rather use `TabBar`'s own default 5 items (Today/Inventory/Add/Plan/Insights), that's a chat-level change (see workflow below), since it changes what's reachable from the tab bar at all.

## Per-screen notes

| # | Screen | Components used | Placeholder content | Deviation from wireframe |
|---|---|---|---|---|
| 01 | Gate | `Card`, `Input`, `Button`, `Alert` | Copy: "Household grocery ledger — enter the shared passcode to continue." | None |
| 02 | Onboarding | `Card`+sub-parts, `Input`, `Checkbox`, `Button`, `StepDots` (gap-fill) | Household name placeholder "The Sharmas" (canonical DS example); preset/tick-off item labels are realistic but invented | None. Web shows step 1, mobile shows step 3, matching the wireframe's single-shell/multi-step note |
| 03 | Today | `Sidebar`, `TabBar`, `Card`+sub-parts, `Button`, `ListRow`, `Badge` | Due-soon/needs-attention items and quantities are realistic placeholders | None |
| 04 | Add · Capture | `Sidebar`, `TabBar`, `Card`+sub-parts, `Checkbox`, `Button`, `Dropzone` (gap-fill) | — | None. Side-by-side → stacked button collapse on mobile preserved |
| 05 | Add · Manual | `Sidebar`, `TabBar`, `Card`+sub-parts, `Input`, `Button`, `ListRow` | Item "Toor dal", ₹186 | None. Quick-log body state drawn per wireframe's choice to show state B |
| 06 | Review · Queue | `Sidebar`, `TabBar`, `Card`+sub-parts, `Table` (web), `TableRowMobile` (mobile) | Merchant names (BigBasket, Zepto, Blinkit, Local Kirana Store) and totals | None |
| 07 | Review · Detail | `Sidebar`, `Input`, `Select`, `Checkbox`, `Button`, `Alert` (tone `info`, reusing the DS's own canonical "Past order" copy), `Badge`, `ListRow`, `ImagePreview` (gap-fill) | Receipt image is a labeled placeholder, not a real photo; line items are realistic | None. 40/60 split (web) → stacked + sticky Commit bar (mobile) preserved exactly |
| 08 | Inventory · List | `Sidebar`, `TabBar`, `Card`+sub-parts, `Input`, `Select`, `Checkbox`, `Button`, `ListRow`, `Badge`, `Sparkline` (gap-fill) | Item names/prices realistic | None. Inline filter row (web) → single "Filters" trigger (mobile) preserved |
| 09 | Inventory · Detail | `Sidebar`, `TabBar`, `Card`+sub-parts, `Button`, `Input`, `Table`, `Sparkline` (gap-fill), plain `Stat` layout (typography tokens only, not a new component) | Prediction sentence reuses the UX doc's own example: "You buy this every ~9 days; last bought 7 days ago…" | None |
| 10 | Plan | `Sidebar`, `TabBar`, `Tabs`, `Card`+sub-parts, `Button`, `Select`, `Badge` | Bucket counts and item are realistic | None. Tabs wrap (web) → horizontal-scroll (mobile); 4-action row (web) → 2 actions + "…" (mobile) preserved |
| 11 | Shopping list | `Sidebar`, `TabBar`, `Card`+sub-parts, `Button`, `Input`, `Checkbox`, `EmptyState` | List total ≈₹2,340 | None. Mobile frame deliberately shows the empty-selection state per the wireframe's explicit callout that this must read as good news |
| 12 | Insights | `Sidebar`, `TabBar`, `Card`+sub-parts, `ListRow`, `Alert` (tone `warning`), `ProgressBar` (gap-fill) | Spend figures, category breakdown, price-alert numbers | None. Confirmed lowest-diff screen, as flagged at wireframe stage |
| 13 | Catalog manager | `Sidebar`, `Card`+sub-parts, `Checkbox`, `Button`, `Badge`, `Select`, `Radio`, `Input` | "Amul toned milk 1L (Amul)" vs. "AMUL MILK TONED 1 LTR" duplicate — reuses the exact example from `docs/ux/08-catalog-management-journey.md` | None. Inline "Merge selected" (web) → sticky bottom bar (mobile) preserved as proposed at wireframe stage (still an open question, not newly introduced here) |
| 14 | Settings | `Sidebar`, `TabBar`, `Card`+sub-parts, `Input`, `Button`, `Alert` (tone `warning`), `ProgressBar` (gap-fill) | Cost-meter figures are realistic placeholders | None. Severity conveyed via `Alert` tone (now that color is available) rather than the wireframe's border-weight-only stand-in — this is fidelity applying real tokens, not a structural deviation |

## Components referenced in the wireframes with no design-system match

These were composed from existing tokens only (no new colors, radii, or shadows invented) and are clearly commented as such in every screen file's source (`GAP_KIT`). None of them override or duplicate a real design-system component — they fill a real gap.

1. **Sparkline / price-trend chart** (Inventory list rows, item detail) — no chart primitive in the design system. Composed as a minimal inline SVG polyline using `--color-foreground-subtle`.
2. **Document/receipt image preview** (Review detail) — no Image/Thumbnail component. Composed as a bordered, `--color-surface-sunken` placeholder box with a text label; real receipt photos will replace this at handoff.
3. **Step indicator / progress dots** (Onboarding) — no Stepper component. Composed from sized circles using `--color-primary`/`--color-primary-subtle`/`--color-surface-sunken`.
4. **Sheet / modal / drawer** — no overlay primitive. The mobile Inventory filter panel and the Catalog merge preview are both rendered inline (as the wireframe already specified) rather than as a true overlay; if a real modal is wanted later, the design system needs one first.
5. **Progress bar / gauge** (Insights budget bar, Settings cost meter) — no ProgressBar component. Composed as a `--color-surface-sunken` track with a `--color-primary`/`--color-secondary` fill.
6. **Dropzone / file-upload surface** (Add · Capture) — no dedicated component. Composed from a dashed `--color-border-strong` container, matching the visual language of `Input`'s own border treatment.
7. **Avatar** — no Avatar component, and on inspection, not actually needed: this is a single-shared-household product with no per-user identity (passcode gate, not real auth). The wireframe's topbar avatar was decorative filler from the structural pass; it's been dropped here rather than invented, since inventing a person icon would be inventing content the product doesn't have.

None of these required a color, radius, or shadow value outside the existing token set — the gap is components/patterns, not tokens.

## Responsive behavior — confirmed against the wireframe stage

Every web → mobile collapse called out in the wireframe annotations is reproduced exactly:

- **Add capture**: side-by-side action buttons (web) → stacked full-width (mobile). ✓
- **Review detail**: 40/60 document/line-table split (web) → stacked column, sticky bottom Commit bar (mobile). ✓
- **Inventory list**: 5-control inline filter bar (web) → single "Filters" trigger (mobile). ✓
- **Review queue**: `Table` (web) → `TableRowMobile` stacked cards (mobile). ✓
- **Plan**: tabs wrap to fit all buckets (web) → horizontal scroll (mobile); 4-action row → 2 actions + overflow (mobile). ✓
- **Catalog manager**: inline "Merge selected" (web) → sticky bottom bar (mobile). ✓
- **Insights / Settings**: confirmed lowest-diff screens — single centered column at both sizes, as noted at the wireframe stage. ✓
- **Inventory item detail**: stat grid stays 2 columns at both sizes, matching the wireframe's explicit choice not to collapse it further. ✓

No responsive behavior was added, removed, or changed from what the wireframes defined.

## Refinement workflow for this project

Going forward, every change request gets triaged into one of three tiers before anything is touched, and I'll state which tier out loud first:

1. **Chat-level** — structural changes (grid type, layout pattern, adding/removing a section, changing which screens a nav item reaches). I'll check it against the original wireframe intent and confirm before applying.
2. **Inline/element-level** — a targeted fix to one component or region (spacing, sizing, alignment, a single component's state). Resolved to the specific component; surrounding layout untouched.
3. **Direct canvas edits** — final manual polish you do yourself. Nothing here is over-locked: every element is a plain, editable JSX call to a named component with visible props, so hand-editing in place doesn't require re-running generation.
