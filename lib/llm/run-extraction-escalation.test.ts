import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  return {
    from: vi.fn((table: string) => {
      if (table === 'receipts') return receiptsBuilder;
      if (table === 'categories') return categoriesBuilder;
      if (table === 'ingest_jobs') return ingestJobsBuilder;
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
