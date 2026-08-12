# E-25 test plan — Release-readiness flow/UX fixes

## P0 — must-fix

### S-82 — No logout affordance
- **E2E**: a logged-in session clicks the new logout control; the next request to any `app/(app)/**` route redirects to `/login`, not a 401 page.
- **Unit/integration**: `logoutAction` is invoked (not bypassed) by the new control — assert on the actual server action call, not just a client-side redirect.

### S-83 — Onboarding wizard error handling
- **E2E**: simulate a DB failure during `applyPresetsAction` (mock/fault-inject); confirm an inline Alert renders instead of the app-level error boundary, and wizard state (household name, budget, presets, tick-offs) is still present in the form after the failure.
- **E2E**: retry after the simulated failure succeeds without creating a duplicate household.

### S-84 — Capture preprocessing failure hang
- **Unit**: `preprocessFile` throwing (mock a corrupt-HEIC rejection) is caught; the file's result state becomes a "Failed — couldn't process image" entry, not an unhandled rejection.
- **E2E**: a multi-file batch with one intentionally-corrupt file still reaches `status: 'idle'` and shows results for the other files.

### S-85 — Zero-line extraction dead end
- **Unit**: `checkExtractionQuality` with `lines: []` and `order_total: null` returns a failing quality result, not a passing one.
- **Integration**: a zero-line first attempt triggers escalation; a zero-line escalation result lands the `ingest_jobs` row in `failed` state, not `parsed`.
- **E2E**: a zero-line receipt shows FailedCard's retry/manual-entry UI in Review, with a distinct queue badge.

### S-86 — Cost meter under-reporting
- **Unit**: an escalated extraction (primary fails, escalation succeeds) accumulates `totalCost`/`totalTokens` from both attempts, verified against `estimateCostUsd` called once per tier with that tier's own token counts.
- **Unit**: a non-escalated (single successful attempt) extraction's cost is unchanged from current behavior — regression guard.

### S-87 — Catalog Recategorize select a11y
- **Automated a11y check** (axe or equivalent) on the Catalog page confirms the Recategorize control has an accessible name.

## P1 — gaps

### S-88 — Signup/onboarding form clarity
- **E2E**: mismatched passwords show a field-level error on confirmPassword, not a page Alert.
- **Unit/E2E**: a weak/too-short password signup failure returns a distinct message from a duplicate-email failure (verify duplicate-email message is unchanged — anti-enumeration regression guard).
- **E2E**: abandoning onboarding after step 2, then returning, shows the intended ~40-item tick-off list, not a preset-inflated one.

### S-89 — cursor-pointer on Button/Checkbox
- **Visual/unit**: enabled Button and Checkbox compute `cursor: pointer`; disabled instances still compute `cursor: not-allowed` (regression guard).

### S-90 — Unsaved review-line edits discarded
- **E2E**: editing a line, then clicking "Skip to next" without saving, triggers a discard-confirm (or persists via autosave) instead of silently losing the edit.

### S-91 — Review per-line touch targets
- **Visual/unit**: named per-line action buttons in review-detail.tsx measure at least 44x44px.
- **E2E (mobile viewport)**: no visual overlap/crowding among adjacent per-line controls at the narrowest supported width.

### S-92 — Near-duplicate warning link
- **E2E**: the near-duplicate warning links to (or inline-summarizes) the receipt referenced by `near_duplicate_of`; committing is still possible after seeing it (non-blocking regression guard).

### S-93 — Catalog merge success confirmation
- **E2E**: a successful merge shows a success Alert, matching the pattern already used by Settings' wipe flow.

### S-94 — Consume fraction confirm + zero-stock no-op
- **E2E**: tapping a 25/50/75% fraction button requires the same confirm step as "Used it up"/"Wasted".
- **Unit**: `recordConsumption` with `virtualStockBase === 0` returns an explicit "nothing to log" result instead of a silent `{ok: true}` no-write.

### S-95 — Consume-action touch targets
- **Visual/unit**: consume-action buttons measure at least 44x44px; no layout crowding at mobile widths (regression guard).

### S-96 — Digest-disabled warning signal
- **E2E**: Settings shows a visible warning Alert (not just gray helper text) when `RESEND_API_KEY` is unset; the warning disappears when the env var is set (mock/toggle in test).

### S-97 — Plan/shopping-list empty-state distinction
- **E2E**: a household with zero prediction data sees a distinct empty state with a capture-nudge CTA; a household with genuinely nothing due keeps the existing "nothing needs restocking" copy (regression guard on the established-household path).

### S-98 — Insights zero-data CTAs
- **E2E**: each of the four zero-data Insights cards links to `/add`; the CTA disappears once real data exists for that card (regression guard).

### S-99 — Shopping-list regeneration loading state
- **E2E**: clicking Generate shows a loading spinner on the clicked button specifically, distinguishing it from the other disabled-but-not-loading buttons in the row.

### S-100 — v2 design token rollout
- **Visual regression**: `app/globals.css`'s six listed token values match `docs/design/tokens.md`'s v2 values, light and dark.
- **Grep-based check**: no component hardcodes a stale v1 hex value that now conflicts with the updated tokens.
- **Regression guard**: brand/secondary/tertiary/semantic-status token values are byte-for-byte unchanged.

## P2 — improvements

### S-101 — Progress bar ARIA
- **Unit/a11y check**: both progress-bar components carry `role="progressbar"` with `aria-valuenow` matching the rendered percentage.

### S-102 — Sub-44px secondary controls
- **Visual/unit**: shopping-list row's price Input/Log-purchase Button and onboarding wizard's step buttons measure at least 44px (48px for wizard, matching login/signup).

### S-103 — Raw LLM response + processing auto-refresh
- **E2E**: FailedCard's raw-response disclosure renders `ingest_jobs.raw_response` content.
- **E2E**: ProcessingCard polling surfaces a completed extraction without a manual reload; polling stops once the receipt reaches a terminal state (regression guard against indefinite polling).

### S-104 — Sparkline endpoint highlight
- **Visual**: sparkline.tsx renders a distinct marker on the latest data point, on both item-card and item-detail sizes.
