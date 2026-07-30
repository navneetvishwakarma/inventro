// S-17: npm run seed:history [-- --wipe]
//
// Seeds (or wipes) the working spec Sec12 synthetic validation dataset --
// ~70 catalog items across 7 cohorts, under a dedicated is_demo household,
// with known ground-truth cadence/interval metadata (scripts/seed-history/plan.ts).
// Gated on ENABLE_SEED=true; every write is preceded by assertDemoHousehold,
// which refuses to touch anything but the fixed demo household id.

import { assertDemoHousehold, createAdminClient, DEMO_HOUSEHOLD_ID, loadEnvLocal } from './lib/supabaseAdmin';
import { generateItemDefs, generatePurchaseEvents, type ItemDef } from './seed-history/plan';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function wipeDemoData(supabase: SupabaseAdmin): Promise<void> {
  await assertDemoHousehold(supabase);

  // FK-safe order: children before parents. item_stats/item_stats_history
  // are never written by this harness (S-18 computes in-memory only) but
  // wiped defensively in case a prior manual run touched them.
  const { error: historyErr } = await supabase.from('item_stats_history').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (historyErr) throw historyErr;
  const { error: statsErr } = await supabase.from('item_stats').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (statsErr) throw statsErr;
  const { error: movementsErr } = await supabase.from('stock_movements').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (movementsErr) throw movementsErr;
  const { error: aliasesErr } = await supabase.from('item_aliases').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (aliasesErr) throw aliasesErr;
  const { error: itemsErr } = await supabase.from('catalog_items').delete().eq('household_id', DEMO_HOUSEHOLD_ID);
  if (itemsErr) throw itemsErr;

  console.log(`Wiped demo household ${DEMO_HOUSEHOLD_ID} (catalog_items, stock_movements, item_stats, item_stats_history, item_aliases).`);
}

async function seed(supabase: SupabaseAdmin): Promise<void> {
  await wipeDemoData(supabase); // idempotent reseed
  await assertDemoHousehold(supabase); // re-checked post-wipe, before the household upsert below

  const items = generateItemDefs();
  const anchorNowIso = new Date().toISOString();

  // Earliest possible seeded movement is bounded by computeItemStats' own
  // 24-month lookback (items are never seeded further back than that, see
  // plan.ts); back the stock_epoch off well beyond it so v_current_stock
  // resolves correctly for every demo item regardless of cohort.
  const stockEpoch = new Date(Date.now() - 26 * 30.44 * 86_400_000).toISOString();

  const { error: householdErr } = await supabase.from('households').upsert(
    {
      id: DEMO_HOUSEHOLD_ID,
      name: 'Synthetic Validation Household',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      stock_epoch: stockEpoch,
      is_demo: true,
    },
    { onConflict: 'id' },
  );
  if (householdErr) throw householdErr;

  const { data: categories, error: categoriesErr } = await supabase.from('categories').select('id, slug');
  if (categoriesErr) throw categoriesErr;
  const categoryIdBySlug = new Map((categories ?? []).map((c) => [c.slug as string, c.id as string]));

  const missingSlugs = [...new Set(items.map((i) => i.categorySlug))].filter((slug) => !categoryIdBySlug.has(slug));
  if (missingSlugs.length > 0) throw new Error(`Unknown category slugs in seed plan: ${missingSlugs.join(', ')}`);

  const catalogItemRows = items.map((item) => ({
    household_id: DEMO_HOUSEHOLD_ID,
    canonical_name: item.canonicalName,
    brand: null,
    category_id: categoryIdBySlug.get(item.categorySlug),
    base_unit: item.baseUnit,
    default_pack_size: item.packSize,
    perishability_days: item.perishabilityDays,
    is_staple: item.isStaple,
  }));

  const { data: insertedItems, error: insertItemsErr } = await supabase.from('catalog_items').insert(catalogItemRows).select('id, canonical_name');
  if (insertItemsErr) throw insertItemsErr;

  const catalogItemIdByName = new Map((insertedItems ?? []).map((r) => [r.canonical_name as string, r.id as string]));

  const movementRows: { household_id: string; catalog_item_id: string; type: 'purchase'; qty_base: number | null; occurred_at: string }[] = [];
  for (const item of items) {
    const catalogItemId = catalogItemIdByName.get(item.canonicalName);
    if (!catalogItemId) throw new Error(`Failed to resolve inserted id for ${item.canonicalName}`);
    const events = generatePurchaseEvents(item, anchorNowIso);
    for (const event of events) {
      movementRows.push({
        household_id: DEMO_HOUSEHOLD_ID,
        catalog_item_id: catalogItemId,
        type: 'purchase',
        qty_base: event.qtyBase,
        occurred_at: event.occurredAt,
      });
    }
  }

  for (const batch of chunk(movementRows, 500)) {
    const { error } = await supabase.from('stock_movements').insert(batch);
    if (error) throw error;
  }

  const byCohort = new Map<string, number>();
  for (const item of items) byCohort.set(item.cohort, (byCohort.get(item.cohort) ?? 0) + 1);

  console.log(`Seeded demo household ${DEMO_HOUSEHOLD_ID}:`);
  console.log(`  catalog_items: ${items.length}`);
  console.log(`  stock_movements: ${movementRows.length}`);
  console.log('  cohorts:', Object.fromEntries(byCohort));
}

async function main(): Promise<void> {
  loadEnvLocal();

  if (process.env.ENABLE_SEED !== 'true') {
    console.error('ENABLE_SEED is not "true" -- refusing to run (working spec Sec12 gate). Set ENABLE_SEED=true to proceed.');
    process.exit(1);
  }

  const supabase = createAdminClient();
  const wipeOnly = process.argv.includes('--wipe');

  if (wipeOnly) {
    await wipeDemoData(supabase);
  } else {
    await seed(supabase);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Exported for the throwaway verification script only.
export type { ItemDef };
