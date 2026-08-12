import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoObjectGeneratedError } from 'ai';
import { estimateCostUsd } from '@/lib/llm/cost';

// S-85: runExtraction's escalation ladder and terminal-state transitions are
// pure orchestration over the LlmProvider interface (ADR-0003's "one-file
// swap") and the Supabase client -- neither is deterministic to exercise
// via a real Gemini call (LLM output isn't reproducible on demand) or a real
// request-scoped client (createRequestClient reads next/headers cookies(),
// which only resolves inside an actual Next.js request). Both are mocked
// here so the actual runExtraction state-machine logic runs for real and is
// asserted against, per this story's option (c).

const receiptFixture = {
  id: 'receipt-1',
  household_id: 'household-1',
  storage_paths: ['fixture.jpg'],
  mime: 'image/jpeg',
};

function makeQueryResult<T>(result: T) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const ingestJobsUpdate = vi.fn();
const receiptsUpdate = vi.fn();
const extractStructured = vi.fn();

function buildSupabaseMock() {
  const receiptsBuilder = makeQueryResult({ data: receiptFixture, error: null });
  receiptsBuilder.update = vi.fn((payload: unknown) => {
    receiptsUpdate(payload);
    return receiptsBuilder;
  });
  const categoriesBuilder = makeQueryResult({ data: [{ slug: 'produce' }], error: null });
  const ingestJobsBuilder = makeQueryResult({ error: null });
  ingestJobsBuilder.update = vi.fn((payload: unknown) => {
    ingestJobsUpdate(payload);
    return ingestJobsBuilder;
  });

  // receipt_lines: only ever exercised here for S-86's escalation-success
  // scenario, which needs runExtraction's insert() and runCanonicalization's
  // select().eq() (called via its own separate createRequestClient()) to
  // both resolve without error. Returning zero rows from the select keeps
  // canonicalization's per-line matching loop a no-op, which is fine -- S-86
  // is about cost/token accounting, not canonicalization behavior.
  const receiptLinesBuilder: Record<string, unknown> = {};
  receiptLinesBuilder.insert = vi.fn(() => Promise.resolve({ error: null }));
  receiptLinesBuilder.select = vi.fn(() => receiptLinesBuilder);
  receiptLinesBuilder.eq = vi.fn(() => Promise.resolve({ data: [], error: null }));

  return {
    from: vi.fn((table: string) => {
      if (table === 'receipts') return receiptsBuilder;
      if (table === 'categories') return categoriesBuilder;
      if (table === 'ingest_jobs') return ingestJobsBuilder;
      if (table === 'receipt_lines') return receiptLinesBuilder;
      throw new Error(`unexpected table in mock: ${table}`);
    }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createRequestClient: vi.fn(async () => buildSupabaseMock()),
  createServiceClient: vi.fn(() => ({
    storage: {
      from: () => ({
        download: vi.fn(async () => ({
          data: { arrayBuffer: async () => new ArrayBuffer(8) },
          error: null,
        })),
      }),
    },
  })),
}));

vi.mock('@/lib/llm/gemini-provider', () => ({
  geminiProvider: { extractStructured },
}));

beforeEach(() => {
  ingestJobsUpdate.mockClear();
  receiptsUpdate.mockClear();
  extractStructured.mockClear();
  extractStructured.mockResolvedValue({
    object: { merchant: null, purchased_at: null, currency: 'INR', order_total: null, document_type: 'unknown', lines: [] },
    rawText: '{}',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  });
});

describe('runExtraction escalation ladder (S-85 zero-line)', () => {
  it('a zero-line primary attempt escalates to Pro tier, and a zero-line escalation lands ingest_jobs in failed (never receipts.parsed)', async () => {
    const { runExtraction } = await import('./extract');
    await runExtraction(receiptFixture.id);

    expect(extractStructured).toHaveBeenCalledTimes(2);
    expect(extractStructured.mock.calls[0][0].tier).toBe('primary');
    expect(extractStructured.mock.calls[1][0].tier).toBe('escalation');

    // First ingest_jobs update: 'processing'. Last: 'failed' -- never 'done'.
    const updateCalls = ingestJobsUpdate.mock.calls.map((c) => c[0]);
    expect(updateCalls[0].state).toBe('processing');
    const finalUpdate = updateCalls[updateCalls.length - 1];
    expect(finalUpdate.state).toBe('failed');
    expect(finalUpdate.error).toContain('no line items extracted');

    // receipts.update (the status: 'parsed' write) must never have been
    // reached at all -- the failure branch returns before touching receipts.
    expect(receiptsUpdate).not.toHaveBeenCalled();
  });
});

// S-86: Gemini bills for the primary (Flash) call whether or not it passes
// checkExtractionQuality -- a failed-then-escalated receipt has TWO billed
// calls, not one. The cost meter must sum both attempts' usage, each costed
// at its own tier via estimateCostUsd, not just the winning (escalation)
// attempt's usage.
describe('runExtraction cost/token accumulation across escalation (S-86)', () => {
  const successObject = {
    merchant: 'Test Store',
    purchased_at: '2026-01-01',
    currency: 'INR',
    order_total: 10,
    document_type: 'receipt',
    lines: [
      {
        raw_text: 'Milk 1L',
        item_name: 'Milk',
        brand: null,
        quantity: 1,
        unit: null,
        pack_size: null,
        unit_price: 10,
        line_total: 10,
        category_slug: 'produce',
        is_non_inventory: false,
        confidence: 0.9,
      },
    ],
  };

  it('sums primary (failed, quality-check) usage + escalation (succeeded) usage, each at its own tier cost', async () => {
    // Primary call uses the default mock from beforeEach: zero lines, null
    // order_total (fails checkExtractionQuality per S-85), usage
    // {inputTokens: 10, outputTokens: 5, totalTokens: 15}.
    extractStructured.mockResolvedValueOnce({
      object: { merchant: null, purchased_at: null, currency: 'INR', order_total: null, document_type: 'unknown', lines: [] },
      rawText: '{}',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
    extractStructured.mockResolvedValueOnce({
      object: successObject,
      rawText: '{"ok":true}',
      usage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
    });

    const { runExtraction } = await import('./extract');
    await runExtraction(receiptFixture.id);

    expect(extractStructured).toHaveBeenCalledTimes(2);
    expect(receiptsUpdate).toHaveBeenCalledTimes(1);

    const expectedTokens = 15 + 280;
    const expectedCost = estimateCostUsd('primary', 10, 5) + estimateCostUsd('escalation', 200, 80);

    const payload = receiptsUpdate.mock.calls[0][0];
    expect(payload.parse_tokens).toBe(expectedTokens);
    expect(payload.parse_cost).toBeCloseTo(expectedCost, 12);

    // Sanity: the bug this closes would produce escalation-only numbers.
    const escalationOnlyCost = estimateCostUsd('escalation', 200, 80);
    expect(payload.parse_cost).not.toBeCloseTo(escalationOnlyCost, 12);
  });

  it('does not crash when the primary attempt fails with NoObjectGeneratedError carrying undefined usage, and skips its contribution', async () => {
    extractStructured.mockImplementationOnce(async () => {
      throw new NoObjectGeneratedError({
        message: 'schema validation failed',
        text: 'garbled',
        response: { id: 'r1', modelId: 'gemini-flash-latest', timestamp: new Date() },
        usage: undefined as never,
        finishReason: 'stop',
      });
    });
    extractStructured.mockResolvedValueOnce({
      object: successObject,
      rawText: '{"ok":true}',
      usage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
    });

    const { runExtraction } = await import('./extract');
    await runExtraction(receiptFixture.id);

    expect(extractStructured).toHaveBeenCalledTimes(2);
    expect(receiptsUpdate).toHaveBeenCalledTimes(1);

    const expectedCost = estimateCostUsd('escalation', 200, 80);
    const payload = receiptsUpdate.mock.calls[0][0];
    expect(payload.parse_tokens).toBe(280);
    expect(payload.parse_cost).toBeCloseTo(expectedCost, 12);
  });

  it('non-escalated single successful attempt: cost/tokens unchanged from the primary-only value', async () => {
    extractStructured.mockResolvedValueOnce({
      object: successObject,
      rawText: '{"ok":true}',
      usage: { inputTokens: 42, outputTokens: 18, totalTokens: 60 },
    });

    const { runExtraction } = await import('./extract');
    await runExtraction(receiptFixture.id);

    expect(extractStructured).toHaveBeenCalledTimes(1);
    const payload = receiptsUpdate.mock.calls[0][0];
    expect(payload.parse_tokens).toBe(60);
    expect(payload.parse_cost).toBeCloseTo(estimateCostUsd('primary', 42, 18), 12);
  });
});
