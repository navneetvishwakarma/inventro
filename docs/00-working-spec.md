---
doc: Working Spec
project: PANTRY
status: approved
updated: 2026-07-28
---

# PANTRY — Home Inventory & Replenishment Intelligence

**Final Consolidated Product Requirement (build-ready)**
*Private single-household tool, v1. Multi-tenant is a planned later phase (see §2, §15).*

> This is the original consolidated spec every other doc in `docs/` cites as
> "the working spec." It predates the formal PM/architecture doc set
> (`docs/product/`, `docs/architecture/`, `docs/engineering/`, `docs/ux/`) and
> remains the most detailed source for the prediction algorithm (§5), the
> domain model (§3), the LLM extraction contract (§7), and the validation
> harness (§12) — those four sections are fixed contracts, not suggestions.
> Where the PRD (`docs/product/06-prd.md`) and this doc could drift over time,
> the PRD's `REQ-xx` ids are the source of truth for scope and priority; this
> doc remains the source of truth for algorithm and schema detail.

---

## 1. Objective

Move a household from reactive, ad-hoc ordering to a predicted, recurring cadence. The system learns *what* a household consumes, *how fast*, and *when it will run out*, and converts that into standing lists (daily / 2–3 day / weekly / fortnightly / monthly / quarterly / half-yearly / yearly) with a rolling budget view.

**Explicit non-goal:** placing real orders with retailers. The output is a list you act on.

**Success criteria (measurable):**

- **S1** ≥85% of line items on a supported document are extracted with correct name, quantity, unit, and price.
- **S2** ≥90% of extracted items map to the correct canonical catalog item on repeat purchase — no duplicate entries for the same product under different raw text.
- **S3** After 4 purchases of an item, predicted next-purchase date is within ±25% of the actual interval for ≥70% of items. *(Measured against the synthetic seeder in §12, since real history will be thin at launch.)*
- **S4** ≥60% of recurring spend is assigned to a cadence bucket rather than "unpredictable."
- **S5** Capture (screenshot/PDF) → committed inventory in under 15 seconds for a clean receipt.

---

## 2. Deployment context

**v1 is a private single-household tool.** No auth, no invites, no multi-tenancy. Multi-tenant is deferred to a later phase once the core machinery is proven, so three constraints hold from day one to make that transition non-disruptive:

1. **`household_id` on every table**, sourced from a `DEFAULT_HOUSEHOLD_ID` env constant. Drop auth, not tenancy — retrofitting a tenant key into a schema with real data in it is far more expensive than carrying an always-identical UUID from day one.
2. **All database access stays server-side.** No Supabase client in the browser, no anon key shipped to the client. Service-role key server-only. Mutations via Server Actions, reads via server components / Route Handlers.
3. **RLS policies are written into the migration file but left `DISABLED`.** Enabling them later, when auth arrives, is one `ALTER TABLE` per table — not a design exercise.

**Access gate:** a single shared passcode checked in `middleware.ts` against an env var, setting a signed HTTP-only cookie (~40 lines). This is not real authentication — it exists only because Vercel URLs are public by default. Nothing beyond grocery data should live in this system until the multi-tenant phase lands.

**Locale defaults:** INR currency, `Asia/Kolkata` timezone, metric units, English.

---

## 3. Domain model

**Core architectural decision: stock is a value derived from an append-only ledger, not a mutable number.** This makes consumption inference, corrections, and audit trivial, and it's what makes the frequency engine trustworthy.

| Entity | Purpose | Key fields |
|---|---|---|
| `households` | tenant (single row in v1) | id, name, currency, timezone, monthly_budget, **stock_epoch**, onboarded_at, is_demo |
| `categories` | 2-level taxonomy, system-seeded | id, parent_id, name, slug, icon, default_base_unit, default_prior_days, is_system |
| `catalog_items` | canonical item | id, household_id, canonical_name, brand, category_id, base_unit, default_pack_size, perishability_days, is_staple, is_archived |
| `item_aliases` | every raw string ever seen → canonical | catalog_item_id, raw_text, normalized_text, source, confidence |
| `receipts` | uploaded source doc | id, household_id, storage_path(s), mime, merchant, purchased_at, **date_source**, total_amount, status, content_hash, external_order_id, parse_model, parse_path, parse_tokens, parse_cost |
| `receipt_lines` | raw parsed rows, immutable | receipt_id, line_no, raw_text, qty_display, unit_display, qty_base, unit_price, line_total, is_non_inventory, matched_item_id, match_confidence, review_state |
| `stock_movements` | **the ledger** | household_id, catalog_item_id, type, qty_base, occurred_at, source_receipt_id, note |
| `item_stats` | denormalized prediction state | catalog_item_id, purchase_count, ewma_interval_days, interval_mad, daily_rate_base, rate_correction, last_purchased_at, predicted_depletion_at, predicted_next_purchase_at, cadence_bucket, cadence_override, confidence, avg_unit_price_90d, updated_at |
| `item_stats_history` | last 5 recomputes per item, for debugging | — |
| `plan_entries` | the generated running lists | household_id, catalog_item_id, cadence_bucket, suggested_qty_base, due_date, state, snoozed_until |
| `shopping_lists` / `shopping_list_items` | materialized list for a run | — |
| `price_history` | per item, per merchant | catalog_item_id, merchant, unit_price, observed_at |
| `ingest_jobs` | async parse queue | receipt_id, state, attempts, error, model_used |

`stock_movements.type ∈ {purchase, consumption, adjustment, waste, initial}`. Current stock = `SUM(qty_base)` over movements where `occurred_at >= household.stock_epoch` (purchases/initial positive, consumption/waste negative). Materialize as a Postgres view `v_current_stock`.

**`stock_epoch` is load-bearing.** Receipts dated before it feed frequency statistics only, never current stock. Without this, backdated historical uploads leave the inventory showing absurd quantities — e.g. 340 kg of rice — from summing every purchase ever made rather than what's actually on the shelf.

---

## 4. Functional requirements

### F1 — Onboarding

One-time wizard, gated by `households.onboarded_at`: household name/currency/budget → 3–8 "how you shop" presets (e.g. *weekly grocery run*, *daily milk*, *monthly staples*) seeding `is_staple` flags and cold-start priors → optional 60-second tick-off of ~40 common household items, creating `initial` stock movements and setting `stock_epoch = now()`.

### F2 — Capture *(the highest-traffic surface — budget accordingly)*

- Camera / file picker / drag-drop. Accepts PDF, JPG, PNG, WEBP, HEIC, HTML/MHTML.
- **Multi-image as one order** — a toggle groups 2–3 screenshots of one scrolled order into a single multimodal call as ordered pages. Non-optional: q-commerce order details rarely fit one screenshot, and without this an order becomes three receipts with triple-counted items.
- **Clipboard paste** — `Cmd/Ctrl+V` anywhere in the app opens Add with the pasted image staged. The fastest path on desktop.
- **Multi-file queue** — select N files → N separate receipts → sequential review with a `3 of 12` counter. This is also the entire historical-catch-up flow: old orders go through the same door, one at a time, whenever convenient.
- **Paste text** — order confirmation email body, routed to a cheaper text-only LLM call.
- **Manual entry** — searchable typeahead over the catalog, recency-ranked, last-quantity prefilled, two taps to repeat a common purchase.
- Client-side preprocessing: HEIC→JPEG, downscale to 2000px long edge, JPEG q85.
- PWA share target (Android only — iOS doesn't support Web Share Target; skip if time-constrained).

### F3 — Parse pipeline (async)

`upload → Supabase Storage → ingest_jobs row → serverless worker → LLM extraction → line matching → review queue → commit`.

Never auto-commits — every receipt lands in review. Duplicate protection via SHA-256 `content_hash`; soft warning on matching (merchant, date, total) from a different file.

**Stuck-job recovery (decided post-consolidation):** the escalation ladder
(Flash → Pro → manual fallback) only covers *LLM* failures. A worker that
crashes or times out mid-run leaves its `ingest_jobs` row in `processing`
with nothing to notice it. Recovery: the nightly 03:00 IST cron (no new cron
trigger — Vercel's free/hobby tier caps cron frequency, so this rides the
existing job rather than adding a minute-level one) also scans for rows
stuck in `processing` past a timeout, increments `attempts`, and re-enqueues
up to a cap (3); past the cap, the job is marked permanently failed and
surfaces in the review queue as a manual-entry case — same failure UX as an
exhausted LLM escalation. **Accepted trade-off:** worst case, a stuck job
isn't detected for up to ~24h. If faster recovery is wanted later, it needs a
different trigger (e.g. an opportunistic check on review-queue page load) —
not decided here, flagged as a follow-up.

### F4 — Canonicalization

Resolve each parsed line, in order:

1. **Exact alias hit** on normalized text → auto-match, confidence 1.0.
2. **Trigram similarity** (`pg_trgm`) ≥ 0.62 → auto-match. Between 0.40–0.62 → suggest top 3 in review.
3. **Miss** → LLM proposes a new catalog item (`canonical_name`, brand, category, base_unit, pack_size, perishability_days), presented as "New item."

Every human confirmation writes a new `item_alias` — the catalog gets permanently sharper with zero manual curation. **Merge tool** in the catalog screen reassigns aliases and movements to a survivor item and recomputes stats.

### F5 — Unit normalization

Each catalog item has `base_unit ∈ {g, ml, piece}`. Conversions at write time: kg→g ×1000, l→ml ×1000, dozen→piece ×12, `pack of N`→piece ×N, `2 × 500ml`→ml 1000. Ambiguous units default to `piece`, qty 1, flagged in review. Store both display values and base values.

### F6 — Categorization

LLM must select a category from the fixed seeded taxonomy (§6) — never invent one. Unresolvable → `uncategorized`, surfaced in review. Recategorization is sticky per catalog item.

### F7 — Review queue

Split view: document preview (left), editable line table (right). Bulk-accept high-confidence lines in one tap; only low-confidence rows demand attention.

- **Purchase date is a first-class, prominent, editable field.** If `date_source != 'document'`, it renders unconfirmed and needs one explicit tap to accept. Default is today. Empty date blocks commit — never guess.
- A receipt dated before `stock_epoch` shows: *"Past order — updates history, not current stock,"* with an override checkbox for the rare case where the item is still on hand.
- Cancelled/refunded detection shows a warning banner (not a hard block).

Commit writes purchase movements, aliases, and price history, and triggers a stats recompute.

### F8 — Inventory

Grouped by category, with "Out of stock" and "Running low" pinned above. Per item card: current stock (base + friendly display, e.g. "1.5 kg ≈ 3 packs"), predicted days remaining, cadence badge, last purchased, avg price, trend sparkline. Filters: category, cadence, stock state, staples-only. Search across name + aliases.

Item detail: purchase history timeline, price chart, a plain-language prediction explanation ("You buy this every ~9 days; last bought 7 days ago; ~2 days left"), and controls to override cadence, mark staple, set perishability, archive.

### F9 — Consumption

Must not depend on the user logging anything, since they may or may not.

1. **Explicit:** "Used it up" (zeroes stock), "Used some" (−25/50/75% or numeric), "Wasted/expired."
2. **Implicit depletion:** stock is decremented *virtually* for display and prediction using `daily_rate_base`. This is a projection only — never a written ledger movement.
3. **Repurchase reconciliation:** at each repurchase, compare projected stock against reality. If projected stock exceeded 40% of a pack size, `rate_correction ×= 0.85` (the model over-estimated consumption); if projected stock had already hit ≤0 for more than 20% of the interval, `rate_correction ×= 1.15`. Clamp cumulative correction to [0.5, 2.0]. **Scope (decided post-consolidation):** this comparison only runs when the committed receipt is the chronologically latest purchase on record for that item. A backdated commit (REQ-22) updates interval/frequency stats only — it never triggers this correction step, since "projected vs. actual right now" is only meaningful at the most recent data point.

**This closed loop is what makes the system work without user discipline** — the single most important mechanism in the product.

### F10 — Prediction engine

See §5. Runs synchronously on receipt commit (affected items) and nightly at 03:00 IST via cron (all items).

### F11 — Cadence planner / Plan screen *(the product's centerpiece)*

Every item with `confidence ≥ 0.35` gets a `cadence_bucket`: `daily`, `every_2_3_days`, `weekly`, `fortnightly`, `monthly`, `quarterly`, `half_yearly`, `yearly`, `unpredictable`.

Tabs per bucket, each showing items due with suggested quantity, estimated cost, and running total — *"This week's list: 14 items, ~₹2,340."* Suggested qty = modal pack size × `ceil(cycle consumption / pack size)`, floored at 1. Per item: snooze, skip once, always exclude, or move to a different cadence (manual override wins permanently, with a "revert to auto" affordance).

**Today view:** everything due within 3 days across all buckets — the default landing screen.

### F12 — Shopping list

Generate from any bucket, or "everything due in next N days." Checking an item off optionally logs a purchase movement (with a price prompt), so shop trips without receipts still feed the model. Export as plain text / clipboard for sharing.

### F13 — Budget & insights

Monthly spend vs. household budget, split by category. **Forward projection** of next month's committed recurring spend, derived directly from cadences and prices — this is what delivers "a clear view into family requirement and budget." Top-10 spend items, price-change alerts (>15% vs. trailing average), waste report.

### F14 — Notifications

Daily 07:00 IST digest if anything is due within 3 days; weekly Sunday 18:00 IST "next week's list ready." Email via Resend. In-app badges. No web push in v1.

### F15 — Settings

Household name/currency/budget, category management, catalog manager (merge/archive/recategorize), **cost meter** (month-to-date LLM spend, per-receipt average, count by model tier), data export (CSV/JSON), wipe demo data.

### F16 — Backdating

Historical orders are added through the exact same capture flow as new ones (F2), one at a time via the multi-file queue — no separate batch-import subsystem. The purchase date field (F7) and `stock_epoch` (§3) are what make this safe and correct.

### F17 — Synthetic history seeder

See §12. Primary vehicle for validating the prediction engine, since real history will be thin at launch.

---

## 5. Prediction algorithm *(specify exactly — do not let the builder improvise)*

Per `catalog_item`, on each recompute:

**1. Gather events.** Purchase movements ordered by `occurred_at`, last 24 months, cap 40 events. Merge same-day split lines into one event first.

**2. Intervals.** `intervals[i] = days(t[i] - t[i-1])`. Drop intervals < 0.5 days.

**3. Outlier rejection.** Compute median and MAD. Reject intervals where `|x − median| > 3.5 × MAD` (only when n ≥ 5). Prevents one vacation or one bulk stock-up from wrecking the model.

**4. EWMA over intervals**, most-recent-weighted, so the model keeps evolving and never freezes on early data:

```
α = 0.35
ewma = intervals[0]
for x in intervals[1:]: ewma = α·x + (1−α)·ewma
```

**5. Shrinkage to prior** — what stops 2 data points from producing a confident wrong answer:

```
w = n / (n + 2)                      // n = number of usable intervals
prior = category_prior_days(category, is_staple)
interval_est = w·ewma + (1−w)·prior
```

Seed `category_prior_days` per category (milk 2, bread 4, vegetables 5, rice 45, detergent 60, toothpaste 75, etc.) — ~60 seeded priors.

**6. Rate-based cross-check.** Where ≥70% of events have reliable qty/unit:

```
daily_rate_base = Σ qty_base(trailing 120d) / days_elapsed(trailing 120d)
daily_rate = daily_rate_base × rate_correction
depletion_date = last_purchase_at + (current_stock_base / daily_rate)
```

`daily_rate_base` is persisted to `item_stats` as the raw, uncorrected signal
(recomputed fresh from purchase quantities each cycle, `rate_correction` never
baked in); `daily_rate` is derived at read/prediction time, never stored. This
keeps the raw purchase-pattern signal separable from how much reconciliation
(step 3 above) has corrected it — useful for debugging a prediction that looks
wrong.

Blend by data quality `q` (fraction of events with reliable qty):

```
next_purchase = q·depletion_date + (1−q)·(last_purchase_at + interval_est)
```

**7. Perishability clamp.** For items with `perishability_days`, cap `depletion_date` at `last_purchase_at + perishability_days`.

**8. Confidence:**

```
cv = MAD_normalized / median_interval
confidence = clamp( (n/(n+3)) × (1 − min(cv, 1)) , 0, 1 )
```

Display as High (≥0.7) / Medium (0.35–0.7) / Learning (<0.35). Never show the raw number.

**9. Bucket** by `interval_est` (days): `≤1.5 → daily` · `1.5–4 → every_2_3_days` · `4–10 → weekly` · `10–20 → fortnightly` · `20–45 → monthly` · `45–135 → quarterly` · `135–270 → half_yearly` · `270–500 → yearly` · `>500 or confidence<0.35 → unpredictable`.

**10. Hysteresis.** A bucket only changes if the new `interval_est` crosses the boundary by >15%. Prevents flickering between adjacent buckets on every receipt — which destroys trust faster than being wrong.

**11. Persist** to `item_stats`; keep the last 5 recomputes in `item_stats_history` for debugging.

**Implement as a single pure TypeScript function** `computeItemStats(events, currentStock, config) → ItemStats`, no DB access, unit-tested against fixture event sequences. This is the piece most likely to be subtly wrong, and it is the product's entire value.

`avg_unit_price_90d` is a **trailing 90-day weighted average**, not lifetime — lifetime averages run materially below current prices over a long history and would bias every budget projection low. Keep the full series in `price_history` for trend charts.

---

## 6. Category taxonomy (seeded, 2 levels)

**Groceries & Staples** — grains & flour, pulses & lentils, cooking oil & ghee, spices & masala, sugar & salt, dry fruits & nuts

**Fresh** — vegetables, fruits, herbs & greens

**Dairy & Eggs** — milk, curd & yogurt, paneer & cheese, butter, eggs

**Bakery & Breakfast** — bread, biscuits & cookies, cereal, spreads & jam

**Beverages** — tea & coffee, juices, soft drinks, water

**Packaged & Instant** — noodles & pasta, sauces & condiments, ready-to-eat, canned

**Snacks & Confectionery** — namkeen & chips, chocolates & sweets

**Meat & Seafood** — chicken, mutton, fish, frozen

**Home Care** — laundry, dishwashing, floor & surface, pest control, tissue & foil

**Personal Care** — hair, skin, oral, bath & soap, shaving & grooming, feminine care, deodorant

**Baby & Kids** — diapers, baby food, baby care

**Health** — medicines, supplements, first aid

**Pet Supplies** — pet food, pet care

**Utilities & Refills** — LPG, water can, gas/electric

**Kitchen & Household Goods** — utensils, storage, small appliances

**Stationery & Misc** — uncategorized

Every leaf carries `default_base_unit` and `default_prior_days`.

---

## 7. LLM extraction contract

**Provider:** Gemini Flash **paid** tier as primary (native PDF + image input, structured JSON output, temperature 0; paid-tier terms don't use submitted content for model training — relevant now and more so once this becomes multi-tenant). Behind an `LlmProvider` interface so the provider is a one-file swap.

**Escalation ladder:**

1. Flash extraction.
2. If schema validation fails, or `Σ line_total` deviates from stated total by >5%, or mean line confidence < 0.5 → retry once on **Pro** tier with the specific failure appended to the prompt.
3. Still failing → manual entry fallback, with the raw response stored for inspection (and a "flag this parse as bad" affordance).

**Cost fast path:** try native-text extraction (`pdf-parse`) before any multimodal call; if the yield looks like a real document (>200 chars, currency marker, digit-heavy lines), send text-only. Otherwise rasterize and go multimodal. Most native PDF invoices take the cheap path.

**Response schema (Zod-validated):**

```ts
{
  merchant: string | null,
  purchased_at: string | null,        // ISO 8601
  currency: string,                    // default "INR"
  order_total: number | null,
  document_type: "receipt"|"invoice"|"order_confirmation"|"unknown",
  lines: Array<{
    raw_text: string,
    item_name: string,
    brand: string | null,
    quantity: number | null,
    unit: string | null,
    pack_size: string | null,          // e.g. "500 ml", "6 x 100 g"
    unit_price: number | null,
    line_total: number | null,
    category_slug: string,             // MUST be from provided enum
    is_non_inventory: boolean,         // delivery fee, tip, GST, discount rows
    confidence: number                 // 0–1
  }>
}
```

Prompt rules: category_slug must come from the provided enum · mark taxes/fees/discounts `is_non_inventory: true` · **ignore UI chrome in screenshots** (status bars, nav bars, tracking widgets, promo banners) — screenshots often omit merchant/date entirely and include interface elements the model must not treat as line items · return `null` rather than guess, never invent a price.

**Cost control:** loop-bug guard — hard stop at 100 receipts/day, alert at 50. Token accounting stored per-receipt. Cost meter surfaced in Settings.

---

## 8. Architecture

```
Next.js 15 App Router (TS) ── Vercel (free/hobby)
  ├─ Astryx (@astryxdesign/core) + pre-built CSS, dark mode, one theme token set
  ├─ Server Actions for mutations; Route Handlers for webhooks/cron
  ├─ TanStack Query for client cache
  └─ Zod for every boundary
Supabase (free tier)
  ├─ Postgres 15 + pg_trgm; RLS policies written but DISABLED (single-household v1)
  ├─ Storage bucket `receipts`, private, signed URLs (60s TTL)
  └─ Vercel Cron → nightly recompute + digest emails
LLM: Gemini Flash (paid tier) via server-only API route, escalating to Pro on failure.
Email: Resend free tier.
Access: shared-passcode middleware gate (not real auth).
```

**PWA:** manifest + icons + installable, so "later mobile app" is a wrapper decision, not a rewrite. Offline is out of scope; the shell caches, the data does not.

---

## 9. Screens

1. Onboarding wizard (household → shopping presets → optional stock tick-off)
2. **Today** (due soon, quick actions, low stock) — default landing
3. **Inventory** (grouped, filterable, searchable) + item detail sheet
4. **Add** (camera / upload / paste / manual) — persistent entry point
5. **Review** (split view: document + editable lines)
6. **Plan** (cadence tabs — the centerpiece)
7. **Shopping list**
8. **Insights** (budget, spend by category, projection, price alerts)
9. **Settings** / catalog manager (merge, archive, categories, cost meter)

Mobile-first. Bottom tab nav on small screens (Today / Inventory / Add / Plan / Insights), side nav on desktop. Use Astryx templates for table pages, detail layouts, and form flows rather than hand-rolling.

---

## 10. Three-day delivery plan

**Day 1 — Foundation & ingest** *(target: a receipt becomes inventory)*

- Repo, Next.js + Astryx + Supabase wiring, deploy to Vercel within the first hour.
- **Astryx spike in the first 45 minutes** on one real page. Fall back to shadcn/ui by hour 2 if StyleX/Next 15 friction shows up — decide early, not on Day 3.
- Full schema (including `stock_epoch`) + RLS written-but-disabled + seed data (categories, priors, ~300 common items).
- Passcode gate middleware.
- Onboarding wizard.
- Upload → Storage → LLM extraction → `receipt_lines`.
- Matching (alias + trigram) + review screen + commit to ledger.
- **Gate:** upload a real receipt, review it, see items in inventory.

**Day 2 — Intelligence** *(target: predictions and plans)*

- Morning: `computeItemStats` pure function + unit tests, synthetic seeder, validation harness — build and tune together until the S3 scorecard passes (§12).
- Recompute triggers (on-commit + nightly cron).
- Inventory screen with stock/prediction/cadence; item detail with plain-language explanation.
- Consumption actions and reconciliation logic.
- Plan screen with cadence buckets, snooze/skip/override.
- Shopping list + share.
- **Gate:** validation scorecard passes; overrides persist across recompute.

**Day 3 — Capture polish, trust, ship**

- Morning: capture-flow polish against real q-commerce screenshots and PDFs — multi-image grouping, clipboard paste, multi-file queue, backdating. This determines whether the app actually gets used.
- Insights & budget projection.
- Manual entry path.
- Catalog manager (merge, archive, recategorize).
- Error/empty/loading states, mobile pass, dark mode, PWA manifest.
- Email digest + cron.
- Security pass (no anon key in client bundle, gate enforced, signed URLs), cost meter, loop-bug guard.
- **Ship gate:** §11 acceptance tests pass on the production URL.

**Sequencing rule:** the ledger, the matcher, and `computeItemStats` are the load-bearing pieces. Build and test those before any screen beyond Review. Everything else is presentation over a correct core.

---

## 11. Acceptance tests

- **A1** Upload a photographed grocery bill → ≥85% lines correct → commit → inventory reflects quantities in base units.
- **A2** Upload the same file again → blocked as duplicate.
- **A3** Upload a 20-line PDF order confirmation → parsed; delivery fee and GST excluded as non-inventory.
- **A4** Buy "Amul Toned Milk 1L" via receipt, then "AMUL MILK TONED 1 LTR" via manual entry → one catalog item, two aliases, purchase_count = 2.
- **A5** Item purchased at day 0, 7, 14, 21 → bucket `weekly`, confidence High, next purchase ≈ day 28.
- **A6** Item purchased at day 0, 7, 60, 67 → outlier interval rejected, bucket stays `weekly`.
- **A7** Item with 2 purchases only → bucket derived mostly from category prior, confidence `Learning`.
- **A8** Mark an item "Used it up" → stock 0, appears in Today.
- **A9** Manual cadence override survives a nightly recompute; "revert to auto" restores computed value.
- **A11** LLM returns malformed JSON → escalates to Pro → then manual fallback, never a crash or silent loss.
- **A12** Merge two catalog items → movements and aliases consolidate, stats recompute correctly.
- **A13** Cold-start household with zero data shows a useful, non-broken Today screen.
- **A18** A backdated receipt (dated before `stock_epoch`) updates frequency stats but not current stock.
- **A21** A document with no extractable date blocks commit; setting a date manually releases it.
- **A22** A native-text PDF takes the text-only parse path; a photographed screenshot takes the multimodal path (verify via `parse_path`).
- **A24** Three screenshots grouped as "one order" produce a single receipt with no triple-counted items.
- **A25** Clipboard paste opens Add with the image staged.
- **A26** The anon Supabase key is absent from the client bundle (grep build output); an unauthenticated request without the gate cookie returns 401.

*(Note: acceptance test ids in this spec intentionally skip A10, A14–A17, A19–A20, A23 — reserved numbering from the original consolidation pass, not a gap to fill.)*

---

## 12. Validation harness (primary vehicle for validating the prediction engine)

Real purchase history will be thin at launch, so the synthetic seeder — not live data — is what proves the engine works.

`pnpm seed:history` (gated `ENABLE_SEED=true`, writes only to a household flagged `is_demo = true`, one-command wipe) generates 12 months of history across ~70 catalog items with known ground-truth intervals:

| Cohort | Purpose | ~count |
|---|---|---|
| Clean periodic (jitter σ = 15%), all cadence buckets | Baseline accuracy | 25 |
| High-variance (σ = 40%) | Confidence should read Medium/Learning, not High | 10 |
| Outlier-injected (one vacation gap, or one 3× bulk buy) | Outlier rejection must hold the bucket | 8 |
| Drifting (true interval moves 7d → 14d across the year) | EWMA must track it — the "not fixed on first 2–3 occurrences" requirement, made testable | 8 |
| Cold start (1, 2, 3 purchases only) | Prior-dominated, `Learning` confidence | 10 |
| Perishable with an implausible computed rate | Perishability clamp must bind | 5 |
| Quantity-inconsistent (some events missing qty) | Blend weight `q` behaves correctly | 4 |

Intervals drawn lognormal, quantities from realistic pack sizes, prices with mild inflation drift so the trailing-90-day average diverges visibly from a lifetime average.

`pnpm validate:predictions` prints a per-cohort scorecard:

```
Cohort              n    within±25%   bucket correct   mean abs err
clean periodic      25      88%            96%            1.2d
drifting             8      75%            88%            2.8d
outlier-injected     8      88%           100%            1.4d
high-variance       10      50%            70%            5.1d
S3 (overall, n>=4): 81%   [target 70%]  PASS
```

This turns "does the engine work" from a judgement call into a number, drives Day 2 tuning of α, the shrinkage constant, the MAD threshold, and the hysteresis margin with evidence rather than intuition, and doubles as the regression suite for the eventual multi-tenant rewrite.

---

## 13. Non-functional requirements

- p95 page load < 2.5s on 4G; parse round trip < 30s p95, async with visible progress state.
- All secrets server-side. Storage private, signed URLs, 60s TTL.
- Free-tier envelope: compress uploads client-side to ≤1.5 MB; purge receipt files older than 12 months (keep parsed data, not the original file); `ingest_jobs.raw_response` (raw LLM output retained on manual-entry fallback, §7) follows the same 12-month purge, not kept indefinitely.
- Structured logging on the ingest pipeline keyed on `receipt_id`.
- WCAG AA — Astryx components ship accessible; don't undo it with custom markup.
- Loop-bug guard: hard stop at 100 receipts/day, alert at 50.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| **Astryx is beta** — API churn, thin docs, StyleX interop with Next 15 | Spike in the first 45 minutes of Day 1. Fallback: shadcn/ui, same composition philosophy. Decide by hour 2. |
| Screenshot extraction accuracy (the dominant real-world format) | Escalation ladder (Flash → Pro), mandatory review queue, "flag bad parse" button storing raw output for inspection. |
| Thin real purchase history at launch | Synthetic validation harness (§12) carries engine validation; real cadences firm up over the first month of actual use. |
| Shared passcode is not real authentication | Explicitly scoped to grocery data only until the multi-tenant phase; RLS shipped disabled but ready. |
| 3-day scope creep | §15 deferred list is a contract, not a suggestion. |

---

## 15. Deferred (explicitly not in v1)

Real ordering / retailer integration · barcode scanning · expiry-date tracking per unit · recipe or meal planning · multi-tenancy and auth (invites, roles, RLS enabled) · web push · offline sync · seasonality and festival modeling · shared real-time list editing · native app · email auto-forwarding inbox · household member spend attribution · bulk/batch historical import (mbox, CSV) — historical orders go through the normal one-at-a-time capture flow instead.

---

## 16. Pre-flight checks before starting the clock

Both of these are recent enough (as of this spec's writing) that details may have moved — verify before Day 1:

- Current Astryx beta documentation and component API, in case of changes since release.
- Current Gemini Flash pricing tier and PDF page/size limits.

---

*This spec is intended to be handed to a PM-doc and Architect-doc generator, and from there to Claude Code for a single build pass. The prediction algorithm (§5), the domain model (§3), and the validation harness (§12) are the load-bearing sections — treat them as fixed contracts, not suggestions, during implementation.*
