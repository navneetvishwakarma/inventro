import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { geminiProvider } from '@/lib/llm/gemini-provider';
import { buildReceiptExtractionSchema } from '@/lib/llm/schema';
import { extractPdfText, looksLikeRealDocument } from '@/lib/llm/pdf-text';
import { extractHtmlText } from '@/lib/llm/html-text';
import { estimateCostUsd } from '@/lib/llm/cost';
import type { LlmContentPart } from '@/lib/llm/provider';

const EXTRACTION_PROMPT = `You are extracting structured data from a grocery/household purchase receipt or order confirmation.

Rules:
- category_slug MUST be one of the provided category slugs — never invent a new one.
- Mark delivery fees, tips, taxes (GST), and discount line items as is_non_inventory: true.
- If this is a screenshot, ignore UI chrome: status bars, navigation bars, tracking widgets, promo banners. These are not line items.
- Return null rather than guessing. Never invent a price or a date.
- confidence is your own confidence (0-1) that this line was extracted correctly.`;

type ExtractionRouting = { parts: LlmContentPart[]; parsePath: 'text' | 'multimodal' };

async function routeExtraction(bytes: ArrayBuffer, mime: string, storagePath: string): Promise<ExtractionRouting> {
  const ext = storagePath.split('.').pop()?.toLowerCase();

  if (mime === 'application/pdf' || ext === 'pdf') {
    const text = await extractPdfText(bytes);
    if (looksLikeRealDocument(text)) {
      return { parts: [{ type: 'text', text: `${EXTRACTION_PROMPT}\n\nDocument text:\n${text}` }], parsePath: 'text' };
    }
    // Scanned/image-only PDF: Gemini's native PDF understanding (ADR-0003)
    // handles this directly — no local rasterization step. The working
    // spec's "rasterize and go multimodal" is read here as "send it as a
    // multimodal input", which Gemini's own backend already does for PDFs.
    return {
      parts: [
        { type: 'text', text: EXTRACTION_PROMPT },
        { type: 'file', data: Buffer.from(bytes), mediaType: 'application/pdf' },
      ],
      parsePath: 'multimodal',
    };
  }

  if (mime === 'text/html' || mime === 'multipart/related' || ext === 'html' || ext === 'mhtml') {
    const text = extractHtmlText(Buffer.from(bytes).toString('utf-8'));
    return { parts: [{ type: 'text', text: `${EXTRACTION_PROMPT}\n\nPage text:\n${text}` }], parsePath: 'text' };
  }

  // Images (jpg/png/webp — HEIC already converted client-side in S-05).
  return {
    parts: [
      { type: 'text', text: EXTRACTION_PROMPT },
      { type: 'image', data: Buffer.from(bytes), mediaType: mime },
    ],
    parsePath: 'multimodal',
  };
}

function checkExtractionQuality(lines: Array<{ line_total: number | null; confidence: number }>, orderTotal: number | null): string[] {
  const problems: string[] = [];

  if (orderTotal !== null) {
    const sumLineTotal = lines.reduce((sum, l) => sum + (l.line_total ?? 0), 0);
    const deviation = orderTotal === 0 ? (sumLineTotal === 0 ? 0 : 1) : Math.abs(sumLineTotal - orderTotal) / orderTotal;
    if (deviation > 0.05) problems.push(`line totals sum to ${sumLineTotal}, deviates >5% from stated order_total ${orderTotal}`);
  }

  if (lines.length > 0) {
    const meanConfidence = lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length;
    if (meanConfidence < 0.5) problems.push(`mean line confidence ${meanConfidence.toFixed(2)} < 0.5`);
  }

  return problems;
}

// Flash-only. Escalation to Pro on these same failure conditions is S-07 —
// this function stops at "failed", S-07 wraps it with a retry.
export async function runExtraction(receiptId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: receipt, error: receiptError } = await supabase.from('receipts').select('id, household_id, storage_paths, mime').eq('id', receiptId).single();
  if (receiptError || !receipt) return;

  await supabase.from('ingest_jobs').update({ state: 'processing', updated_at: new Date().toISOString() }).eq('receipt_id', receiptId);

  try {
    const storagePath = receipt.storage_paths[0];
    const { data: fileData, error: downloadError } = await supabase.storage.from('receipts').download(storagePath);
    if (downloadError || !fileData) throw downloadError ?? new Error('download returned no data');
    const bytes = await fileData.arrayBuffer();

    const { data: categories, error: categoriesError } = await supabase.from('categories').select('slug').not('parent_id', 'is', null);
    if (categoriesError || !categories || categories.length === 0) throw categoriesError ?? new Error('no leaf categories found');
    const categorySlugs = categories.map((c) => c.slug);

    const { parts, parsePath } = await routeExtraction(bytes, receipt.mime, storagePath);
    const schema = buildReceiptExtractionSchema(categorySlugs);

    const result = await geminiProvider.extractStructured({ parts, schema, tier: 'primary' });
    const problems = checkExtractionQuality(result.object.lines, result.object.order_total);

    if (problems.length > 0) {
      await supabase
        .from('ingest_jobs')
        .update({
          state: 'failed',
          error: problems.join('; '),
          raw_response: { text: result.rawText, object: result.object },
          updated_at: new Date().toISOString(),
        })
        .eq('receipt_id', receiptId);
      return;
    }

    const lines = result.object.lines.map((line, index) => ({
      household_id: receipt.household_id,
      receipt_id: receiptId,
      line_no: index + 1,
      raw_text: line.raw_text,
      item_name: line.item_name,
      brand: line.brand,
      qty_display: line.quantity !== null ? String(line.quantity) : null,
      unit_display: line.unit,
      pack_size: line.pack_size,
      unit_price: line.unit_price,
      line_total: line.line_total,
      category_slug: line.category_slug,
      is_non_inventory: line.is_non_inventory,
      extract_confidence: line.confidence,
      review_state: 'pending',
    }));

    if (lines.length > 0) {
      const { error: linesError } = await supabase.from('receipt_lines').insert(lines);
      if (linesError) throw linesError;
    }

    const cost = estimateCostUsd('primary', result.usage.inputTokens, result.usage.outputTokens);

    const { error: receiptUpdateError } = await supabase
      .from('receipts')
      .update({
        merchant: result.object.merchant,
        purchased_at: result.object.purchased_at,
        total_amount: result.object.order_total,
        parse_model: 'gemini-flash-latest',
        parse_path: parsePath,
        parse_tokens: result.usage.totalTokens,
        parse_cost: cost,
        status: 'parsed',
      })
      .eq('id', receiptId);
    if (receiptUpdateError) throw receiptUpdateError;

    await supabase.from('ingest_jobs').update({ state: 'done', updated_at: new Date().toISOString() }).eq('receipt_id', receiptId);
  } catch (err) {
    await supabase
      .from('ingest_jobs')
      .update({
        state: 'failed',
        error: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .eq('receipt_id', receiptId);
  }
}
