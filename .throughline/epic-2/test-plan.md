# Epic E-2 — Capture core — test plan

## S-05 — Multi-format capture UI

- **Unit:** none — this story is upload plumbing over already-tested schema; no isolated business-logic function warrants a unit test.
- **Integration (against the live Supabase project, same pattern as prior epics):**
  - Uploading each of PDF/JPG/PNG/WEBP/HEIC/HTML/MHTML creates exactly one `receipts` row with `storage_paths` populated and `status='pending'`.
  - A generated signed URL for that path actually resolves (proves private-bucket-only access, not a public URL).
  - Uploading N files in one selection creates N independent `receipts` rows.
  - A HEIC upload lands in Storage as a JPEG (client-side conversion happened).
- **Manual/E2E (Playwright, same pattern as S-04 — no test runner exists in this repo):**
  - Full browser flow: open Add, drag-drop a file, see the "got it, processing" state immediately (no hang), confirm the receipt row exists.
  - `next build` clean, no Supabase key in `.next/static`.

## S-06 — Upload -> ingest_jobs -> LLM extraction

- **Integration:**
  - A real photographed grocery bill (test fixture) extracts lines with >=85% correctness against a hand-checked expected set (A1's concrete form).
  - A native-text PDF fixture takes `parse_path='text'`; a photographed screenshot fixture takes `parse_path='multimodal'` (A22).
  - `category_slug` on every extracted line is one of the 59 seeded leaf slugs — never invented.
  - Tax/fee/discount lines come back `is_non_inventory=true`.
  - `ingest_jobs.state` transitions queued -> processing -> done correctly; `receipts.parse_tokens`/`parse_cost` are non-null after a successful parse.
- **Manual/E2E:** upload returns to the client before parsing completes (no synchronous multi-second wait on the HTTP response).

## S-07 — Escalation ladder

- **Integration:**
  - A fixture forcing a Zod-schema failure on Flash escalates to Pro exactly once, with the failure reason present in the second prompt.
  - A fixture where Pro also fails lands `ingest_jobs.state='failed'` with `raw_response` populated, never an unhandled exception.
  - A fixture with `sum(line_total)` >5% off the stated total triggers escalation even when the schema itself is valid.
  - A fixture with mean line confidence <0.5 triggers escalation.

## S-08 — Duplicate protection

- **Integration:**
  - Uploading the same file twice: second upload is rejected before any Storage write or DB insert (verify no orphaned Storage object).
  - Two different files whose parsed (merchant, purchased_at, total_amount) match: the second gets a near-duplicate flag, is NOT blocked.
  - Two receipts with matching merchant/date but different total: no flag (exact-field-match only, no fuzzy logic).

## Cross-story check (epic-level)

Once all four stories land: upload a real photographed grocery bill through the full UI, confirm it becomes a parsed `ingest_jobs`/`receipt_lines` pair ready for review (E-2's own acceptance, A1) — no new test beyond confirming the chain holds end to end on one live upload.
