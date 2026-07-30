# Epic E-10 — Capture polish & backdating — test plan

No test runner exists in this repo (E-0 through E-9 precedent). Pure functions get
throwaway `npx tsx` fixture scripts (deleted after); DB/Storage-touching behavior is
verified against the live linked Supabase project, exercising real rows/objects and
cleaning up anything inserted for the purpose of the check. Page-render checks reuse
the proven `next dev` + signed gate cookie + curl recipe.

## S-25 — Multi-image-as-one-order grouping toggle

- **Deterministic (live Supabase + Storage):** select 3 real image files with the
  grouping toggle on, upload via `uploadGroupedReceiptAction`. Confirm exactly one
  `receipts` row exists with `storage_paths` an ordered 3-element array matching the
  upload order, exactly one `ingest_jobs` row references it, and after extraction
  completes, `parse_path='multimodal'`. Attempt with 1, 2 (below range... 2 is valid,
  test with 1 and 4), and a mixed image+PDF selection with the toggle on: each rejected
  client-side with an inline error and no server action ever fires (confirm via network
  inspection or a server-side assertion that no new `receipts` row was created).
- **No-orphan-on-failure:** force `uploadGroupedReceiptFiles` to fail after the first of
  3 Storage uploads succeeds (e.g. a duplicate-hash short-circuit inserted mid-call, or
  a temporarily invalid household id) and confirm zero Storage objects remain from the
  attempt afterward.
- **LLM-dependent (live extraction):** check whether real receipt fixtures already exist
  (grep `scripts/`, `docs/`, and what S-18/E-6 used for cohort seeding) before building
  new ones. Slice one real multi-line receipt image into 3 overlapping crops (or reuse
  an existing multi-screenshot q-commerce order if one is available) and run it through
  the real grouped-upload -> extraction path. Confirm the combined `receipt_lines` count
  and quantities do not show each item ~3x (spot-check against the same receipt run
  singly, if available, for a baseline item count). Note whether
  `checkExtractionQuality`'s >5% order-total-deviation check fired (secondary structural
  guard, not the primary proof) -- record the actual outcome, not the theoretical one.
- **Preview:** open `/review/[id]` for the grouped receipt; confirm all 3 images render
  stacked in the left pane, not just the first.
- Every row/object created for this check is deleted afterward (Storage objects,
  `receipts`, `ingest_jobs`, `receipt_lines`).

## S-26 — Clipboard paste

- **Guard behavior (manual browser check, `next dev`):** paste an image while focused
  inside S-28's paste-text textarea or the review page's date input -- confirm the
  global listener does NOT intercept it (no navigation, no upload triggered; the
  textarea/input receives the paste normally, or nothing happens for an image in a text
  input, per native browser behavior). Paste plain text anywhere outside any input --
  confirm no navigation and no upload attempt.
- **Core flow:** from a page other than `/add` (e.g. `/`), paste a real image from the
  system clipboard. Confirm navigation to `/add` happens and the image is uploaded via
  the normal `handleFiles` path (a new `receipts` row appears, same as a file-picker
  upload). Repeat while already on `/add` -- confirm no extra navigation, same upload
  behavior.
- **Filename synthesis:** confirm the synthesized filename's extension matches the
  clipboard image's actual MIME type (e.g. `image/png` -> `.png`) so
  `isAcceptedExtension` accepts it -- verified by confirming the upload succeeds end to
  end, not by inspecting the filename string in isolation.
- Every row/object created for this check is deleted afterward.

## S-27 — Multi-file queue sequential review + backdating

- **Sequential counter:** upload 3 files in one Add batch (multi-file queue, unchanged
  upload mechanics). Confirm the resulting "Review 3 receipts" link carries all 3 ids in
  its `session` param. Open it: confirm "Reviewing 1 of 3" renders. Commit that receipt;
  confirm client-side navigation lands on the second id with "Reviewing 2 of 3" and the
  `session` param now carries the remaining 2 ids. Commit the third; confirm navigation
  returns to `/review` (no more receipts in session).
- **Stranded-committed-receipt fix:** with a live session, directly commit the middle
  receipt out of band (bypassing the UI, e.g. calling `commitReceiptAction` via a
  throwaway script) then load its `/review/[id]?session=...` URL directly. Confirm the
  `status==='committed'` branch still renders the counter and a Next/'back to queue'
  control, not a dead-end card.
- **Backdating (A18), traced AND live-verified, real household:** pick a real catalog
  item with existing purchase history. Upload a new receipt (via the multi-file queue,
  single file is fine for this check) dated 60 days before `household.stock_epoch` (well
  within the 24-month lookback), for that item. Confirm the past-order banner renders in
  review; commit WITHOUT the override checkbox. Confirm, by direct query against live
  Supabase: (a) `v_current_stock` for the item is UNCHANGED by this commit (the backdated
  purchase movement's `occurred_at < stock_epoch` excludes it); (b) `item_stats` for the
  item DOES reflect the new purchase in its interval/frequency computation (a recompute
  ran; `purchase_count` incremented; `last_purchased_at` stays at the item's true latest
  purchase, not regressed to the backdated date, per commit_receipt's `greatest(...)`).
  Repeat with the override checkbox checked: confirm `v_current_stock` DOES increase (an
  `initial`-type movement dated now() is written per commit_receipt's existing override
  branch), while the interval computation is unaffected differently.
  Also confirm `reconcileRateCorrection` (S-15) is skipped for this backdated commit --
  `item_stats.rate_correction` unchanged before/after (S-15's own existing eligibility
  guard, re-verified here rather than assumed).
- Every row/object created or mutated for this check is reverted or deleted afterward.

## S-28 — Paste-text capture

- **Upload + parse path:** paste a real order-confirmation email body's text into the
  new textarea and submit. Confirm a new `receipts` row is created with `mime='text/plain'`,
  extraction completes, and `parse_path='text'` (never 'multimodal'). Confirm
  `receipt_lines` were extracted with plausible values (spot-check 2-3 lines against the
  pasted text by eye).
- **Dedup:** paste the identical text again; confirm it's rejected as a duplicate via the
  existing `findDuplicateReceipt` check (same UX as a duplicate file today).
- **Preview:** open `/review/[id]` for the text receipt; confirm the left pane renders
  the original pasted text in a `<pre>` block (not a broken image/embed, not the
  'open original document' fallback used for mhtml).
- **Storage/bucket confirmation (done once, up front, before writing any code):**
  confirm the `receipts` Storage bucket's config and `receipts.mime` column have no
  restriction that would reject a `text/plain` object -- read directly from the
  migration files, not assumed.
- Every row/object created for this check is deleted afterward.

## Epic gate

Final `advisor` pass across the full changeset (all four stories) before shipping, once
`npm run build` is clean and every story's live-Supabase/Storage verification above has
actually run -- not before. Specifically re-check cross-story interaction: does S-25's
grouped-upload code path correctly fall through S-27's sequential-review counter and
S-26/S-28's shared `handleFiles` pipeline without a special case being missed anywhere.
