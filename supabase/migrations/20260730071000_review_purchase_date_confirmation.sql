-- S-12: purchase date must be explicitly confirmed by a human before a
-- receipt can be committed (F7, A21) — date_source alone can't express
-- "extracted but not yet accepted", so this adds the missing gate. The only
-- write path for purchased_at going forward is confirmPurchaseDateAction,
-- which always sets this flag together with the date itself, so
-- "purchased_at set but not confirmed" only happens for the (correct)
-- pre-confirmation state, never as a stale leftover.

alter table receipts
  add column purchased_at_confirmed boolean not null default false;

-- Review's list query (status='parsed') scans this column; no index existed.
create index receipts_status_idx on receipts (status);
