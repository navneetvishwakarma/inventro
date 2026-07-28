---
doc: Capture Journey
project: PANTRY
status: approved
updated: 2026-07-28
---

# Journey 2 — Capturing a purchase

**Persona:** The Restocker.
**Trigger:** Just finished a purchase — offline receipt in hand, or a
q-commerce order just placed on another app.
**Screens:** Add (persistent entry point across the app).

This is the highest-traffic surface in the product ([working spec](../00-working-spec.md) §F2) — every
other journey depends on this one being fast enough that it actually gets used
every time, not just when convenient.

## Steps — offline receipt (photo)

1. **Opens Add, taps camera.** Feeling: this needs to feel as fast as opening
   the phone's native camera — any extra screen here is a reason to skip it
   next time.
2. **Photographs the receipt.** System: client-side preprocessing (downscale,
   compress) happens invisibly before upload.
3. **Sees an immediate "got it, processing" state**, not a spinner that reads
   as hung — upload should return instantly even though parsing is async.
4. **(Later, or immediately if fast) gets a notification/badge that review is
   ready.** Feeling: trust that it didn't just vanish into the void.

## Steps — q-commerce screenshot(s), multi-image order

1. **Screenshots a scrolled order** (often 2–3 screens since the whole order
   rarely fits one screen). Feeling: mild annoyance at needing multiple
   screenshots — the app must not compound this by treating them as three
   separate purchases.
2. **Opens Add, selects "group as one order"** and picks the 2–3 images in
   order. Feeling: relief that the app anticipated this exact q-commerce
   pattern rather than making them explain it.
3. **Reviews as a single receipt later** — one merchant, one total, no
   triple-counted items.

## Steps — clipboard paste (desktop)

1. **Has a screenshot already on the clipboard** (just took it, or copied from
   somewhere). Presses Cmd/Ctrl+V anywhere in the app.
2. **Add opens with the image already staged** — no explicit "upload" step at
   all. Feeling: this should feel faster than any other capture path on
   desktop, because it skips the file picker entirely.

## Steps — manual entry (no document at all)

1. **Types the item name** into a searchable, recency-ranked typeahead.
2. **Last quantity is prefilled** for anything bought before. Feeling: a
   repeat purchase should be two taps, not a form.

## Steps — historical backfill (multi-file queue)

1. **Selects a folder of old screenshots/receipts at once** (catching up on
   months of history, or just clearing a camera roll backlog).
2. **Sees a sequential review queue with a counter** ("3 of 12"), not 12
   separate flows to context-switch between. Feeling: this should feel like
   working through a to-do list, not repeating the same task from scratch
   each time.
3. **Each item dated before onboarding shows a clear "past order — updates
   history, not current stock" banner** — feeling: reassurance that
   backfilling won't corrupt what's currently on the shelf.

## Friction points the design must resolve

- The camera/upload path must never feel slower than just remembering to buy
  the item next time — this is the actual competition, not other apps.
- Multi-image grouping must be discoverable in the moment (right when 2–3
  screenshots exist), not a settings toggle found only in retrospect.
- The backfill flow must not read as a "different mode" — it's the same Add
  flow, just repeated, so there's no separate UI to learn.

## Success signal

Capture-to-committed-inventory under 15 seconds for a clean receipt (PRD S5);
three grouped screenshots produce exactly one receipt (A24); clipboard paste
opens Add with the image staged with zero extra clicks (A25).

## Edge cases

- HEIC photos (iPhone default) convert to JPEG client-side before upload —
  invisible to the user.
- A paste-text order-confirmation email routes to the cheaper text-only
  parse path automatically — no user-visible difference in flow.
- iOS Web Share Target isn't supported — capture on iOS always starts from
  inside the app, never from the OS share sheet.
