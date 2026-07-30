-- S-09: the ~300 catalog_items seeded in S-02 (supabase/seed.sql) have zero
-- item_aliases rows. Canonicalization only matches against item_aliases, so
-- without this every seeded item is unreachable and gets silently
-- duplicated on first real receipt. Backfill one alias per existing item
-- (raw_text = normalized_text = canonical_name, source='seed') — idempotent,
-- safe to re-run.
insert into item_aliases (household_id, catalog_item_id, raw_text, normalized_text, source, confidence)
select ci.household_id, ci.id, ci.canonical_name, lower(regexp_replace(trim(ci.canonical_name), '\s+', ' ', 'g')), 'seed', 1.0
from catalog_items ci
where not exists (select 1 from item_aliases a where a.catalog_item_id = ci.id);

-- Best trigram match for a normalized text within a household. Returns at
-- most one row (the top candidate); the app decides the confidence band
-- (>=0.62 auto-match, 0.40-0.62 needs_review, below miss). similarity() of
-- identical strings is always 1.0, so this single query also covers the
-- "exact alias hit" case (working spec F4 step 1) without a separate lookup.
create or replace function find_best_alias_match(p_household_id uuid, p_normalized_text text)
returns table (catalog_item_id uuid, score real)
language sql
stable
as $$
  select a.catalog_item_id, similarity(a.normalized_text, p_normalized_text) as score
  from item_aliases a
  where a.household_id = p_household_id
  order by score desc
  limit 1;
$$;
