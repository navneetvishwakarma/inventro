import 'server-only';
import { generateText, Output } from 'ai';
import { createGoogle } from '@ai-sdk/google';
import type { LlmProvider, LlmContentPart } from '@/lib/llm/provider';

// "latest" aliases, not a pinned dated version — Google keeps these pointed
// at their current recommended stable release, so this file never needs a
// version bump on its own (ADR-0003's "one-file swap" extends to not even
// needing that file touched for routine model upgrades).
const FLASH_MODEL = 'gemini-flash-latest';
const PRO_MODEL = 'gemini-pro-latest';

function getGoogle() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY must be set');
  return createGoogle({ apiKey });
}

function toModelMessageContent(parts: LlmContentPart[]) {
  return parts.map((part) => {
    if (part.type === 'text') return { type: 'text' as const, text: part.text };
    if (part.type === 'image') return { type: 'image' as const, image: part.data, mediaType: part.mediaType };
    return { type: 'file' as const, data: part.data, mediaType: part.mediaType };
  });
}

export const geminiProvider: LlmProvider = {
  async extractStructured({ parts, schema, tier, correctionNote }) {
    const google = getGoogle();
    const model = google(tier === 'primary' ? FLASH_MODEL : PRO_MODEL);

    const content = toModelMessageContent(parts);
    if (correctionNote) {
      content.push({ type: 'text', text: `\nPrevious attempt failed validation: ${correctionNote}\nCorrect this in your response.` });
    }

    const { output, text, usage } = await generateText({
      model,
      temperature: 0,
      output: Output.object({ schema }),
      messages: [{ role: 'user', content }],
    });

    return {
      object: output,
      rawText: text,
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
    };
  },
};
