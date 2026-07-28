---
doc: adr
project: Inventro
status: proposed
updated: 2026-07-28
story: "S-01"
---

# ADR-0002: UI kit — Astryx with a time-boxed shadcn/ui fallback

## Status

Proposed — decision point falls in the first two hours of Day 1, not before.

## Context

The delivery plan is three days; there is no slack to discover mid-build that
the chosen UI kit fights the framework. Astryx (`@astryxdesign/core`) is
attractive for its pre-built CSS, dark mode, and single theme-token set — but
it's beta, with thin docs and unproven StyleX interop against Next.js 15. The
project needs a decision procedure, not just a choice, because the choice
itself is genuinely uncertain until tested against real code.

## Decision

Default to Astryx, but treat the first 45 minutes of Day 1 as a mandatory spike
against one real page (not a toy component). If StyleX/Next 15 friction shows
up, fall back to shadcn/ui by hour 2 — same composition philosophy, radix-based,
far better documented. The fallback decision is made early and cheaply, not
discovered on Day 3 when there's no time left to recover.

## Options Considered

### Option A: Astryx (default)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low if it works — pre-built CSS and templates for table/detail/form pages, which this project uses heavily (Inventory, Plan, Review) |
| Cost | Free |
| Scalability | N/A — UI kit choice doesn't affect backend scale |
| Team familiarity | Low — beta product, thin docs |

**Pros:** table-page, detail-layout, and form-flow templates map directly onto
Review, Inventory, and Plan screens, saving real time in a 3-day build.
**Cons:** beta status means undocumented edge cases; unverified against
Next.js 15 App Router + StyleX at the time of writing.

### Option B: shadcn/ui (fallback)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — copy-in components, no framework lock-in |
| Cost | Free |
| Scalability | N/A |
| Team familiarity | High — widely used, well documented, known to work with Next.js 15 + Tailwind |

**Pros:** proven interop, large community reference, no beta risk.
**Cons:** no pre-built table/detail/form templates — more hand-rolling of
composite layouts than Astryx would require if it works.

## Trade-off Analysis

The only trade-off that matters here is time risk vs. template value. Astryx
saves meaningful build time *if* it works cleanly; if it doesn't, the cost is
not "somewhat slower," it's "discovered too late to switch." The 45-minute
spike converts an open-ended risk into a bounded one: worst case, 45 minutes
lost and a same-day pivot to a known-safe option.

## Consequences

- Whichever kit is chosen, WCAG AA compliance rides on not undoing the kit's
  accessible defaults with custom markup ([working spec](../../00-working-spec.md) §13) — applies to
  either option.
- If the fallback triggers, no downstream architecture changes — this is a
  presentation-layer decision only, isolated from data model, API design, and
  the prediction engine.

## Alternatives considered

- **Hand-rolled Tailwind, no kit** — rejected; no time budget in a 3-day build
  to construct table/detail/form patterns from scratch.
- **Any heavier component framework (MUI, Chakra)** — rejected; heavier bundle
  and theming overhead not justified for a single-household internal tool.
