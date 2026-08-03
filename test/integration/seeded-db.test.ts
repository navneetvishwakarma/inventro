// S-47 (deferred from S-44/S-46): matchCatalogItem's exact-alias-hit and
// pg_trgm fuzzy-match/miss confidence bands, plus commit_receipt's
// backdating-vs-stock_epoch behavior (A18) -- both need real Supabase rows
// (pg_trgm similarity() and the commit_receipt SQL RPC can't be
// meaningfully mocked), so this is a live-DB integration test, not a unit
// test. Runs against DEMO_HOUSEHOLD_ID only (assertSafeToSeed enforces
// this), and every inserted row is prefixed/tagged as a fixture and torn
// down in afterAll -- see test/integration/seed-helper.ts for why this
// can't corrupt REQ-23's npm run validate:predictions (which matches
// catalog_items by exact canonical_name against a fixed list this fixture
// never uses).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createSeedClient,
  assertSafeToSeed,
  leafCategory,
  seedFixtureCatalogItem,
  seedFixtureAlias,
  seedFixtureReceipt,
  seedFixtureReceiptLine,
  cleanupFixtureCatalogItems,
  cleanupFixtureReceipts,
  DEMO_HOUSEHOLD_ID,
  FIXTURE_PREFIX,
} from './seed-helper';
import { matchCatalogItem } from '@/lib/receipts/canonicalize';

const supabase = createSeedClient();
const catalogItemIds: string[] = [];
const receiptIds: string[] = [];

beforeAll(async () => {
  await assertSafeToSeed(supabase);
});

afterAll(async () => {
  await cleanupFixtureReceipts(supabase, receiptIds);
  await cleanupFixtureCatalogItems(supabase, catalogItemIds);
});

describe('matchCatalogItem (pg_trgm alias matching, S-09/F4)', () => {
  it('exact alias hit -> matched, confidence 1.0', async () => {
    const category = await leafCategory(supabase);
    const catalogItemId = await seedFixtureCatalogItem(supabase, { canonicalName: `${FIXTURE_PREFIX} Amul Taaza Toned Milk`, categoryId: category.id, baseUnit: category.default_base_unit });
    catalogItemIds.push(catalogItemId);
    await seedFixtureAlias(supabase, { catalogItemId, rawText: 'Amul Taaza Toned Milk 500ml', normalizedText: 'amul taaza toned milk 500ml' });

    const result = await matchCatalogItem(supabase, DEMO_HOUSEHOLD_ID, 'amul taaza toned milk 500ml');
    expect(result.state).toBe('matched');
    expect(result.matchedItemId).toBe(catalogItemId);
    expect(result.matchConfidence).toBe(1);
  });

  it('fuzzy match in the needs_review band (0.40-0.62) -> needs_review, no auto-match', async () => {
    const category = await leafCategory(supabase);
    const catalogItemId = await seedFixtureCatalogItem(supabase, { canonicalName: `${FIXTURE_PREFIX} Amul Taaza Toned Milk 2`, categoryId: category.id, baseUnit: category.default_base_unit });
    catalogItemIds.push(catalogItemId);
    await seedFixtureAlias(supabase, { catalogItemId, rawText: 'Amul Taaza Toned Milk 500ml', normalizedText: 'amul taaza toned milk 500ml' });

    // Calibrated empirically against this exact alias (see .claude/epic-17/ledger.md):
    // real pg_trgm similarity('amul taaza toned milk 500ml', 'amul toned milk') = 0.593.
    const result = await matchCatalogItem(supabase, DEMO_HOUSEHOLD_ID, 'amul toned milk');
    expect(result.state).toBe('needs_review');
    expect(result.matchedItemId).toBeNull();
    expect(result.matchConfidence).not.toBeNull();
    expect(result.matchConfidence as number).toBeGreaterThanOrEqual(0.4);
    expect(result.matchConfidence as number).toBeLessThan(0.62);
  });

  it('unrelated text -> new_item (miss, below 0.40)', async () => {
    const category = await leafCategory(supabase);
    const catalogItemId = await seedFixtureCatalogItem(supabase, { canonicalName: `${FIXTURE_PREFIX} Amul Taaza Toned Milk 3`, categoryId: category.id, baseUnit: category.default_base_unit });
    catalogItemIds.push(catalogItemId);
    await seedFixtureAlias(supabase, { catalogItemId, rawText: 'Amul Taaza Toned Milk 500ml', normalizedText: 'amul taaza toned milk 500ml' });

    const result = await matchCatalogItem(supabase, DEMO_HOUSEHOLD_ID, `${FIXTURE_PREFIX} completely unrelated grocery item xyz`.toLowerCase());
    expect(result.state).toBe('new_item');
    expect(result.matchedItemId).toBeNull();
  });
});

describe('commit_receipt backdating vs. stock_epoch (A18)', () => {
  it('a backdated receipt committed WITHOUT the past-order override leaves current stock unaffected', async () => {
    const category = await leafCategory(supabase);
    const catalogItemId = await seedFixtureCatalogItem(supabase, { canonicalName: `${FIXTURE_PREFIX} Backdate No-Override`, categoryId: category.id, baseUnit: category.default_base_unit });
    catalogItemIds.push(catalogItemId);

    const { data: household, error: hhErr } = await supabase.from('households').select('stock_epoch').eq('id', DEMO_HOUSEHOLD_ID).single();
    if (hhErr || !household) throw hhErr ?? new Error('demo household not found');
    const stockEpoch = new Date(household.stock_epoch as string);
    const beforeEpoch = new Date(stockEpoch.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days before stock_epoch

    const receiptId = await seedFixtureReceipt(supabase, { purchasedAt: beforeEpoch });
    receiptIds.push(receiptId);
    await seedFixtureReceiptLine(supabase, { receiptId, matchedItemId: catalogItemId, qtyBase: 5 });

    const { error: rpcError } = await supabase.rpc('commit_receipt', { p_receipt_id: receiptId, p_past_order_override: false, p_new_item_qty_base: {} });
    expect(rpcError).toBeNull();

    const { data: currentStock } = await supabase.from('v_current_stock').select('qty_base').eq('catalog_item_id', catalogItemId).maybeSingle();
    expect(currentStock).toBeNull();
  });

  it('the same backdated receipt committed WITH the past-order override makes current stock reflect it', async () => {
    const category = await leafCategory(supabase);
    const catalogItemId = await seedFixtureCatalogItem(supabase, { canonicalName: `${FIXTURE_PREFIX} Backdate With-Override`, categoryId: category.id, baseUnit: category.default_base_unit });
    catalogItemIds.push(catalogItemId);

    const { data: household, error: hhErr } = await supabase.from('households').select('stock_epoch').eq('id', DEMO_HOUSEHOLD_ID).single();
    if (hhErr || !household) throw hhErr ?? new Error('demo household not found');
    const stockEpoch = new Date(household.stock_epoch as string);
    const beforeEpoch = new Date(stockEpoch.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const receiptId = await seedFixtureReceipt(supabase, { purchasedAt: beforeEpoch });
    receiptIds.push(receiptId);
    await seedFixtureReceiptLine(supabase, { receiptId, matchedItemId: catalogItemId, qtyBase: 7 });

    const { error: rpcError } = await supabase.rpc('commit_receipt', { p_receipt_id: receiptId, p_past_order_override: true, p_new_item_qty_base: {} });
    expect(rpcError).toBeNull();

    const { data: currentStock } = await supabase.from('v_current_stock').select('qty_base').eq('catalog_item_id', catalogItemId).maybeSingle();
    expect(currentStock).not.toBeNull();
    expect(currentStock?.qty_base).toBe(7);

    // The override's 'initial' movement is dated now() (>= stock_epoch);
    // the original 'purchase' movement stays dated at the backdated
    // purchased_at (< stock_epoch) and is excluded -- confirms the override
    // adds a second movement rather than rewriting the first one's date.
    const { data: movements } = await supabase.from('stock_movements').select('type, occurred_at').eq('catalog_item_id', catalogItemId).order('occurred_at', { ascending: true });
    expect(movements).toHaveLength(2);
    expect(movements?.map((m) => m.type).sort()).toEqual(['initial', 'purchase']);
  });
});
