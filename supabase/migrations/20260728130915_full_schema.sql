-- S-02: full domain schema (working spec Sec3, docs/architecture/03-data-model.md)
-- household_id on every table except categories (global, system-seeded taxonomy — ADR-0004).
-- Stock is derived, never stored: see v_current_stock at the bottom (ADR-0001).

create extension if not exists pg_trgm;

create type base_unit_type as enum ('g', 'ml', 'piece');
create type stock_movement_type as enum ('purchase', 'consumption', 'adjustment', 'waste', 'initial');

-- households -----------------------------------------------------------

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  monthly_budget numeric,
  stock_epoch timestamptz not null default now(),
  onboarded_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column households.stock_epoch is
  'Household''s "current inventory starts counting from here" marker. Movements before this feed frequency stats only, never v_current_stock (ADR-0001).';

-- categories (global, system-seeded — no household_id) -----------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories (id),
  name text not null,
  slug text not null unique,
  icon text,
  default_base_unit base_unit_type not null,
  default_prior_days integer not null,
  is_system boolean not null default true
);

create index categories_parent_id_idx on categories (parent_id);

-- catalog_items ----------------------------------------------------------

create table catalog_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  canonical_name text not null,
  brand text,
  category_id uuid not null references categories (id),
  base_unit base_unit_type not null,
  default_pack_size numeric,
  perishability_days integer,
  is_staple boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index catalog_items_household_id_idx on catalog_items (household_id);
create index catalog_items_category_id_idx on catalog_items (category_id);
create index catalog_items_canonical_name_trgm_idx on catalog_items using gin (canonical_name gin_trgm_ops);

-- item_aliases -------------------------------------------------------------

create table item_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  catalog_item_id uuid not null references catalog_items (id),
  raw_text text not null,
  normalized_text text not null,
  source text not null,
  confidence numeric,
  created_at timestamptz not null default now()
);

create index item_aliases_household_id_idx on item_aliases (household_id);
create index item_aliases_catalog_item_id_idx on item_aliases (catalog_item_id);
create index item_aliases_normalized_text_trgm_idx on item_aliases using gin (normalized_text gin_trgm_ops);

-- receipts -------------------------------------------------------------

create table receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  storage_paths text[] not null default '{}',
  mime text,
  merchant text,
  purchased_at timestamptz,
  date_source text,
  total_amount numeric,
  status text not null default 'pending',
  content_hash text,
  external_order_id text,
  parse_model text,
  parse_path text,
  parse_tokens integer,
  parse_cost numeric,
  created_at timestamptz not null default now()
);

create index receipts_household_id_idx on receipts (household_id);

-- receipt_lines (raw parsed rows, immutable) ----------------------------

create table receipt_lines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  receipt_id uuid not null references receipts (id),
  line_no integer not null,
  raw_text text not null,
  qty_display text,
  unit_display text,
  qty_base numeric,
  unit_price numeric,
  line_total numeric,
  is_non_inventory boolean not null default false,
  matched_item_id uuid references catalog_items (id),
  match_confidence numeric,
  review_state text not null default 'pending',
  created_at timestamptz not null default now()
);

create index receipt_lines_household_id_idx on receipt_lines (household_id);
create index receipt_lines_receipt_id_idx on receipt_lines (receipt_id);
create index receipt_lines_matched_item_id_idx on receipt_lines (matched_item_id);

-- stock_movements (the ledger, ADR-0001) --------------------------------

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  catalog_item_id uuid not null references catalog_items (id),
  type stock_movement_type not null,
  qty_base numeric not null,
  occurred_at timestamptz not null default now(),
  source_receipt_id uuid references receipts (id),
  note text,
  created_at timestamptz not null default now()
);

create index stock_movements_household_id_idx on stock_movements (household_id);
create index stock_movements_catalog_item_occurred_at_idx on stock_movements (catalog_item_id, occurred_at);

-- item_stats (denormalized prediction state, one row per item) ---------

create table item_stats (
  catalog_item_id uuid primary key references catalog_items (id),
  household_id uuid not null references households (id),
  purchase_count integer not null default 0,
  ewma_interval_days numeric,
  interval_mad numeric,
  daily_rate_base numeric,
  rate_correction numeric not null default 1,
  last_purchased_at timestamptz,
  predicted_depletion_at timestamptz,
  predicted_next_purchase_at timestamptz,
  cadence_bucket text,
  cadence_override text,
  confidence numeric,
  avg_unit_price_90d numeric,
  updated_at timestamptz not null default now()
);

create index item_stats_household_id_idx on item_stats (household_id);

-- item_stats_history (last 5 recomputes per item, debugging aid only) --

create table item_stats_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  catalog_item_id uuid not null references catalog_items (id),
  recorded_at timestamptz not null default now(),
  stats jsonb not null
);

create index item_stats_history_household_id_idx on item_stats_history (household_id);
create index item_stats_history_catalog_item_id_idx on item_stats_history (catalog_item_id);

-- plan_entries (generated running lists) --------------------------------

create table plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  catalog_item_id uuid not null references catalog_items (id),
  cadence_bucket text,
  suggested_qty_base numeric,
  due_date date,
  state text not null default 'pending',
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plan_entries_household_id_idx on plan_entries (household_id);
create index plan_entries_catalog_item_id_idx on plan_entries (catalog_item_id);

-- shopping_lists / shopping_list_items ----------------------------------

create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  name text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create index shopping_lists_household_id_idx on shopping_lists (household_id);

create table shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  shopping_list_id uuid not null references shopping_lists (id),
  catalog_item_id uuid not null references catalog_items (id),
  qty_base numeric,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index shopping_list_items_household_id_idx on shopping_list_items (household_id);
create index shopping_list_items_shopping_list_id_idx on shopping_list_items (shopping_list_id);

-- price_history ----------------------------------------------------------

create table price_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  catalog_item_id uuid not null references catalog_items (id),
  merchant text,
  unit_price numeric not null,
  observed_at timestamptz not null default now()
);

create index price_history_household_id_idx on price_history (household_id);
create index price_history_catalog_item_id_idx on price_history (catalog_item_id);

-- ingest_jobs (async parse queue) ----------------------------------------

create table ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  receipt_id uuid not null references receipts (id),
  state text not null default 'queued',
  attempts integer not null default 0,
  error text,
  model_used text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ingest_jobs_household_id_idx on ingest_jobs (household_id);
create index ingest_jobs_receipt_id_idx on ingest_jobs (receipt_id);

-- v_current_stock (ADR-0001: plain view, never MATERIALIZED) -----------
-- Current stock = SUM(qty_base) over movements at/after the household's
-- stock_epoch. Baked into the view itself so no caller can forget the filter.

create view v_current_stock with (security_invoker = true) as
select
  sm.household_id,
  sm.catalog_item_id,
  sum(sm.qty_base) as qty_base
from stock_movements sm
join households h on h.id = sm.household_id
where sm.occurred_at >= h.stock_epoch
group by sm.household_id, sm.catalog_item_id;
