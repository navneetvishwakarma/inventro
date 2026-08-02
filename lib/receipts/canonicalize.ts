import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestClient } from '@/lib/supabase/server';

// F4's confidence bands: >=0.62 auto-matches, 0.40-0.62 is ambiguous
// ("suggest top 3 in review" — the candidate list itself isn't persisted,
// Review re-queries live), below 0.40 is a miss.
const AUTO_MATCH_THRESHOLD = 0.62;
const NEEDS_REVIEW_THRESHOLD = 0.4;

export function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type MatchResult =
  | { matchedItemId: string; matchConfidence: number; state: 'matched' }
  | { matchedItemId: null; matchConfidence: number | null; state: 'needs_review' | 'new_item' };

// S-09: exact alias hit -> pg_trgm similarity -> miss. similarity() of
// identical strings is always 1.0, so find_best_alias_match's single query
// covers both the exact-hit and fuzzy-match cases from F4. Exported for
// S-12's "Save & match" review action, which re-runs this once against a
// human-edited line -- never called from S-13's commit path (see
// commit_receipt's migration comment for why).
export async function matchCatalogItem(supabase: SupabaseClient, householdId: string, normalizedText: string): Promise<MatchResult> {
  const { data, error } = await supabase.rpc('find_best_alias_match', { p_household_id: householdId, p_normalized_text: normalizedText });
  if (error) throw error;

  const best = data?.[0] as { catalog_item_id: string; score: number } | undefined;
  if (!best) return { matchedItemId: null, matchConfidence: null, state: 'new_item' };
  if (best.score >= AUTO_MATCH_THRESHOLD) return { matchedItemId: best.catalog_item_id, matchConfidence: best.score, state: 'matched' };
  if (best.score >= NEEDS_REVIEW_THRESHOLD) return { matchedItemId: null, matchConfidence: best.score, state: 'needs_review' };
  return { matchedItemId: null, matchConfidence: best.score, state: 'new_item' };
}

export type BaseUnit = 'g' | 'ml' | 'piece';

const WEIGHT_VOLUME_UNITS: Record<string, { base: 'g' | 'ml'; factor: number }> = {
  kg: { base: 'g', factor: 1000 },
  g: { base: 'g', factor: 1 },
  gram: { base: 'g', factor: 1 },
  grams: { base: 'g', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  ltr: { base: 'ml', factor: 1000 },
  litre: { base: 'ml', factor: 1000 },
  liter: { base: 'ml', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
};

const PIECE_SYNONYMS = new Set(['piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'nos', 'no']);

// S-10, working spec F5. Pure and deterministic — no LLM call. Only called
// for lines S-09 already matched to an existing catalog item (targetBaseUnit
// comes from that item); unmatched lines never reach this function.
export function normalizeUnitToBase(qtyDisplay: string | null, unitDisplay: string | null, packSize: string | null, targetBaseUnit: BaseUnit): { qtyBase: number; ambiguous: boolean } {
  const qty = qtyDisplay !== null ? parseFloat(qtyDisplay) : null;
  const multiPackSource = packSize ?? unitDisplay ?? '';

  // "N x M<unit>", e.g. "2 x 500ml" -> base-unit N*M
  const multiMatch = multiPackSource.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b/i);
  if (multiMatch) {
    const [, nStr, mStr, unitStr] = multiMatch;
    const conv = WEIGHT_VOLUME_UNITS[unitStr.toLowerCase()];
    if (conv && conv.base === targetBaseUnit) {
      return { qtyBase: parseFloat(nStr) * parseFloat(mStr) * conv.factor * (qty ?? 1), ambiguous: false };
    }
  }

  // "pack of N" / "N-pack" / "N pack" -> piece x N
  const packMatch = multiPackSource.match(/pack of\s*(\d+)|(\d+)[\s-]*pack\b/i);
  if (packMatch && targetBaseUnit === 'piece') {
    const n = parseInt(packMatch[1] ?? packMatch[2], 10);
    return { qtyBase: n * (qty ?? 1), ambiguous: false };
  }

  const unit = (unitDisplay ?? '').trim().toLowerCase();

  // dozen -> piece x12
  if (unit === 'dozen' && targetBaseUnit === 'piece' && qty !== null) {
    return { qtyBase: qty * 12, ambiguous: false };
  }

  // Already in (or a synonym of) the target base unit -> passthrough
  const conv = WEIGHT_VOLUME_UNITS[unit];
  if (conv && conv.base === targetBaseUnit && qty !== null) {
    return { qtyBase: qty * conv.factor, ambiguous: false };
  }
  if ((PIECE_SYNONYMS.has(unit) || (!unitDisplay && targetBaseUnit === 'piece')) && targetBaseUnit === 'piece' && qty !== null) {
    return { qtyBase: qty, ambiguous: false };
  }

  return { qtyBase: 1, ambiguous: true };
}

type ReceiptLineRow = {
  id: string;
  household_id: string;
  item_name: string;
  brand: string | null;
  category_slug: string;
  is_non_inventory: boolean;
  qty_display: string | null;
  unit_display: string | null;
  pack_size: string | null;
};

// Orchestrates S-11 (non-inventory gate + uncategorized flag), S-09
// (matching), and S-10 (unit normalization) over every line of a receipt,
// in that dependency order. Runs after extraction (S-06/S-07) inserts
// receipt_lines.
export async function runCanonicalization(receiptId: string): Promise<void> {
  const supabase = await createRequestClient();

  const { data: lines, error } = await supabase
    .from('receipt_lines')
    .select('id, household_id, item_name, brand, category_slug, is_non_inventory, qty_display, unit_display, pack_size')
    .eq('receipt_id', receiptId);
  if (error) throw error;
  if (!lines) return;

  for (const line of lines as ReceiptLineRow[]) {
    // S-11: is_non_inventory gate — terminal, S-09/S-10 never see these.
    if (line.is_non_inventory) {
      const { error: updateError } = await supabase.from('receipt_lines').update({ review_state: 'excluded' }).eq('id', line.id);
      if (updateError) throw updateError;
      continue;
    }

    // S-11: F6's "unresolvable -> uncategorized, surfaced in review".
    const categoryNeedsReview = line.category_slug === 'uncategorized';

    // S-09
    const normalized = normalizeText(`${line.brand ? `${line.brand} ` : ''}${line.item_name}`);
    const match = await matchCatalogItem(supabase, line.household_id, normalized);

    if (match.state !== 'matched') {
      const { error: updateError } = await supabase
        .from('receipt_lines')
        .update({ matched_item_id: null, match_confidence: match.matchConfidence, review_state: match.state, qty_base: null })
        .eq('id', line.id);
      if (updateError) throw updateError;
      continue;
    }

    // S-10: only reachable once S-09 resolved an existing catalog item —
    // that item's base_unit is the target, not a category default.
    const { data: catalogItem, error: catalogItemError } = await supabase.from('catalog_items').select('base_unit').eq('id', match.matchedItemId).single();
    if (catalogItemError || !catalogItem) throw catalogItemError ?? new Error(`matched catalog item ${match.matchedItemId} not found`);

    const { qtyBase, ambiguous } = normalizeUnitToBase(line.qty_display, line.unit_display, line.pack_size, catalogItem.base_unit as BaseUnit);
    const reviewState = categoryNeedsReview || ambiguous ? 'needs_review' : 'matched';

    const { error: updateError } = await supabase
      .from('receipt_lines')
      .update({ matched_item_id: match.matchedItemId, match_confidence: match.matchConfidence, qty_base: qtyBase, review_state: reviewState })
      .eq('id', line.id);
    if (updateError) throw updateError;
  }
}
