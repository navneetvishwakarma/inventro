import type { z } from 'zod';

// One-file swap per ADR-0003 — anything that calls an LLM for extraction
// goes through this interface, never a provider SDK directly.

export type LlmContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: Buffer; mediaType: string }
  | { type: 'file'; data: Buffer; mediaType: string };

export type LlmExtractionResult<T> = {
  object: T;
  rawText: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
};

export interface LlmProvider {
  extractStructured<T>(args: { parts: LlmContentPart[]; schema: z.ZodType<T>; tier: 'primary' | 'escalation'; correctionNote?: string }): Promise<LlmExtractionResult<T>>;
}
