// Approximate — "gemini-flash-latest"/"gemini-pro-latest" are aliases that
// can point at a different underlying model over time, so this is a
// reasonable estimate for the cost meter (working spec Sec7), not a
// guaranteed-accurate billing reconciliation. Rates as of 2026-07
// (Gemini 3.6 Flash / 3.1 Pro), per 1M tokens, USD.
const RATES = {
  flash: { input: 1.5, output: 7.5 },
  pro: { input: 2.0, output: 12.0 },
} as const;

export function estimateCostUsd(tier: 'primary' | 'escalation', inputTokens: number, outputTokens: number): number {
  const rate = tier === 'primary' ? RATES.flash : RATES.pro;
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}
