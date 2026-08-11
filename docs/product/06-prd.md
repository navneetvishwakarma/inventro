---
doc: prd
project: Inventro
status: approved        # draft | approved  — must be `approved` before backlog seeding
updated: 2026-08-06
v2-cycle: multi-tenant-auth-activation
---

# Inventro — Product Requirements

> Approved. Every requirement below is vertically sliced and carries a stable
> `REQ-xx` id referenced by `prd_ref` in `docs/engineering/backlog.json`. Full
> algorithm, schema, and acceptance-test detail behind each requirement lives
> in [`docs/00-working-spec.md`](../00-working-spec.md) — that doc predates
> this PRD and remains the source of truth for §5 (prediction algorithm), §3
> (domain model), §7 (LLM contract), and §11 (the full A1–A26 acceptance test
> list, referenced by id throughout the table below).

## Problem & goal

Households order groceries and household supplies reactively — noticing an
item ran out, then scrambling — with no standing view of consumption rate,
reorder timing, or recurring-vs-one-off spend. The goal is a system that turns
a photographed receipt, app screenshot, or order PDF into structured inventory
in under 15 seconds, infers consumption without requiring manual logging, and
converts that into cadence-bucketed running lists (daily → yearly) plus a
rolling budget view, so shopping shifts from reactive to planned.

## Non-goals

Placing real orders with retailers · barcode scanning · expiry-date-per-unit
tracking · recipe/meal planning · web push · offline sync ·
seasonality/festival modeling · shared real-time list editing · native app ·
email auto-forwarding inbox · household-member spend attribution ·
bulk/batch historical import (mbox, CSV — historical orders go through the
normal one-at-a-time capture flow instead, REQ-22).

**v2 additions:** household member invites / multi-member households (one
account = one household in v2, ADR-0006) · household switching UI (test
multiple households by creating multiple accounts, not by switching within
one session) · self-serve password reset (no email delivery configured yet,
blocked on REQ-20) · OAuth/magic-link/passkey login (REQ-31 is email +
password only, deliberately, per the "simple" login requirement).

## Requirements

| ID | Requirement | Priority | Acceptance | Release |
|------|-------------|----------|------------|---------|
| REQ-01 | Onboarding wizard: household name/currency/budget, 3–8 "how you shop" presets seeding `is_staple` + cold-start priors, optional 60s stock tick-off | P0 | New household reaches a non-broken Today screen with zero data (A13); tick-off creates `initial` stock movements and sets `stock_epoch = now()` | v1 |
| REQ-02 | Multi-format capture: camera/file-picker/drag-drop for PDF, JPG, PNG, WEBP, HEIC, HTML/MHTML | P0 | Upload a photographed grocery bill → ≥85% lines correctly extracted (A1) | v1 |
| REQ-03 | Multi-image-as-one-order grouping (2–3 screenshots as one multimodal call) | P0 | Three screenshots grouped as "one order" produce a single receipt with no triple-counted items (A24) | v1 |
| REQ-04 | Clipboard paste (Cmd/Ctrl+V) opens Add with image staged | P1 | Clipboard paste opens Add with the pasted image staged (A25) | v1 |
| REQ-05 | Multi-file queue: N files → N receipts, sequential review with counter | P0 | Selecting N files produces N separate receipts reviewed in sequence; this is also the historical-catch-up path (REQ-22) | v1 |
| REQ-06 | Paste-text capture (order-confirmation email body) routed to a cheaper text-only LLM call | P1 | Pasted text is parsed via the text-only path, not multimodal | v1 |
| REQ-07 | Manual entry: searchable typeahead over catalog, recency-ranked, last-quantity prefilled | P0 | Repeat purchase of a known item takes two taps | v1 |
| REQ-08 | Async parse pipeline (upload → storage → ingest job → LLM extraction → line matching → review queue → commit), never auto-commits, dedup via SHA-256 `content_hash` | P0 | Same file uploaded twice is blocked as duplicate (A2); malformed LLM response escalates rather than crashing or silently dropping data (A11) | v1 |
| REQ-09 | Canonicalization: exact alias hit → trigram similarity (`pg_trgm`) → LLM-proposed new item; every human confirmation writes a new `item_alias`; merge tool consolidates items | P0 | Same product bought via receipt then manual entry under different raw text resolves to one catalog item, two aliases (A4); merging two items consolidates movements/aliases and recomputes stats (A12) | v1 |
| REQ-10 | Unit normalization to base units (g/ml/piece) at write time, ambiguous units default to piece/qty 1 and flag for review | P0 | Mixed units (kg, l, dozen, pack-of-N) commit to correct base-unit quantities | v1 |
| REQ-11 | Categorization against the fixed seeded taxonomy only (never invented), non-inventory rows (fees/tax/discounts) excluded | P0 | 20-line PDF order confirmation parses with delivery fee and GST excluded as non-inventory (A3) | v1 |
| REQ-12 | Review queue: split view (document + editable lines), purchase date as a mandatory first-class editable field, past-order banner when dated before `stock_epoch` | P0 | A document with no extractable date blocks commit; setting a date manually releases it (A21); a backdated receipt updates frequency stats but not current stock (A18) | v1 |
| REQ-13 | Inventory screen: grouped by category, stock state pinned, filters (category/cadence/stock-state/staples), search across name + aliases, item detail with plain-language prediction explanation | P0 | Item card shows current stock, predicted days remaining, cadence badge | v1 |
| REQ-14 | Consumption actions (used it up / used some / wasted) plus implicit virtual depletion for display/prediction (never a written ledger movement) | P0 | "Used it up" zeroes stock and surfaces the item in Today (A8) | v1 |
| REQ-15 | Repurchase reconciliation: compare projected vs. actual stock at each repurchase and adjust `rate_correction` (clamped [0.5, 2.0]) | P0 | At repurchase, projected stock >40% of pack size multiplies `rate_correction` by 0.85 (over-projected consumption); projected stock ≤0 for >20% of the interval multiplies it by 1.15 (under-projected); cumulative correction clamped to [0.5, 2.0] (working spec §5/F9.3). Core-bet mechanism — validated via the synthetic seeder cohorts (REQ-23) pre-launch, since real history is too thin at launch to measure this directly | v1 |
| REQ-16 | Prediction engine `computeItemStats` (pure function): EWMA over intervals, outlier rejection, shrinkage-to-category-prior, rate-based cross-check, perishability clamp, confidence score, cadence bucketing with hysteresis | P0 | Item bought at day 0/7/14/21 buckets `weekly`, confidence High, next purchase ≈ day 28 (A5); one outlier interval (vacation/bulk-buy) doesn't move the bucket (A6); 2-purchase item is prior-dominated, confidence `Learning` (A7) | v1 |
| REQ-17 | Cadence planner / Plan screen: buckets from daily→unpredictable, suggested qty = pack-size-aware, snooze/skip/exclude/override with "revert to auto," Today view (due within 3 days) | P0 | Manual cadence override survives nightly recompute; "revert to auto" restores the computed value (A9) | v1 |
| REQ-18 | Shopping list: generate from any bucket or "due in next N days," optional purchase-log-on-checkoff with price prompt, plain-text export | P1 | Checking off an item without a receipt still feeds the model when a price is logged | v1 |
| REQ-19 | Budget & insights: spend vs. budget by category, forward projection of next month's committed recurring spend, top-10 spend items, price-change alerts (>15%), waste report | P1 | Forward projection is derived from live cadences and prices, not a static estimate | v1 |
| REQ-20 | Notifications: daily 07:00 IST digest (items due ≤3 days), weekly Sunday 18:00 IST list-ready email, in-app badges | P2 | Digest only fires when something is actually due | v1 |
| REQ-21 | Settings: household config, category management, catalog manager (merge/archive/recategorize), cost meter (LLM spend/receipt/model tier), CSV/JSON export, demo-data wipe | P1 | Cost meter reflects per-receipt token/cost accounting (ties to REQ-25) | v1 |
| REQ-22 | Backdating: historical orders added through the same capture flow (REQ-05), one at a time — no separate batch-import subsystem | P0 | Backdated receipt correctly updates frequency stats only, not current stock (A18, via `stock_epoch`) | v1 |
| REQ-23 | Synthetic history seeder + validation harness (`pnpm seed:history` / `pnpm validate:predictions`), 7 cohorts, `is_demo`-flagged household only | P0 | Per-cohort scorecard prints; overall S3 (n≥4) clears ≥70% before shipping the prediction engine | v1 |
| REQ-24 | LLM extraction contract: Gemini Flash primary, native-PDF-text fast path, escalation to Pro on schema/total-mismatch failure, manual-entry fallback with raw response retained | P0 | Malformed JSON escalates to Pro, then to manual entry, never a crash or silent data loss (A11); native-text PDF takes the text-only path, photographed screenshot takes multimodal, verifiable via `parse_path` (A22) | v1 |
| REQ-25 | Cost controls: hard stop at 100 receipts/day (alert at 50), per-receipt token/cost accounting | P1 | Loop-bug guard actually halts ingestion at the threshold | v1 |
| REQ-26 | Single-household tenancy scaffolding: `household_id` on every table sourced from `DEFAULT_HOUSEHOLD_ID`, all DB access server-side, RLS policies written-but-disabled, shared-passcode gate (`proxy.ts` + signed HTTP-only cookie). **Superseded by REQ-31/REQ-32 this cycle** — the scaffolding this requirement shipped is exactly what made REQ-31/32 cheap (ADR-0004); left as-is below, unedited, as the historical record of what v1 actually shipped | P0 | Anon Supabase key absent from client bundle; unauthenticated request without the gate cookie returns 401 (A26) — **flagged: no real authentication, explicitly scoped to grocery data only until the multi-tenant phase (see `docs/product/10-gtm-strategy.md`)** | v1 |
| REQ-27 | PWA installability (manifest, icons); Android Web Share Target only, no offline data sync | P2 | App is installable; offline shell caches but data does not sync offline | v1 |
| REQ-28 | Automated regression coverage: unit tests for the pure domain logic (`computeItemStats` EWMA/shrinkage/outlier-rejection/bucketing, canonicalization/alias matching, unit normalization, `rate_correction` clamping, backdating vs `stock_epoch`) plus an E2E smoke suite covering the gate and every route, using accessible roles/names rather than DOM structure so it survives REQ-29's redesign | P0 | `npm test` runs the unit suite and reproduces the hand-computed S-14a/b/c fixtures already recorded in `docs/MANUAL-TESTS.md` (day 0/7/14/21 → weekly, confidence ~0.50, next ≈ day 28; day 0/7/60/67 rejects the 60-day outlier; 2-purchase item → unpredictable, confidence ~0.25); `npm run test:e2e` passes the gate and gets a 200 on every route in `backlog.json` plus one happy-path assertion per section | v2 |
| REQ-29 | Design system v2: an audited, modernized token set and component/page reference screens (`docs/design/`) replacing ad-hoc per-page styling drift, applied consistently across every existing screen plus the new v2 auth screens (`/login`, `/signup`) — semantic token indirection (`--color-primary` → `--primary` → `--red-600`) preserved so future re-theming stays additive, not a rewrite | P1 | Every page under `app/(app)/**`, `app/onboarding/**`, and `app/(auth)/**` renders using only `docs/design/` v2 tokens and updated `components/ui` primitives (no hardcoded hex/spacing values); each page matches its `docs/design/pages/*.md` reference screen with no unaddressed gap in the epic's own gap-list. **Activated this cycle** — REQ-30's fidelity baseline is now solid, so this is no longer sequenced behind an unverified baseline; sequenced after REQ-31/32 instead, so auth screens exist before they're styled. | v2 |
| REQ-30 | Design fidelity remediation: every live screen matches its already-approved reference (`design/screens/01-gate.html` … `14-settings.html`, built from the real design-system component bundle) — the reference this app was originally built against, not a new one | P0 | A full-audit diff (live screenshot vs. reference screenshot, mobile + desktop) shows no unaddressed high/medium-severity mismatch; deviations confirmed as deliberate product decisions (e.g. the 5-item mobile tab bar vs. the reference's proposed Shop/More folding scheme, per the E-16 IA decision) are excluded, not silently re-implemented | v2 |
| REQ-31 | Real authentication: Supabase Auth email + password signup/login/logout, replacing the shared passcode gate. Signup creates a household and its creator as `owner` in the same transaction — no invite flow (ADR-0006) | P0 | New email/password signup reaches a non-broken Today screen for a brand-new, empty household; wrong password is rejected with a clear error and no session; logout clears the session and the next request re-gates to `/login`, not a 401 page; Supabase anon key remains absent from the client bundle (replaces A26 under the new mechanism) | v2 |
| REQ-32 | Multi-tenant data isolation: `household_members` join table, RLS enabled and rewritten to key off `auth.uid()` (replacing the disabled, speculative `app.current_household_id` policies), every user-facing Server Action/Route Handler/Server Component reads its household from the signed-in session via a request-scoped Supabase client — not `DEFAULT_HOUSEHOLD_ID` — with the service-role client narrowed to exactly two call sites (`api/cron/*`, the REQ-23 synthetic seeder) | P0 | Two households, each with one seeded item: household A's authenticated session cannot read, list, or write household B's row via any route (new cross-household isolation test, the hard gate on this requirement); RLS is `ENABLE`d (not just written) on every `household_id`-scoped table; no user-facing code path still calls the service-role client | v2 |
| REQ-33 | Usability and flow-completeness fixes identified by the v2 UX audit (see epic backlog for the itemized list) — dead ends, missing feedback/error states, and incomplete edge-case handling across capture, review, inventory, planning, and shopping-list flows | P1 | Each fix traces to a specific audit finding and its own acceptance line in the backlog; no visual/token changes bundled into this requirement (that's REQ-29's scope) | v2 |
| REQ-34 | Critical-path unit test coverage beyond REQ-28's original scope (prediction engine, canonicalization, e2e smoke), plus an enforced coverage gate — targeting `lib/` modules with zero coverage that guard a stated safety/correctness claim elsewhere in this table: dedup/hard-stop guards (REQ-08 A2, REQ-25), the redirect sanitizer on the new auth path (REQ-31), LLM-extraction failure handling (REQ-24 A11), virtual stock/consumption math (REQ-14), cost accounting (REQ-25), the notification digest condition (REQ-20), and shopping-list generation (REQ-18) | P1 | `docs/engineering/backlog.json`'s `coverage` gate is set to `mode: "warn"` and reports a real aggregate `lib/**` percentage on every CI run (measured surface stays `lib/**`, matching REQ-28's precedent — `app/` route handlers/Server Actions/Components remain covered by the Playwright e2e suite, not unit coverage, so the two suites don't duplicate the same assertions); each story below adds tests for one zero-coverage module tied to an existing REQ's safety claim; a final story flips `mode` to `"enforce"` once the aggregate clears the 0.7 threshold, not before | v2 |

**PII / compliance flag:** REQ-31 and REQ-32 are this cycle's requirements
touching auth and PII — REQ-31 introduces real user credentials (email +
password, held by Supabase Auth, not this codebase) for the first time;
REQ-32 is the tenant-isolation boundary that makes those credentials mean
anything. (REQ-26, superseded above, was the v1-era flag for the same
section of the PRD — no real authentication, an accepted v1 risk scoped to
grocery data only.) Receipt images may incidentally contain address or
payment-instrument fragments; storage is private with 60s-TTL signed URLs,
and raw files are purged after 12 months (parsed data is retained) — see
`docs/architecture/07-infrastructure.md`, unchanged this cycle. Full
threat-model picture (credential stuffing, no password reset, cross-tenant
leakage, compromised-account blast radius) consolidated in
`docs/architecture/06-security.md`.

**Acceptance test numbering:** the table above cites acceptance tests by id
(A1–A26); the full list is working spec §11. Ids A10, A14–A17, A19–A20, and
A23 are intentionally reserved numbering from the spec's original
consolidation pass, not undefined tests — do not treat their absence from
this table as a gap to fill.

## Success metrics

See `docs/product/07-success-metrics.md` (S1–S5). Every metric there maps back
to at least one REQ-xx above.

## Open questions

- [ ] None blocking backlog seeding. Astryx-vs-shadcn is an implementation-time decision documented as ADR-0002, not a product requirement.
- [ ] REQ-31/32: none blocking backlog seeding either. Password-reset and
      login-rate-limiting gaps are tracked as residual risk in
      `docs/architecture/06-security.md`, not product blockers for this
      cycle (see ADR-0006 non-goals).

## v2 reconcile (2026-08-01)

E-0 through E-16 are shipped. This cycle adds REQ-28 (regression coverage,
since none existed) and REQ-29 (design system v2, replacing the ad-hoc
per-page styling that accumulated across E-1–E-16). REQ-28 is sequenced
first — a redesign without a regression net risks silently breaking the
prediction/matching/commit logic that's already correct. Both requirements
are additive; no existing REQ-01–REQ-27 changes.

**Same-day addendum:** REQ-29 initially assumed no reference design existed
and proposed authoring a new one (`docs/design/`, status draft, never
implemented). That assumption was wrong — `design/screens/*.html` is a
real, already-approved reference the app was originally built against.
Added REQ-30 (fidelity remediation against that existing reference) and
resequenced REQ-29 after it. A full audit against `design/screens/*.html`
also surfaced two live P0 bugs, unrelated to REQ-29/30's scope, fixed
immediately rather than queued: an unlayered CSS reset (`* { padding: 0;
margin: 0; }` in `app/globals.css`) was silently beating every Tailwind
spacing utility app-wide in both themes (same bug class as a prior fix in
PR #79 for an unlayered color rule), and an unhandled rejection on a
missing receipt Storage object hung `/review/[id]` indefinitely for the
affected receipt. Both shipped (PRs #97, #98) ahead of this reconcile.

## v2 reconcile — multi-tenant auth activation (2026-08-01)

E-17 through E-19 are shipped (REQ-28 regression coverage, REQ-30 fidelity
remediation). This reconcile adds REQ-31 (real authentication), REQ-32
(multi-tenant data isolation), and REQ-33 (usability/flow-completeness
fixes), and activates REQ-29 (design system v2, previously sequenced out
to "a later, separately-scoped cycle" — that later cycle is now).
Triggered by the explicit need to create and test multiple households
under real tenant isolation, not by a GTM decision (`docs/product/
10-gtm-strategy.md`'s v2 addendum is explicit about that distinction).

**Sequencing, and why:** REQ-31 (auth) → REQ-32 (isolation) → REQ-33
(usability fixes, mostly independent, can build in parallel with 31/32)
→ REQ-29 (design v2, last — it needs the login/signup screens REQ-31
creates and the fidelity baseline REQ-30 already secured; redesigning
before the isolation work would mean re-styling the same screens twice).
Full rationale for the auth/isolation architecture is ADR-0006, not
repeated here — this PRD entry exists to make the product-level
commitment explicit and testable, ADR-0006 carries the "why this
mechanism."

**REQ-33's provenance:** contents are a UX/interaction-quality and
flow-completeness audit across every major flow (capture → review →
commit, cadence planning, shopping list, catalog management, settings),
explicitly scoped away from REQ-29/30's visual-fidelity concerns — this
audit looks for dead ends, missing feedback, and incomplete edge-case
handling, not color/spacing drift. Itemized findings live in the backlog
epic this requirement maps to, not duplicated here.

**No existing REQ-01–REQ-30 acceptance criteria change.** REQ-26 is
marked superseded (see its row) but left textually intact as the
historical record of what v1 shipped, per this project's own "never
renumber or silently rewrite a shipped requirement" rule.

## v2 reconcile — test coverage hardening (2026-08-06)

E-17 through E-19 (REQ-28, REQ-30) and E-20/E-21 (REQ-31, REQ-32) are
in flight or shipped. A coverage/quality pass while auditing this cycle
found `npm test`'s own `@vitest/coverage-v8` report (already wired by
E-17/S-42, `scripts/coverage.mjs`, and the `coverage` CI job — no new
tool needed, all OSS and already throughline-native) at 15.0% aggregate
`lib/**` line coverage against the schema's 70% default threshold, with
`docs/engineering/backlog.json` carrying no `coverage` key at all —
meaning enforcement is fully off (`mode` resolves to `'off'`, not even
`'warn'`), not merely under target. 41 of 48 `lib/**` files have zero
test coverage.

This is not a REQ-28 regression: REQ-28's acceptance was deliberately
narrow (prediction engine, canonicalization/unit-normalization,
backdating/rate-correction, e2e route smoke) and every story under it
shipped exactly that scope, verified. The gap is modules REQ-28 never
claimed to cover, several of which back a safety/correctness claim made
elsewhere in this table (REQ-08 A2's duplicate-block, REQ-25's 100/day
hard stop, REQ-24 A11's "never a crash or silent data loss," REQ-31's
new redirect path). Adds REQ-34, additive, no existing REQ-01–REQ-33
change.

**Why `warn`, not `enforce`, to start:** setting `mode: "enforce"` at
15% would turn CI red on every PR immediately, including ones unrelated
to the modules in scope. `warn` measures and reports without blocking;
the ratchet to `enforce` is its own last story under REQ-34, gated on
the aggregate actually clearing 0.7 first.
