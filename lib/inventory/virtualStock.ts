// Pure function (working spec F9.2) -- no DB access, no 'server-only' import,
// same shape as lib/predictions/computeItemStats.ts. Never persisted: this is
// a read-time display projection only.

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

export type VirtualStockInput = {
  rawStockBase: number;
  dailyRateBase: number | null;
  rateCorrection: number;
  predictedDepletionAt: string | null;
  lastPurchasedAt: string | null;
  now: string;
};

// predicted_depletion_at is anchored to lastPurchasedAt, not to the
// recompute's wall-clock 'now' (computeRateCrossCheck: depletionDate =
// addDays(lastPurchasedAt, currentStockBase/dailyRate)). Algebraically:
// virtualStock = rawStock - dailyRate * daysBetween(lastPurchasedAt, now) --
// depletion projected since the last purchase, not since the last recompute.
// Falls back to raw stock whenever there's no rate signal to project with.
export function computeVirtualStockBase(input: VirtualStockInput): number {
  const { rawStockBase, dailyRateBase, rateCorrection, predictedDepletionAt, lastPurchasedAt, now } = input;
  if (dailyRateBase === null || predictedDepletionAt === null || lastPurchasedAt === null) {
    return rawStockBase;
  }

  const dailyRate = dailyRateBase * rateCorrection;
  if (dailyRate <= 0) return rawStockBase;

  const elapsedSincePurchase = daysBetween(lastPurchasedAt, now);
  if (elapsedSincePurchase <= 0) return rawStockBase;

  return Math.max(0, rawStockBase - dailyRate * elapsedSincePurchase);
}
