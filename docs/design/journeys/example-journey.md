---
doc: journey
project: inventro
status: draft          # draft | approved
updated: 2026-08-13
persona: Restocker     # which docs/product/03-user-personas.md persona this journey is for
req_ref: [REQ-02]      # REQ-xx ids this journey satisfies
---

# Capture a Receipt

> One journey per key flow — grounded in a persona from `03-user-personas.md` and the
> PRD requirements it satisfies. Written before tokens/wireframes so screen structure
> follows real user steps, not the other way around.

## Entry point

The Restocker just finished shopping (in-store or via a q-commerce app) and has a
receipt or order confirmation on hand — a photo, a PDF, or a screenshot — and wants
it captured before the memory of "what did I actually buy" fades.

## Steps

1. Open Add — camera, file-picker, or drag-drop a photographed/PDF/screenshot receipt (REQ-02).
2. If multiple images belong to one order, group them before submitting.
3. Wait for async parse; lines land in the review queue.

## Completion

Extracted lines are visible in the review queue, ready for the Restocker to confirm —
capture itself took seconds, not minutes.

## Screens referenced

_Link each step above to its `docs/design/screens/*.md` doc once wireframes exist._
- Step 1 → `docs/design/screens/example-screen.md` (Add / capture)
