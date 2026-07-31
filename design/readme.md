# Inventro Design System

Source: local codebase `inventro/` (Next.js 16 App Router, Tailwind v4, base-ui/react, shadcn conventions, lucide-react). No design system existed in source — visual language built fresh here on the fixed brand palette (maroon/red/gold/blue). See tokens/colors.css for full rationale and WCAG checks (guidelines/colors-accessibility.html).

Product: Inventro — household grocery inventory & replenishment app (single Next.js web app, PWA-installable; no separate native codebase, so "mobile" = responsive breakpoints of the same product).

## Components

Forms: Button, Input, Textarea, Select, Checkbox, Radio, Switch, Label
Feedback: Badge, Alert, EmptyState, Skeleton
Navigation: Sidebar, TabBar, Tabs
Data: Card (+ CardHeader/CardTitle/CardDescription/CardContent/CardFooter), Table (+ TableRowMobile), ListRow

Intentional additions (no source equivalent): Switch, Sidebar, TabBar, Tabs — the source app had no nav yet and only raw checkboxes.

## Index

- `tokens/` — colors, typography, spacing, radius/shadow, motion (imported by root `styles.css`)
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand groups)
- `components/<group>/` — reusable primitives listed above
- `assets/` — placeholder PWA icon copied from source (not a real logo — none exists; wordmark used instead, see guidelines/brand-wordmark.html)

## Content fundamentals

Sentence case throughout, no exclamation marks, calm and precise ("Reviewing 2 of 5", "Committing…"). No emoji. ₹ currency, Kolkata timezone defaults. Frequent em-dashes for asides. Never guesses — blocks/flags instead ("Empty date blocks commit — never guess").

## Visual foundations

Palette: primary red (#E63946, safe text pairing at 600-step #C92735), maroon #8B1E2D as red's darkest step (dark headers/surfaces), gold #F4D35E (secondary/warning), blue #457B9D (tertiary/info/links). Warm neutral grays. Cards are the base surface everywhere: 1px border, subtle maroon-tinted shadow, 10px radius. No gradients, no illustrations, no photography. Motion is subtle utilitarian (150–320ms, standard easing) — no bounces. Hover = subtle background shift; press = 1px translate; focus = 3px brand-tinted ring.

## Iconography

Source ships lucide-react (already a dependency) — use Lucide icons via CDN for consuming projects; no custom icon font or SVG sprite in source. No emoji used in-product.
