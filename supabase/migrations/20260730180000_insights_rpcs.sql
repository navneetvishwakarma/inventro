-- S-31: F13's Insights screen. All aggregation is done here in SQL, never
-- fetch-all-then-reduce-in-JS over price_history/stock_movements -- this
-- repo's own established PostgREST-1000-row-cap bug class (S-18, E-11's
-- catalog manager). Every function only ever reads price_history rows with
-- price_basis='per_base_unit' for spend/price figures -- legacy_unverified
-- rows are counted separately, never silently included in a money total.

-- Spend by TOP-LEVEL category (categories.parent_id is null) in a window,
-- left-joined from the full top-level category list so a category with
-- zero spend this window still appears at 0 (UX doc's explicit edge case),
-- plus a count of legacy-basis rows in the same window (surfaced as an
-- honest caveat, never folded into the total).
create or replace function get_spend_by_category(p_household_id uuid, p_start timestamptz, p_end timestamptz)
returns table(out_category_id uuid, out_category_name text, out_spend numeric, out_legacy_count bigint)
language sql
stable
as $$
  with spend as (
    select
      coalesce(cat.parent_id, cat.id) as top_category_id,
      sum(ph.price_per_base_unit * ph.qty_base) as spend
    from price_history ph
    join catalog_items ci on ci.id = ph.catalog_item_id
    join categories cat on cat.id = ci.category_id
    where ph.household_id = p_household_id
      and ph.price_basis = 'per_base_unit'
      and ph.qty_base is not null
      and ph.observed_at >= p_start
      and ph.observed_at < p_end
    group by 1
  ),
  legacy as (
    select count(*) as legacy_count
    from price_history ph
    where ph.household_id = p_household_id
      and ph.price_basis = 'legacy_unverified'
      and ph.observed_at >= p_start
      and ph.observed_at < p_end
  )
  select
    top.id as out_category_id,
    top.name as out_category_name,
    coalesce(spend.spend, 0) as out_spend,
    (select legacy_count from legacy) as out_legacy_count
  from categories top
  left join spend on spend.top_category_id = top.id
  where top.parent_id is null
  order by top.name;
$$;

-- Most recent price_basis='per_base_unit' observation per catalog item --
-- naturally bounded to at most one row per item, never a large fetch.
create or replace function get_latest_prices(p_household_id uuid)
returns table(out_catalog_item_id uuid, out_price_per_base_unit numeric, out_observed_at timestamptz, out_merchant text)
language sql
stable
as $$
  select distinct on (ph.catalog_item_id)
    ph.catalog_item_id as out_catalog_item_id,
    ph.price_per_base_unit as out_price_per_base_unit,
    ph.observed_at as out_observed_at,
    ph.merchant as out_merchant
  from price_history ph
  where ph.household_id = p_household_id
    and ph.price_basis = 'per_base_unit'
  order by ph.catalog_item_id, ph.observed_at desc;
$$;

-- Top-N catalog items by total spend over the trailing window.
create or replace function get_top_spend_items(p_household_id uuid, p_since timestamptz, p_limit int default 10)
returns table(out_catalog_item_id uuid, out_canonical_name text, out_brand text, out_spend numeric)
language sql
stable
as $$
  select
    ci.id as out_catalog_item_id,
    ci.canonical_name as out_canonical_name,
    ci.brand as out_brand,
    sum(ph.price_per_base_unit * ph.qty_base) as out_spend
  from price_history ph
  join catalog_items ci on ci.id = ph.catalog_item_id
  where ph.household_id = p_household_id
    and ph.price_basis = 'per_base_unit'
    and ph.qty_base is not null
    and ph.observed_at >= p_since
  group by ci.id, ci.canonical_name, ci.brand
  order by sum(ph.price_per_base_unit * ph.qty_base) desc
  limit p_limit;
$$;

-- Price-change alerts: latest per_base_unit observation vs. the trailing
-- average of all PRIOR per_base_unit observations in the lookback window
-- (never including the value being compared against). Gated at
-- n>=p_min_prior prior observations (UX doc: "too little history... should
-- show a lower-confidence or not-enough-data-yet state rather than a
-- misleading number built on 1-2 data points") -- items below the gate are
-- simply absent, not flagged at a false confidence.
create or replace function get_price_alerts(p_household_id uuid, p_lookback_days int default 90, p_min_prior int default 3, p_threshold numeric default 0.15)
returns table(out_catalog_item_id uuid, out_canonical_name text, out_merchant text, out_trailing_avg numeric, out_latest_price numeric, out_pct_change numeric)
language sql
stable
as $$
  with recent as (
    select
      ph.catalog_item_id,
      ph.price_per_base_unit,
      ph.observed_at,
      ph.merchant,
      row_number() over (partition by ph.catalog_item_id order by ph.observed_at desc) as rn
    from price_history ph
    where ph.household_id = p_household_id
      and ph.price_basis = 'per_base_unit'
      and ph.observed_at >= now() - (p_lookback_days || ' days')::interval
  ),
  latest as (
    select catalog_item_id, price_per_base_unit as latest_price, merchant as latest_merchant
    from recent where rn = 1
  ),
  prior_stats as (
    select catalog_item_id, avg(price_per_base_unit) as trailing_avg, count(*) as n
    from recent where rn > 1
    group by catalog_item_id
  )
  select
    l.catalog_item_id as out_catalog_item_id,
    ci.canonical_name as out_canonical_name,
    l.latest_merchant as out_merchant,
    p.trailing_avg as out_trailing_avg,
    l.latest_price as out_latest_price,
    (l.latest_price - p.trailing_avg) / p.trailing_avg as out_pct_change
  from latest l
  join prior_stats p on p.catalog_item_id = l.catalog_item_id
  join catalog_items ci on ci.id = l.catalog_item_id
  where p.n >= p_min_prior
    and p.trailing_avg > 0
    and abs((l.latest_price - p.trailing_avg) / p.trailing_avg) > p_threshold
  order by abs((l.latest_price - p.trailing_avg) / p.trailing_avg) desc;
$$;

-- Waste report: stock_movements type='waste' in a window, summed by item
-- (qty_base is stored NEGATIVE for waste per the core invariant -- ADR-0001
-- -- abs() here so the report shows a positive quantity, not a negative or
-- doubled figure). Valued at the item's latest known per-base-unit price
-- when one exists; out_has_price=false surfaces "value unknown" rather
-- than silently valuing at 0 or omitting the row.
create or replace function get_waste_report(p_household_id uuid, p_start timestamptz, p_end timestamptz)
returns table(out_catalog_item_id uuid, out_canonical_name text, out_qty_base numeric, out_valued_amount numeric, out_has_price boolean)
language sql
stable
as $$
  with waste as (
    select
      sm.catalog_item_id,
      sum(abs(sm.qty_base)) as qty_base
    from stock_movements sm
    where sm.household_id = p_household_id
      and sm.type = 'waste'
      and sm.occurred_at >= p_start
      and sm.occurred_at < p_end
    group by sm.catalog_item_id
  ),
  latest_price as (
    select distinct on (ph.catalog_item_id)
      ph.catalog_item_id, ph.price_per_base_unit
    from price_history ph
    where ph.household_id = p_household_id and ph.price_basis = 'per_base_unit'
    order by ph.catalog_item_id, ph.observed_at desc
  )
  select
    w.catalog_item_id as out_catalog_item_id,
    ci.canonical_name as out_canonical_name,
    w.qty_base as out_qty_base,
    (w.qty_base * lp.price_per_base_unit) as out_valued_amount,
    (lp.price_per_base_unit is not null) as out_has_price
  from waste w
  join catalog_items ci on ci.id = w.catalog_item_id
  left join latest_price lp on lp.catalog_item_id = w.catalog_item_id
  order by w.qty_base desc;
$$;
