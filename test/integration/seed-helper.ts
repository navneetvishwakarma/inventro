// S-47: test-only seed/cleanup helper for the seeded-DB integration harness.
// Writes exclusively to DEMO_HOUSEHOLD_ID (guarded by assertDemoHousehold,
// same guard scripts/seed-history.ts and validate-predictions.ts use) and
// only ever inserts fixture rows carrying the FIXTURE_PREFIX marker, so a
// crashed run's leftovers are trivially distinguishable from the ~70 real
// seeded demo items REQ-23's npm run validate:predictions matches by exact
// canonical_name -- a fixture row can never collide with that fixed list.
import { createAdminClient, loadEnvLocal, DEMO_HOUSEHOLD_ID, assertDemoHousehold } from '@/scripts/lib/supabaseAdmin';

export { DEMO_HOUSEHOLD_ID };

export const FIXTURE_PREFIX = 'ZZ-S47-FIXTURE';

export function createSeedClient() {
  loadEnvLocal();
  return createAdminClient();
}

type SeedClient = ReturnType<typeof createSeedClient>;

export async function assertSafeToSeed(supabase: SeedClient): Promise<void> {
  await assertDemoHousehold(supabase);
}

export async function leafCategory(supabase: SeedClient): Promise<{ id: string; default_base_unit: string }> {
  const { data, error } = await supabase.from('categories').select('id, default_base_unit').not('parent_id', 'is', null).limit(1).single();
  if (error || !data) throw error ?? new Error('no leaf category found');
  return data as { id: string; default_base_unit: string };
}

export async function seedFixtureCatalogItem(
  supabase: SeedClient,
  opts: { canonicalName: string; categoryId: string; baseUnit: string },
): Promise<string> {
  const { data, error } = await supabase
    .from('catalog_items')
    .insert({ household_id: DEMO_HOUSEHOLD_ID, canonical_name: opts.canonicalName, category_id: opts.categoryId, base_unit: opts.baseUnit })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('catalog item insert returned no row');
  return data.id as string;
}

export async function seedFixtureAlias(supabase: SeedClient, opts: { catalogItemId: string; rawText: string; normalizedText: string }): Promise<void> {
  const { error } = await supabase
    .from('item_aliases')
    .insert({ household_id: DEMO_HOUSEHOLD_ID, catalog_item_id: opts.catalogItemId, raw_text: opts.rawText, normalized_text: opts.normalizedText, source: 'seed', confidence: 1.0 });
  if (error) throw error;
}

export async function seedFixtureReceipt(supabase: SeedClient, opts: { purchasedAt: string }): Promise<string> {
  const { data, error } = await supabase
    .from('receipts')
    .insert({
      household_id: DEMO_HOUSEHOLD_ID,
      status: 'parsed',
      purchased_at: opts.purchasedAt,
      purchased_at_confirmed: true,
      merchant: `${FIXTURE_PREFIX} Store`,
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('receipt insert returned no row');
  return data.id as string;
}

export async function seedFixtureReceiptLine(
  supabase: SeedClient,
  opts: { receiptId: string; matchedItemId: string; qtyBase: number; lineNo?: number },
): Promise<string> {
  const { data, error } = await supabase
    .from('receipt_lines')
    .insert({
      household_id: DEMO_HOUSEHOLD_ID,
      receipt_id: opts.receiptId,
      line_no: opts.lineNo ?? 1,
      raw_text: `${FIXTURE_PREFIX} line`,
      qty_base: opts.qtyBase,
      matched_item_id: opts.matchedItemId,
      review_state: 'matched',
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('receipt line insert returned no row');
  return data.id as string;
}

// Deletes in FK-dependency order (no ON DELETE CASCADE in this schema --
// see supabase/migrations/20260728130915_full_schema.sql). Idempotent and
// safe to call even if only some rows exist (e.g. a test failed mid-seed).
export async function cleanupFixtureCatalogItems(supabase: SeedClient, catalogItemIds: string[]): Promise<void> {
  if (catalogItemIds.length === 0) return;
  await supabase.from('stock_movements').delete().in('catalog_item_id', catalogItemIds);
  await supabase.from('price_history').delete().in('catalog_item_id', catalogItemIds);
  await supabase.from('item_stats').delete().in('catalog_item_id', catalogItemIds);
  await supabase.from('item_aliases').delete().in('catalog_item_id', catalogItemIds);
  await supabase.from('receipt_lines').delete().in('matched_item_id', catalogItemIds);
  await supabase.from('catalog_items').delete().in('id', catalogItemIds);
}

export async function cleanupFixtureReceipts(supabase: SeedClient, receiptIds: string[]): Promise<void> {
  if (receiptIds.length === 0) return;
  await supabase.from('stock_movements').delete().in('source_receipt_id', receiptIds);
  await supabase.from('receipt_lines').delete().in('receipt_id', receiptIds);
  await supabase.from('receipts').delete().in('id', receiptIds);
}
