-- S-08: near-duplicate flag. content_hash (exact-match dedup) already
-- exists from S-02; this is the soft-warning half — a different file whose
-- parsed (merchant, purchased_at, total_amount) matches another receipt.
-- Nullable self-reference, set once parsing completes (merchant/date/total
-- don't exist before then); the not-yet-built Review screen (E-4) can
-- surface this, this story only computes and stores it.

alter table receipts
  add column near_duplicate_of uuid references receipts (id);
