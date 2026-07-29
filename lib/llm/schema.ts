import { z } from 'zod';

// Response schema exactly per working spec Sec7. category_slug's enum is
// built per-call from the live leaf category slugs (S-02), not hardcoded —
// the model must select from what's actually seeded, never invent one.
export function buildReceiptExtractionSchema(categorySlugs: string[]) {
  const categoryEnum = categorySlugs as [string, ...string[]];

  return z.object({
    merchant: z.string().nullable(),
    purchased_at: z.string().nullable(),
    currency: z.string(),
    order_total: z.number().nullable(),
    document_type: z.enum(['receipt', 'invoice', 'order_confirmation', 'unknown']),
    lines: z.array(
      z.object({
        raw_text: z.string(),
        item_name: z.string(),
        brand: z.string().nullable(),
        quantity: z.number().nullable(),
        unit: z.string().nullable(),
        pack_size: z.string().nullable(),
        unit_price: z.number().nullable(),
        line_total: z.number().nullable(),
        category_slug: z.enum(categoryEnum),
        is_non_inventory: z.boolean(),
        confidence: z.number().min(0).max(1),
      }),
    ),
  });
}

export type ReceiptExtraction = z.infer<ReturnType<typeof buildReceiptExtractionSchema>>;
