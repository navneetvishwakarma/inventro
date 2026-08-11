import 'server-only';
import { NoObjectGeneratedError } from 'ai';
import { createRequestClient, createServiceClient } from '@/lib/supabase/server';
import { geminiProvider } from '@/lib/llm/gemini-provider';
import { buildReceiptExtractionSchema, type ReceiptExtraction } from '@/lib/llm/schema';
import { extractPdfText, looksLikeRealDocument } from '@/lib/llm/pdf-text';
import { extractHtmlText } from '@/lib/llm/html-text';
import { estimateCostUsd } from '@/lib/llm/cost';
import { flagNearDuplicateIfAny } from '@/lib/receipts/dedup';
import { runCanonicalization } from '@/lib/receipts/canonicalize';
import { extensionOf, isAcceptedExtension, contentTypeFor } from '@/lib/receipts/formats';
import type { LlmContentPart, LlmExtractionResult } from '@/lib/llm/provider';

// S-25 fix (advisor-caught): a grouped receipt's storage_paths can mix
// extensions (e.g. one PNG + one JPEG screenshot) even though the receipt
// row only has ONE mime column. Each page's own mediaType is derived from
// its OWN storage path extension, never from the shared receipt-level mime
// -- correct per-page, regardless of grouping.
function mimeForStoragePath(storagePath: string, fallback: string): string {
  const ext = extensionOf(storagePath);
  return isAcceptedExtension(ext) ? contentTypeFor(ext) : fallback;
}

const EXTRACTION_PROMPT = `You are extracting structured data from a grocery/household purchase receipt or order confirmation.

Rules:
- category_slug MUST be one of the provided category slugs — never invent a new one.
- Mark delivery fees, tips, taxes (GST), and discount line items as is_non_inventory: true.
- If this is a screenshot, ignore UI chrome: status bars, navigation bars, tracking widgets, promo banners. These are not line items.
- Return null rather than guessing. Never invent a price or a date.
- confidence is your own confidence (0-1) that this line was extracted correctly.`;

type ExtractionRouting = { parts: LlmContentPart[]; parsePath: 'text' | 'multimodal' };

// S-25: only the image branch ever receives more than one entry in
// byteList (grouping is image-extension-only, enforced at the upload-action
// layer) — the anti-double-count instruction is appended ONLY when there's
// more than one page, so an ordinary single-screenshot parse's prompt is
// byte-identical to before this story.
const GROUPED_PAGES_INSTRUCTION =
  '\n\nThese images are multiple pages/screenshots of the SAME single order — do not count an item more than once if it appears in more than one image due to scroll overlap.';

type ExtractionPage = { bytes: ArrayBuffer; mime: string };

async function routeExtraction(pages: ExtractionPage[], storagePath: string): Promise<ExtractionRouting> {
  const ext = storagePath.split('.').pop()?.toLowerCase();
  const bytes = pages[0].bytes;
  const mime = pages[0].mime;

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

  // S-28: pasted plain text — already textual, no stripping needed.
  if (mime === 'text/plain') {
    const text = Buffer.from(bytes).toString('utf-8');
    return { parts: [{ type: 'text', text: `${EXTRACTION_PROMPT}\n\nPasted text:\n${text}` }], parsePath: 'text' };
  }

  // Images (jpg/png/webp — HEIC already converted client-side in S-05).
  // S-25: pages.length > 1 means a grouped (multi-image-as-one-order)
  // receipt — one image part per page, in order, EACH WITH ITS OWN mediaType
  // (a grouped set can mix jpg/png), plus the anti-double-count instruction.
  const promptText = pages.length > 1 ? `${EXTRACTION_PROMPT}${GROUPED_PAGES_INSTRUCTION}` : EXTRACTION_PROMPT;
  return {
    parts: [{ type: 'text', text: promptText }, ...pages.map((p) => ({ type: 'image' as const, data: Buffer.from(p.bytes), mediaType: p.mime }))],
    parsePath: 'multimodal',
  };
}

export function checkExtractionQuality(lines: Array<{ line_total: number | null; confidence: number }>, orderTotal: number | null): string[] {
  const problems: string[] = [];

  if (orderTotal !== null) {
    const sumLineTotal = lines.reduce((sum, l) => sum + (l.line_total ?? 0), 0);
    const deviation = orderTotal === 0 ? (sumLineTotal === 0 ? 0 : 1) : Math.abs(sumLineTotal - orderTotal) / orderTotal;
    if (deviation > 0.05) problems.push(`line totals sum to ${sumLineTotal}, deviates >5% from stated order_total ${orderTotal}`);
  }

  if (lines.length > 0) {
    const meanConfidence = lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length;
    if (meanConfidence < 0.5) problems.push(`mean line confidence ${meanConfidence.toFixed(2)} < 0.5`);
  } else {
    // S-85: zero lines is never a legitimate extraction (a delivery-fee-only
    // or non-inventory-only receipt still produces one line with
    // is_non_inventory: true -- see schema.ts, which has no minimum-length
    // constraint on `lines` but every real document produces at least one).
    // Zero lines only ever means the model returned nothing usable.
    problems.push('no line items extracted');
  }

  return problems;
}

type Attempt = { ok: true; result: LlmExtractionResult<ReceiptExtraction> } | { ok: false; problems: string[]; rawText?: string };

// Schema validation failure (NoObjectGeneratedError) is caught here and
// folded into the same "problems" shape as a total-mismatch or low-confidence
// result, so the escalation ladder below treats all three trigger conditions
// from working spec Sec7 identically.
async function attemptExtraction(parts: LlmContentPart[], schema: ReturnType<typeof buildReceiptExtractionSchema>, tier: 'primary' | 'escalation', correctionNote?: string): Promise<Attempt> {
  try {
    const result = await geminiProvider.extractStructured({ parts, schema, tier, correctionNote });
    const problems = checkExtractionQuality(result.object.lines, result.object.order_total);
    if (problems.length > 0) return { ok: false, problems, rawText: result.rawText };
    return { ok: true, result };
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      return { ok: false, problems: [`schema validation failed: ${err.message}`], rawText: err.text };
    }
    throw err;
  }
}

export async function runExtraction(receiptId: string): Promise<void> {
  const supabase = await createRequestClient();
  // storage.objects has zero RLS policies for the receipts bucket by
  // design (20260729020232) -- access control there is "private bucket +
  // signed URLs", not per-role RLS (docs/architecture/06-security.md).
  // Only service-role can read/write it; a request-scoped client would
  // get a permission error on every download.
  const storageClient = createServiceClient();

  const { data: receipt, error: receiptError } = await supabase.from('receipts').select('id, household_id, storage_paths, mime').eq('id', receiptId).single();
  if (receiptError || !receipt) return;

  await supabase.from('ingest_jobs').update({ state: 'processing', updated_at: new Date().toISOString() }).eq('receipt_id', receiptId);

  try {
    // S-25: every storage_paths entry is downloaded — a plain single-file
    // receipt has exactly one, so this is a strict superset of the prior
    // behavior with zero change for that case. Only a grouped (S-25) receipt
    // ever has more than one. Each page's mediaType is derived from its OWN
    // storage path extension, not the shared receipt.mime column, since a
    // grouped set can mix extensions (e.g. one PNG + one JPEG screenshot).
    const pages = await Promise.all(
      receipt.storage_paths.map(async (storagePath: string) => {
        const { data: fileData, error: downloadError } = await storageClient.storage.from('receipts').download(storagePath);
        if (downloadError || !fileData) throw downloadError ?? new Error('download returned no data');
        return { bytes: await fileData.arrayBuffer(), mime: mimeForStoragePath(storagePath, receipt.mime) };
      }),
    );

    const { data: categories, error: categoriesError } = await supabase.from('categories').select('slug').not('parent_id', 'is', null);
    if (categoriesError || !categories || categories.length === 0) throw categoriesError ?? new Error('no leaf categories found');
    const categorySlugs = categories.map((c) => c.slug);

    const { parts, parsePath } = await routeExtraction(pages, receipt.storage_paths[0]);
    const schema = buildReceiptExtractionSchema(categorySlugs);

    // Escalation ladder (working spec Sec7): retry once on Pro with the
    // specific failure appended to the prompt; still failing -> manual-entry
    // fallback with the last raw response retained (REQ-24).
    let attempt = await attemptExtraction(parts, schema, 'primary');
    let tier: 'primary' | 'escalation' = 'primary';
    let totalTokens = 0;
    let totalCost = 0;

    if (!attempt.ok) {
      tier = 'escalation';
      const primaryProblems = attempt.problems;
      attempt = await attemptExtraction(parts, schema, 'escalation', primaryProblems.join('; '));
    }

    if (attempt.ok) {
      totalTokens += attempt.result.usage.totalTokens;
      totalCost += estimateCostUsd(tier, attempt.result.usage.inputTokens, attempt.result.usage.outputTokens);
    }

    if (!attempt.ok) {
      await supabase
        .from('ingest_jobs')
        .update({
          state: 'failed',
          error: attempt.problems.join('; '),
          raw_response: { text: attempt.rawText ?? null },
          attempts: 2,
          updated_at: new Date().toISOString(),
        })
        .eq('receipt_id', receiptId);
      return;
    }

    const result = attempt.result;

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
      // Canonicalization/normalization/categorization (E-3) — inside the main
      // try, not best-effort like the near-duplicate check below: a receipt
      // whose lines never got matched/normalized shouldn't land ingest_jobs
      // 'done', since Review (E-4) depends on review_state being correct.
      await runCanonicalization(receiptId);
    }

    const { error: receiptUpdateError } = await supabase
      .from('receipts')
      .update({
        merchant: result.object.merchant,
        purchased_at: result.object.purchased_at,
        // S-12: date_source distinguishes an extracted date from one a human
        // typed in Review -- 'document' here, 'manual' set only by
        // confirmPurchaseDateAction. Never guessed when the LLM returned null
        // (working spec F7: "empty date blocks commit -- never guess").
        date_source: result.object.purchased_at !== null ? 'document' : null,
        total_amount: result.object.order_total,
        parse_model: tier === 'primary' ? 'gemini-flash-latest' : 'gemini-pro-latest',
        parse_path: parsePath,
        parse_tokens: totalTokens,
        parse_cost: totalCost,
        status: 'parsed',
      })
      .eq('id', receiptId);
    if (receiptUpdateError) throw receiptUpdateError;

    await supabase.from('ingest_jobs').update({ state: 'done', attempts: tier === 'primary' ? 1 : 2, updated_at: new Date().toISOString() }).eq('receipt_id', receiptId);

    // Near-duplicate check (S-08) — only possible now that merchant/date/
    // total exist. Flags, never blocks; failure here shouldn't undo an
    // otherwise-successful parse, so it's deliberately outside the main
    // try's failure semantics for the parse itself.
    await flagNearDuplicateIfAny(receiptId, result.object.merchant, result.object.purchased_at, result.object.order_total).catch((err) => {
      console.error('[flagNearDuplicateIfAny] failed for receipt', receiptId, err);
    });
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
