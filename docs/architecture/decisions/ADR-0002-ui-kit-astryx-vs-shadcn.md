---
doc: adr
project: Inventro
status: accepted
updated: 2026-07-29
story: "S-04"
---

# ADR-0002: UI kit — shadcn/ui (Astryx spike failed)

## Status

Accepted. Astryx spike run at S-04 (first UI-touching story), not Day-1
hour-1 as originally planned — E-0 (S-01-S-03) was pure infra/scaffolding
with no screens. Failed before a component was even written: `npm view`
showed `@stylexjs/nextjs-plugin` is **deprecated** ("no longer supported"),
its setup requires a `.babelrc.js` which conflicts with Turbopack (this
project's bundler since Next.js 16 defaults to it), and its own README
states `@/` import aliases are unsupported — which is this project's
alias convention from S-01. This is worse friction than the ADR
anticipated; no code-level trial needed to confirm the fallback triggers.
shadcn/ui adopted as final, not fallback (closes the open question in
`docs/architecture/02-tech-stack.md`).

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
- The fallback triggered, but as anticipated: no downstream architecture
  changes — this was a presentation-layer decision only, isolated from data
  model, API design, and the prediction engine.
- Tailwind CSS is now a required dependency (shadcn/ui's styling layer) —
  S-01 scaffolded without it (`--no-tailwind`), added at S-04.

## Alternatives considered

- **Hand-rolled Tailwind, no kit** — rejected; no time budget in a 3-day build
  to construct table/detail/form patterns from scratch.
- **Any heavier component framework (MUI, Chakra)** — rejected; heavier bundle
  and theming overhead not justified for a single-household internal tool.
