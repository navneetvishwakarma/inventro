---
doc: screen
project: inventro
status: draft           # draft | approved
updated: 2026-08-13
fidelity: lo-fi          # lo-fi | hi-fi — update in place as this screen matures; don't fork a new file
req_ref: REQ-02          # REQ-xx this screen satisfies
journey: example-journey # which docs/design/journeys/*.md this screen belongs to
---

# Add (Capture)

## Purpose

Let the Restocker get a receipt (camera, file-picker, or drag-drop) into the async
parse pipeline in as few taps as possible.

## Layout (lo-fi)

- Top: three capture affordances — camera, file-picker, drag-drop target.
- Mid: staged-file thumbnails once one or more images are selected, with a
  "these are one order" grouping toggle for multi-image captures.
- Bottom: primary "Submit" action, disabled until at least one file is staged.

## Visual design (hi-fi)

_Fill in once the wireframe above is checkpointed. Apply tokens/primitives from
`docs/design/tokens.md`. Describe or embed the styled mockup._

## States

_Empty, loading, error, success — whichever apply._

## Microcopy

_Labels, CTAs, error messages, empty-state copy for this screen._

## Accessibility notes

- **Structural** (checked at wireframe stage): focus order, tab sequence, landmarks.
- **Visual** (checked at mockup stage): contrast, state indicators beyond color alone.

## Revision history

- 2026-08-13 — created at `lo-fi`.
<!-- On checkpoint approval, append a line here before flipping fidelity to hi-fi, e.g.:
- 2026-08-13 — wireframe checkpointed, approved to proceed to hi-fi.
This line is the only record the checkpoint happened — the automated gate checks for it. -->
