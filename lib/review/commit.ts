import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeUnitToBase, type BaseUnit } from '@/lib/receipts/canonicalize';

type NewItemLine = {
  id: string;
  qty_display: string | null;
  unit_display: string | null;
  pack_size: string | null;
  category_slug: string | null;
};

// S-13: qty_base for a not-yet-created catalog item is computed here, in
// TypeScript, reusing S-10's exact conversion logic (normalizeUnitToBase) --
// commit_receipt() (the SQL function) is deliberately not reimplementing
// unit parsing, so there is one source of truth for F5's rules. The target
// base_unit comes from the resolved category's default_base_unit (seeded
// data, working spec Sec6), not re-derived ad hoc from unit_display.
async function computeNewItemQtyBase(receiptId: string): Promise<Record<string, number>> {
  const supabase = createServiceClient();

  const { data: lines, error: linesError } = await supabase
    .from('receipt_lines')
    .select('id, qty_display, unit_display, pack_size, category_slug')
    .eq('receipt_id', receiptId)
    .eq('review_state', 'new_item');
  if (linesError) throw linesError;
  if (!lines || lines.length === 0) return {};

  const slugs = [...new Set((lines as NewItemLine[]).map((l) => l.category_slug).filter((s): s is string => s !== null))];
  const { data: categories, error: categoriesError } = await supabase.from('categories').select('slug, default_base_unit').in('slug', slugs);
  if (categoriesError) throw categoriesError;

  const baseUnitBySlug = new Map((categories ?? []).map((c) => [c.slug, c.default_base_unit as BaseUnit]));

  const result: Record<string, number> = {};
  for (const line of lines as NewItemLine[]) {
    const targetBaseUnit = line.category_slug ? baseUnitBySlug.get(line.category_slug) : undefined;
    if (!targetBaseUnit) continue; // no resolvable category -- commit_receipt() will reject this line server-side
    const { qtyBase } = normalizeUnitToBase(line.qty_display, line.unit_display, line.pack_size, targetBaseUnit);
    result[line.id] = qtyBase;
  }
  return result;
}

export async function commitReceipt(receiptId: string, pastOrderOverride: boolean): Promise<void> {
  const newItemQtyBase = await computeNewItemQtyBase(receiptId);

  const supabase = createServiceClient();
  const { error } = await supabase.rpc('commit_receipt', {
    p_receipt_id: receiptId,
    p_past_order_override: pastOrderOverride,
    p_new_item_qty_base: newItemQtyBase,
  });
  if (error) throw error;
}
