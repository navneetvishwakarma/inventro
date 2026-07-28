---
doc: Onboarding Journey
project: PANTRY
status: approved
updated: 2026-07-28
---

# Journey 1 — First-run onboarding

**Persona:** The Restocker (`docs/product/03-user-personas.md`)
**Trigger:** Opens the app for the very first time, past the passcode gate.
**Screens:** Onboarding wizard → Today (landing).

## Steps

1. **Enters the passcode.** Feeling: mild friction, but expected — they set
   this up themselves. System: sets a signed cookie, no further gating this
   session.
2. **Names the household, sets currency/timezone/budget.** Feeling: neutral,
   quick. Defaults (INR, `Asia/Kolkata`) are pre-filled so this is three taps,
   not five text fields.
3. **Picks 3–8 "how you shop" presets** (e.g. *weekly grocery run*, *daily
   milk*, *monthly staples*) from a short list. Feeling: this is the first
   moment the app feels like it "gets" their household — presets should read
   as recognizable shopping patterns, not abstract settings. System: seeds
   `is_staple` flags and cold-start category priors silently underneath.
4. **Optional 60-second stock tick-off** — a short list of ~40 common
   household items with a single tap each ("we have this"). Feeling: this is
   the moment friction could kill momentum — it must feel like checking boxes
   on a list they already know, not filling out inventory. Anyone who bails
   here should still land somewhere useful.
5. **Lands on Today.** Feeling: "okay, now what" — Today should immediately
   show *something* useful even with almost no data (a prompt to add the
   first real receipt), not a blank state that reads as broken.

## Friction points the design must resolve

- Step 4 is the highest-abandonment risk in the whole journey — it must be
  skippable without penalty, and skipping it must not break the Today screen.
- The presets in step 3 are doing real work (seeding priors) invisibly — the
  wizard should not expose `is_staple` or "priors" as jargon; it should read
  as "tell us roughly how you shop."

## Success signal

A cold-start household (zero real purchases) reaches a non-broken, useful
Today screen (PRD acceptance A13) in under two minutes, having set
`stock_epoch` correctly whether or not they did the tick-off.

## Edge cases

- User skips the tick-off entirely → `stock_epoch = now()` still gets set at
  wizard completion, so the very first real receipt captured afterward is
  unambiguously "current stock," not backdated history.
- User picks zero presets → falls back to global category priors
  (`default_prior_days` per category) rather than blocking completion.
