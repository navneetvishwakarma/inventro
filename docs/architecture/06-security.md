---
doc: Security
project: Inventro
status: approved
updated: 2026-08-01
---

# Security

> Consolidates the access-control and data-handling picture that's otherwise
> scattered across the PRD, ADR-0006, and the infrastructure doc, and states
> the residual risk explicitly rather than leaving it implied.

## Context

v2 activates real per-user authentication and tenant isolation (ADR-0006),
replacing v1's single shared-passcode gate. This is the "substantially
rewritten, not just amended" pass this doc's own v1 open question called
for — the threat model genuinely changes, not just the mechanism: from one
shared secret protecting one household's data, to per-user credentials
whose failure modes (credential stuffing, session fixation, cross-tenant
data leakage) now matter. The v1 model is kept below as a superseded
record, not deleted — it's still literally correct about the git history.

## Details

### Assets

Unchanged from v1: grocery and household-supply purchase data — what was
bought, when, at what price, and inferred consumption patterns. Receipt
images/PDFs may incidentally contain address or payment-instrument
fragments (a delivery address on a q-commerce screenshot, a masked card
number on a receipt) — unavoidable given the capture format, not something
the product asks for. No payment credentials, no financial account access.
What changes in v2: this data now belongs to a specific household with a
specific set of users, and the access-control question becomes "is this
household's data reachable only by this household's users," not just "is
the app reachable at all."

### Access control (v2 — ADR-0006)

- **Identity**: Supabase Auth, email + password. Password hashing and
  session/JWT issuance happen inside Supabase (`auth.users`), not in this
  codebase — no bcrypt/argon2/jose dependency was added, and none should
  be; hand-rolling either is the alternative ADR-0006 explicitly rejected.
- **Session**: `@supabase/ssr`'s server client, bound to HTTP-only cookies
  Supabase itself manages (access + refresh token pair, auto-rotated).
  Login/signup run as **Server Actions** — `signInWithPassword` executes
  server-side; the anon key stays a server-only env var and is never
  shipped to the client bundle. This preserves, under a different
  mechanism, the same guarantee v1's acceptance test A26 checked ("no
  Supabase key in the client JS"); the v2 acceptance test asserts the same
  thing against the new client split (`lib/supabase/server.ts`).
- **Gate**: `proxy.ts` checks for a valid Supabase session (not a signed
  passcode cookie) and redirects to `/login` on failure, replacing the
  401-page passcode gate. The static-asset/`api/cron/*` exemption list is
  unchanged.
- **Tenant isolation**: enforced at the database layer via Postgres RLS,
  keyed on `auth.uid()` through a `household_members` join (ADR-0006), not
  application-level filtering alone. RLS is **enabled**, not just written —
  the distinction that mattered in v1 (policies existed but no client ever
  connected in a way that made them apply) is now closed: the
  request-scoped Supabase client (`createRequestClient()`) carries the
  user's JWT, so the `authenticated` Postgres role and `auth.uid()` are
  real for every user-facing query.
- **Deliberate exception**: `createServiceClient()` (service-role, bypasses
  RLS) is retained for exactly two call sites — `/api/cron/*` (digest jobs
  legitimately enumerate every household) and the synthetic seeder (REQ-23,
  `is_demo` households). Both are documented exceptions, not leftover scope
  from the v1 pattern; no user-facing Server Action or Route Handler should
  use the service-role client after the multi-tenant migration completes.
- **One user, one household, in v2.** No invite flow, no household
  switcher (ADR-0006 non-goals) — this narrows the attack surface
  considerably versus a full multi-member-household model, and is worth
  keeping narrow deliberately rather than as a temporary gap.

### Residual risk, v2

**Credential stuffing / brute-force login.** Supabase Auth applies its own
platform-level rate limiting to `signInWithPassword`, which is a real
improvement over v1's unmitigated passcode gate — but this app adds no
additional per-account lockout or CAPTCHA. Acceptable at the current
testing scale (the founder creating households to validate isolation); not
yet evaluated for anything beyond that. Revisit before any real user
signup exists.

**No password reset.** No email delivery is configured (REQ-20 is still
unwired). A user who forgets their password in v2 has no self-serve
recovery path — an accepted, explicit gap for this cycle (ADR-0006
non-goals), not an oversight to silently work around.

**Unverified email at signup / account squatting.** Email confirmations
are disabled on the Supabase project (S-56 — the same "no working email
delivery" reason as the password-reset gap above; confirmations can't
complete without a delivery path either). `signUp` therefore grants a
usable session for any syntactically valid email with no proof of
ownership — someone could register a household against another person's
email address first, silently blocking that person's real future signup.
Found during E-20's security review, not closed (fixing it needs the same
missing email infrastructure REQ-20 is blocked on) — recorded here as an
accepted residual risk rather than an undocumented side effect of a
disabled project setting. Revisit together with REQ-20 and password
reset.

**Any authenticated user can wipe the shared demo/validation household.**
`wipeDemoDataAction` (Settings) always targets the fixed
`DEMO_HOUSEHOLD_ID` (REQ-23's synthetic prediction-validation household),
regardless of which household the calling user actually belongs to — it
runs on the service-role client by necessity (a request-scoped client
would be correctly denied by RLS, since the caller isn't a member of that
household). Low severity: the target is regenerable synthetic fixture
data (`npm run seed:history`), never a real tenant's own data, but at
founder-only testing scale "any authenticated user" was one person; it no
longer is. Not restricted — recorded as a known, accepted gap rather than
silently carried forward.

**Cross-tenant data leakage via a missed filter.** This is the risk that
actually matters now that there's more than one tenant, and it's the one
RLS is meant to catch even if application code forgets a `WHERE
household_id = ...` clause — but only for the request-scoped client.
Service-role code (the two exceptions above) has no such backstop; a bug
there leaks across every household with no RLS safety net. Mitigated by
keeping the service-role surface intentionally tiny and by the
cross-household isolation test (two households, assert household A's
session cannot read household B's row) being a hard merge gate on the
multi-tenant epic, not a nice-to-have.

**Blast radius if a single account is compromised.** Scoped to exactly one
household's grocery data — RLS means a compromised session cannot reach
any other tenant's rows regardless of application-code bugs elsewhere in
the request path. This is the actual value the RLS-enable work buys over
v1's "the whole app or nothing" blast radius.

### Data handling (unchanged from v1, consolidated from `07-infrastructure.md`)

- Storage is a private bucket, accessed exclusively via 60-second-TTL signed
  URLs — no public bucket access, ever.
- Receipt files older than 12 months are purged; `ingest_jobs.raw_response`
  (raw LLM output retained on manual-entry fallback, REQ-24) follows the same
  12-month purge. Parsed data (`receipt_lines`, ledger entries) is retained
  indefinitely.
- All secrets (Supabase service-role key, Gemini API key, Resend API key)
  are server-side only.

## Open questions

- [ ] Per-account login rate limiting beyond Supabase Auth's platform
      default — decide whether to add it as a formal REQ once real (non-
      founder) signups exist, or continue accepting the platform default.
- [ ] Password reset via email — blocked on REQ-20's email-provider
      decision; revisit together.

## Superseded (v1)

Kept as a historical record — this described the single-shared-passcode
model and no longer reflects the live access-control mechanism after
ADR-0006.

- A single shared passcode, checked in `proxy.ts` against an env var, set
  a signed HTTP-only cookie with a fixed payload — explicitly not real
  authentication, existing only because Vercel URLs are public by default.
- `household_id` scaffolding (ADR-0004) and RLS-written-but-disabled were
  multi-tenant *readiness*, not a v1 access-control mechanism — v1 had
  exactly one tenant, so RLS being disabled had no v1-era effect.
- Residual risks accepted at the time: no brute-force rate limiting on the
  passcode route (recommended, never formalized), no signing-key rotation
  policy (manual rotation deemed sufficient at single-household scale),
  and a blast radius scoped to "an attacker sees one household's grocery
  data," explicitly conditional on REQ-26's scoping promise holding.
