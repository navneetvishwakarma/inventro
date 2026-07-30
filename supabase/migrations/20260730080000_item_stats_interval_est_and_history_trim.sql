-- S-14c: persists the pre-bucketing interval estimate (working spec Sec5
-- step 5) so the next recompute's hysteresis check (step 10) has a stable
-- prior value to compare against, without re-deriving it from
-- ewma_interval_days + purchase_count (which could silently drift if the
-- category prior or purchase_count changes between recomputes).
alter table item_stats add column interval_est_days numeric;

-- S-14c/S-16: keeps item_stats_history capped at the 5 most recent rows per
-- item (docs/architecture/03-data-model.md: a debugging aid, not an audit
-- log). One window-function delete, callable from both the on-commit
-- (single item) and nightly (whole household) recompute paths -- doesn't
-- need to be atomic with the insert it follows (an overlapping on-commit
-- and nightly recompute momentarily leaving 6 rows is fine for a debugging
-- aid).
create or replace function trim_item_stats_history(p_household_id uuid)
returns void
language sql
as $$
  delete from item_stats_history
  where id in (
    select id from (
      select id, row_number() over (partition by catalog_item_id order by recorded_at desc) as rn
      from item_stats_history
      where household_id = p_household_id
    ) ranked
    where ranked.rn > 5
  );
$$;
