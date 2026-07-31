# E-16 test plan (Mobile navigation & design-system fidelity remediation)

No test runner exists in this repo (confirmed E-0 through E-15). Verification is: code-read
against the design/screens/*.html mockups and design/CHANGELOG.md's stated behaviors, curl-based
page-render checks against local dev, `npx tsc --noEmit` / `npx eslint` / `npm run build` as
mechanical gates, and manual click-through at 375px/768px/1024px+ widths where a headless
browser isn't available. Consistent with `.claude/epic-15/test-plan.md`'s pattern.

## S-37: Mobile reachability + focus-ring/functional blockers

| Acceptance / invariant | Verification |
|---|---|
| Settings and Shopping List reachable from mobile | Code-read of `app/(app)/page.tsx`'s CardFooter: confirm `/settings` and `/shopping-list` links present; grep the whole `app/` tree for `href="/settings"` and `href="/shopping-list"` before/after to confirm the link count increased from the pre-fix baseline of zero non-Sidebar occurrences. |
| Review reachable when queue is empty | Code-read: confirm the `/review` link in `app/(app)/page.tsx` is no longer gated behind `reviewQueue.length > 0`. |
| Catalog still reachable | Grep confirms at least one `href="/catalog"` remains outside the desktop Sidebar after the footer edit. |
| Switch shows a visible focus ring | Code-read of `components/ui/switch.tsx`: confirm `focus-visible:ring-0` is removed and the component now inherits (or explicitly sets) a visible `:focus-visible` treatment; cross-check `app/globals.css:353-357`'s global ring is no longer overridden to zero for this component. |
| Radio shows a visible focus ring | Code-read of `components/ui/radio.tsx`: confirm a `peer-focus-visible:ring-*` class exists on the visible span, keyed to the hidden native input's focus state. |
| Gate cookie works on localhost | Code-read of `app/gate/actions.ts:19`: confirm `secure` is conditional on `process.env.NODE_ENV === 'production'`; manually run `npm run dev`, submit the passcode form at `http://localhost:3000/gate`, confirm the cookie is set (dev tools) and the app proceeds past the gate. |
| Gate cookie still secure in production | Code-read confirms the conditional evaluates to `true` when `NODE_ENV === 'production'` (Vercel's build/runtime default). |
| Catalog merge-preview failure surfaces visibly | Code-read of `app/(app)/catalog/actions.ts`'s `getMergePreviewAction` and `catalog-manager.tsx`'s consuming `useEffect`: confirm both now wrap the call in try/catch and an error state renders an `Alert` instead of leaving `preview` silently `null`. If feasible, force a failure locally (e.g. pass a malformed catalog item id) and confirm the Alert renders instead of a silent hang. |

## S-38: Mobile top bar component + rollout

| Acceptance / invariant | Verification |
|---|---|
| MobileTopBar exists and matches the `lg` breakpoint split | Code-read of the new `components/ui/mobile-top-bar.tsx`; confirm its wrapper uses the same `lg:hidden`-equivalent class as `app/(app)/layout.tsx:45`'s existing mobile-only TabBar wrapper. |
| Present on every app/(app) route | Per-route code-read (12 routes) confirming `MobileTopBar` is rendered with the correct title string, matching the corresponding `design/screens/*.html` mockup's title. |
| Back button on Review Detail / Inventory Detail | Code-read confirms `back` prop passed on those two pages only, and that clicking it navigates to the parent list (`/review`, `/inventory`) via `router.back()` or an explicit `href`. |
| /gate and /onboarding unaffected | Confirm neither route imports or renders `MobileTopBar` (they sit outside the `app/(app)/` route group already). |

## S-39: Documented mobile responsive collapses

| Acceptance / invariant | Verification |
|---|---|
| Inventory filter bar collapses below 768px | Code-read of `app/(app)/inventory/page.tsx`; confirm a `md:hidden`/`md:flex` (or equivalent) split renders a single "Filters (N active)" trigger under 768px and the full inline form at >=768px; manually resize the dev-server page to 375px and 1024px to visually confirm both states render without horizontal overflow. |
| Plan tabs scroll horizontally below 768px | Code-read of `components/ui/tabs.tsx` and its wrapper in `app/(app)/plan/page.tsx`/`bucket-tabs.tsx`; confirm an `overflow-x-auto flex-nowrap` (mobile) vs `flex-wrap` (desktop) split exists; resize check at 375px confirms no vertical wrapping of bucket pills. |
| Plan per-item actions collapse below 768px | Code-read of `app/(app)/plan/plan-item-actions.tsx`; confirm "Always exclude" and the "Move to..." Select are hidden under a `...` overflow trigger below 768px, with Snooze/Skip remaining visible. |
| Catalog merge bar sticky below 768px | Code-read of `catalog-manager.tsx`; confirm the "Merge selected" button's container gets `fixed`/`sticky bottom-0` positioning under 768px, full-width; resize check confirms it stays pinned while the item list scrolls underneath. |
| Review Detail commit button sticky below 768px | Code-read of `review-detail.tsx`; confirm the Commit button moves out of `CardContent` into a `sticky bottom-0` (or `fixed`) footer under 768px; resize check confirms it stays visible while scrolling the line-item list. |
| No desktop regression | Resize check at >=1024px confirms all five spots render identically to their pre-fix desktop layout. |

## S-40: Shared money formatter + consume/display bug fixes

| Acceptance / invariant | Verification |
|---|---|
| formatMoney produces grouped output | Throwaway `npx tsx` script: call `formatMoney(84200)` and `formatMoney(8420.5)`, confirm output is `₹84,200.00` / `₹8,420.50` (thousands-grouped, 2dp, ₹-prefixed) matching the app's existing convention. |
| All six call sites migrated | Grep `app/` for `toFixed(2)` combined with `₹` and for raw `₹{` template interpolation after the change; confirm zero remaining ad hoc call sites outside `lib/format/money.ts` and the untouched `settings/page.tsx` `usd()` helper. |
| Review Detail shows formatted qty | Code-read of `review-detail.tsx:423`; confirm it now calls `formatBaseQty` instead of interpolating raw `qty_base`. |
| Consume amount validation | Code-read of `consume-actions.tsx`; confirm the disabled condition now includes `n <= 0`, and a visible error message renders on invalid submission. Manually exercise the Inventory Detail page locally: enter `0` and `-1` into the amount field, confirm the Log button is disabled or a visible error appears, not a silent no-op. |
| Sparkline default tone | Code-read of `sparkline.tsx:23`; confirm the hardcoded `text-primary` class is replaced with the neutral default and remains overridable via a `tone` prop. |

## S-41: Component/token fidelity pass

| Acceptance / invariant | Verification |
|---|---|
| Button secondary active state | Code-read of `components/ui/button.tsx`; confirm `active:bg-gold-700` (or equivalent themed class) present on the `secondary` variant. Manually mousedown-hold a secondary button locally and confirm the color changes. |
| Button destructive color-mix recipe | Code-read confirms the `destructive` variant's rest/hover/active classes now reference the `color-mix`-based `--color-error-subtle`/`--color-error` recipe rather than opacity modifiers, matching `design/components/forms/Button.jsx:23`'s formula. |
| Table/ListRow typography token | Code-read of `table.tsx`/`list-row.tsx`; confirm `text-[0.875rem]`/`text-xs` replaced with `[font:var(--text-body-sm)]`/`[font:var(--text-caption)]`. Resize check at 375px vs 1024px confirms the text size visibly shrinks per `app/globals.css:94-105`'s 768px override, matching `CardDescription`'s existing behavior. |
| Table header `scope="col"` | Code-read confirms all `<th>` elements in `table.tsx` carry `scope="col"`. |
| Add·Manual / Review Detail field labels | Code-read confirms every Select/Input in `manual-entry-form.tsx`'s new-item block and `review-detail.tsx`'s `EditableLineFields` now receives a non-empty `label` prop. |
| Reduced-motion respected | Code-read of `app/globals.css`'s `inv-shimmer`/`animate-shimmer` definitions; confirm a `@media (prefers-reduced-motion: reduce)` override disables or replaces the infinite animation. |

## Epic-level

| Check | How |
|---|---|
| `npx tsc --noEmit` clean | Run after all stories land. |
| `npx eslint .` clean | Run alongside tsc. |
| `npm run build` clean | Final mechanical gate; confirm no new route/type errors. |
| No route regression | Manually click through all 12 `app/(app)` routes plus `/gate` and `/onboarding` locally at 375px and 1024px+ widths; confirm no route newly 404s, no horizontal scroll appears, no console error is introduced. |
| Design-system parity re-check | Spot-check the cross-cutting findings list from the audit that produced this epic against the final diff -- every Blocker and Major item resolved, or explicitly deferred with a ledger note and reason. |
