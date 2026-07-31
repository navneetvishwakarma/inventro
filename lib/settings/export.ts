import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getDefaultHouseholdId } from '@/lib/household';
import { toKolkataDateString } from '@/lib/date';

type Supabase = ReturnType<typeof createServiceClient>;

const PAGE_SIZE = 1000;

// PostgREST's default 1000-row cap (repo convention, see AGENTS.md) means a
// straight .select() over stock_movements/price_history/catalog_items can
// silently truncate for a household with enough history -- a silently
// truncated "backup" would be worse than an export that took longer.
// Paginated with .range() until a page comes back short.
async function selectAllPaged<T>(supabase: Supabase, table: string, columns: string, householdId: string): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq('household_id', householdId)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

type ExportCatalogItem = {
  id: string;
  canonical_name: string;
  brand: string | null;
  category_id: string;
  base_unit: string;
  default_pack_size: number | null;
  perishability_days: number | null;
  is_staple: boolean;
  is_archived: boolean;
  created_at: string;
};

type ExportStockMovement = {
  id: string;
  catalog_item_id: string;
  type: string;
  qty_base: number;
  occurred_at: string;
  source_receipt_id: string | null;
  note: string | null;
};

type ExportPriceHistory = {
  id: string;
  catalog_item_id: string;
  merchant: string | null;
  unit_price: number;
  observed_at: string;
  price_per_base_unit: number | null;
  price_basis: string;
};

type ExportReceipt = {
  id: string;
  merchant: string | null;
  purchased_at: string | null;
  total_amount: number | null;
  status: string;
  parse_model: string | null;
  parse_tokens: number | null;
  parse_cost: number | null;
  created_at: string;
};

// JSON: a full-fidelity, multi-table structured snapshot of the household's
// own data -- a self-directed download (never shared with a third party),
// so the household's own notify_email is included same as its other
// settings. storage_paths deliberately excluded: those are internal
// Storage object keys, not user-facing data.
export async function getExportJson(): Promise<string> {
  const supabase = createServiceClient();
  const householdId = getDefaultHouseholdId();

  const [householdRes, categoriesRes, catalogItems, stockMovements, priceHistory, receipts] = await Promise.all([
    supabase.from('households').select('name, currency, timezone, monthly_budget, notify_email, onboarded_at, created_at').eq('id', householdId).single(),
    supabase.from('categories').select('id, name, slug'),
    selectAllPaged<ExportCatalogItem>(supabase, 'catalog_items', 'id, canonical_name, brand, category_id, base_unit, default_pack_size, perishability_days, is_staple, is_archived, created_at', householdId),
    selectAllPaged<ExportStockMovement>(supabase, 'stock_movements', 'id, catalog_item_id, type, qty_base, occurred_at, source_receipt_id, note', householdId),
    selectAllPaged<ExportPriceHistory>(supabase, 'price_history', 'id, catalog_item_id, merchant, unit_price, observed_at, price_per_base_unit, price_basis', householdId),
    selectAllPaged<ExportReceipt>(supabase, 'receipts', 'id, merchant, purchased_at, total_amount, status, parse_model, parse_tokens, parse_cost, created_at', householdId),
  ]);
  if (householdRes.error) throw householdRes.error;
  if (categoriesRes.error) throw categoriesRes.error;

  const categoryById = new Map((categoriesRes.data ?? []).map((c) => [c.id, c.name]));
  const catalogItemsWithCategory = catalogItems.map((item) => ({ ...item, category_name: categoryById.get(item.category_id) ?? null }));

  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      household: householdRes.data,
      catalog_items: catalogItemsWithCategory,
      stock_movements: stockMovements,
      price_history: priceHistory,
      receipts,
    },
    null,
    2,
  );
}

// CSV can't nest, so this is the one flat, genuinely spreadsheet-useful view
// of this domain: the purchase/movement ledger, one row per stock_movements
// row, joined to the item/category/receipt-merchant it's about.
function csvField(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(fields: (string | number | null)[]): string {
  return fields.map(csvField).join(',');
}

export async function getExportCsv(): Promise<string> {
  const supabase = createServiceClient();
  const householdId = getDefaultHouseholdId();

  const [catalogItemsRes, categoriesRes, receiptsRes, movements] = await Promise.all([
    supabase.from('catalog_items').select('id, canonical_name, category_id, base_unit').eq('household_id', householdId),
    supabase.from('categories').select('id, name'),
    supabase.from('receipts').select('id, merchant').eq('household_id', householdId),
    selectAllPaged<ExportStockMovement>(supabase, 'stock_movements', 'id, catalog_item_id, type, qty_base, occurred_at, source_receipt_id, note', householdId),
  ]);
  if (catalogItemsRes.error) throw catalogItemsRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (receiptsRes.error) throw receiptsRes.error;

  const categoryById = new Map((categoriesRes.data ?? []).map((c) => [c.id, c.name as string]));
  const itemById = new Map((catalogItemsRes.data ?? []).map((i) => [i.id, i]));
  const merchantByReceiptId = new Map((receiptsRes.data ?? []).map((r) => [r.id, r.merchant as string | null]));

  const header = csvRow(['date', 'type', 'item', 'category', 'qty_base', 'base_unit', 'merchant', 'note']);
  const rows = movements
    .slice()
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((m) => {
      const item = itemById.get(m.catalog_item_id);
      const merchant = m.source_receipt_id ? (merchantByReceiptId.get(m.source_receipt_id) ?? null) : null;
      return csvRow([
        toKolkataDateString(m.occurred_at),
        m.type,
        item?.canonical_name ?? '(unknown item)',
        item ? (categoryById.get(item.category_id) ?? null) : null,
        m.qty_base,
        item?.base_unit ?? null,
        merchant,
        m.note,
      ]);
    });

  return [header, ...rows].join('\n');
}
