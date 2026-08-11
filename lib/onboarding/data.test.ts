import { describe, it, expect, vi, beforeEach } from 'vitest';
import { completeOnboarding } from './data';
import { createRequestClient } from '@/lib/supabase/server';

vi.mock('@/lib/household', () => ({
  getCurrentHouseholdId: vi.fn(async () => 'household-1'),
}));

vi.mock('@/lib/supabase/server', () => ({
  createRequestClient: vi.fn(),
}));

// completeOnboarding issues, in order: a catalog_items select (no terminal
// method, awaited directly), a stock_movements select for existing 'initial'
// movements (same shape), an optional stock_movements insert, and a
// households update -- each builder below is a thenable so `await
// supabase.from(...).select(...).eq(...)` resolves without a .single().
function makeSupabase(opts: { catalogItems: { id: string; default_pack_size: number | null }[]; existingInitial: { catalog_item_id: string }[] }) {
  const insertSpy = vi.fn((_rows: unknown[]) => Promise.resolve({ error: null }));
  const updateSpy = vi.fn((_payload: unknown) => Promise.resolve({ error: null }));

  function selectableBuilder(result: { data: unknown; error: null }) {
    const builder: Record<string, unknown> = {};
    builder.eq = () => builder;
    builder.in = () => builder;
    builder.then = (resolve: (v: unknown) => void) => resolve(result);
    return builder;
  }

  const from = vi.fn((table: string) => {
    if (table === 'catalog_items') {
      return { select: () => selectableBuilder({ data: opts.catalogItems, error: null }) };
    }
    if (table === 'stock_movements') {
      return {
        select: () => selectableBuilder({ data: opts.existingInitial, error: null }),
        insert: (rows: unknown[]) => insertSpy(rows),
      };
    }
    if (table === 'households') {
      return {
        update: (payload: unknown) => ({ eq: () => updateSpy(payload) }),
      };
    }
    throw new Error('unexpected table: ' + table);
  });

  return { from, insertSpy, updateSpy };
}

describe('completeOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not insert a duplicate movement for an item that already has an initial movement, but still updates the household', async () => {
    const { from, insertSpy, updateSpy } = makeSupabase({
      catalogItems: [{ id: 'item-1', default_pack_size: 2 }],
      existingInitial: [{ catalog_item_id: 'item-1' }],
    });
    vi.mocked(createRequestClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createRequestClient>>);

    await completeOnboarding('Household', null, ['item-1']);

    expect(insertSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('inserts a movement only for items that do not already have an initial movement', async () => {
    const { from, insertSpy, updateSpy } = makeSupabase({
      catalogItems: [
        { id: 'item-1', default_pack_size: 2 },
        { id: 'item-2', default_pack_size: 5 },
      ],
      existingInitial: [{ catalog_item_id: 'item-1' }],
    });
    vi.mocked(createRequestClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createRequestClient>>);

    await completeOnboarding('Household', null, ['item-1', 'item-2']);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const insertedRows = insertSpy.mock.calls[0][0] as { catalog_item_id: string }[];
    expect(insertedRows.map((r) => r.catalog_item_id)).toEqual(['item-2']);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('inserts movements for all ticked items when none already have an initial movement', async () => {
    const { from, insertSpy, updateSpy } = makeSupabase({
      catalogItems: [{ id: 'item-1', default_pack_size: 2 }],
      existingInitial: [],
    });
    vi.mocked(createRequestClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createRequestClient>>);

    await completeOnboarding('Household', null, ['item-1']);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
