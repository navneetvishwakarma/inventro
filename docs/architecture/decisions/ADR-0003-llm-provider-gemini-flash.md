---
doc: adr
project: Inventro
status: accepted
updated: 2026-07-28
story: "S-06"
---

# ADR-0003: Gemini Flash (paid tier) as primary extraction model, behind a swappable provider interface

## Status

Accepted.

## Context

Receipt/order extraction (PRD REQ-08, REQ-24) needs to handle native PDFs and
photographed screenshots, return structured JSON reliably, and stay cheap
enough to run per-receipt indefinitely ([working spec](../../00-working-spec.md) §13 loop-bug guard: 100
receipts/day hard stop). Since this project starts single-household but is
explicitly designed to become multi-tenant later (`docs/product/10-gtm-strategy.md`),
whatever submitted content policy applies now needs to still be defensible once
other households' receipts are involved.

## Decision

Use Gemini Flash on the **paid tier** as the primary extraction model —
native PDF + image input, structured JSON output, temperature 0 — behind an
`LlmProvider` interface so the provider is a one-file swap. Escalate to Gemini
Pro on schema validation failure, total-mismatch (>5% deviation), or low mean
line confidence (<0.5); fall back to manual entry with the raw response
retained if Pro also fails (ADR-linked stories S-06, S-07).

## Options Considered

### Option A: Gemini Flash paid tier, single-call primary + Pro escalation (chosen)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — needs the escalation ladder and a native-text-first fast path, but one provider to integrate |
| Cost | Low per receipt; paid tier costs more than free tier but is the only way to get a no-training-on-input guarantee |
| Scalability | High — same call shape works whether this is 1 household or 1000 |
| Team familiarity | N/A (build-time decision, no existing team convention) |

**Pros:** native multimodal PDF/image input avoids a separate OCR step; paid
tier's no-training-on-submitted-content terms matter now and matter more once
real households' receipts (potentially containing addresses, order details)
flow through the same pipeline in a multi-tenant future; structured JSON output
simplifies the Zod validation boundary (working spec §7).
**Cons:** paid tier costs more than a free-tier call; mitigated by the
native-PDF-text fast path (`pdf-parse` before any multimodal call) and the
100/day hard stop.

### Option B: Free-tier or open-source vision-language model

**Pros:** zero marginal cost.
**Cons:** free-tier terms typically permit training on submitted content —
unacceptable once real households' data flows through a shared multi-tenant
system, and reversing that data-handling decision later (once real receipts
already exist under the old policy) is far more expensive than paying for the
correct tier from day one.

### Option C: OpenAI GPT-4o-mini / Claude as primary extractor

**Pros:** comparable structured-output quality.
**Cons:** no clear advantage over Flash for this workload, and the
`LlmProvider` interface makes this a reversible, low-cost decision either
way — not worth re-litigating unless Flash's cost or accuracy proves
inadequate in practice.

## Trade-off Analysis

The paid-vs-free tier choice is the one non-obvious call here: it costs more
per receipt today, for a single household, than the workload strictly
requires. It's made anyway because the data-handling policy is far cheaper to
get right before multi-tenant data exists than to migrate after the fact —
this mirrors the `household_id`-from-day-one reasoning in ADR-0004.

## Consequences

- Cost is bounded by the loop-bug guard (100/day hard stop, alert at 50, PRD
  REQ-25) and the native-text fast path, which should route most real PDF
  invoices through the cheap non-multimodal path.
- The `LlmProvider` interface means a future provider swap (e.g. if Gemini
  pricing or quality shifts) touches one file, not the ingest pipeline.
- Escalation ladder adds latency on the failure path only (Pro retry, then
  manual fallback) — the common case (Flash succeeds) stays fast.

## Alternatives considered

- **Skip escalation, single-call only** — rejected; working spec success
  criterion S1 (≥85% line accuracy) and the "never crash, never silently lose
  data" requirement (A11) both need a second attempt with corrective context
  before falling back to a human.
- **Free-tier Gemini** — rejected, see Option B above.
