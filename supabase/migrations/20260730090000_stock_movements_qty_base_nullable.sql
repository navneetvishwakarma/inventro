-- S-17/E-6: stock_movements.qty_base becomes nullable (additive, backward
-- compatible -- no existing rows are null, and commit_receipt() (S-13)
-- always writes a concrete value per S-10's acceptance, ambiguous units
-- default to qty 1 rather than leaving it unset). Needed so the working
-- spec Sec12 validation harness can seed real "unreliable quantity"
-- purchase events (the qty_inconsistent cohort) that exercise
-- computeItemStats' q-gated rate cross-check (Sec5 step 6) against actual
-- DB-read data, not just in-memory fixtures -- the pure function's own
-- PurchaseEvent type (lib/predictions/types.ts) already declares
-- qtyBase: number | null, so this closes a gap between the algorithm's
-- contract and what the schema could previously store. Demo-household-only
-- in practice: the real household's commit_receipt() path never writes null.

alter table stock_movements alter column qty_base drop not null;
