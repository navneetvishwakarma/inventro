-- S-06: receipt_lines was missing columns for several first-class fields in
-- the LLM extraction response (working spec Sec7) — without these, item_name,
-- brand, pack_size, category_slug, and the LLM's own per-line confidence
-- would be silently dropped between extraction (S-06) and canonicalization
-- (E-3, a later epic that needs category_slug/item_name/brand to match or
-- create catalog_items) and review (E-4, which needs to show what the model
-- actually said, confidence included).
--
-- extract_confidence is named distinctly from the existing match_confidence
-- (canonicalization's confidence in a catalog_item match, set at E-3) —
-- these measure different things and must not collide.

alter table receipt_lines
  add column item_name text,
  add column brand text,
  add column pack_size text,
  add column category_slug text,
  add column extract_confidence numeric;
