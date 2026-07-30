-- E-8/S-21: plan_entries becomes the per-item manual-action state table
-- (snooze/skip/exclude). Writes are one row per (household_id,
-- catalog_item_id) via a real upsert -- table is empty in production
-- (never used since E-2), so adding this unique index is purely additive.
create unique index plan_entries_household_catalog_item_uidx
  on plan_entries (household_id, catalog_item_id);
