const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

// The single ₹ formatter for this app -- every call site previously
// reinvented `₹${n.toFixed(2)}` (or worse, an unformatted `₹${n}`)
// independently, producing inconsistent, ungrouped output (e.g. ₹84200.00
// instead of ₹84,200.00). Not used for USD LLM-cost accounting
// (app/(app)/settings/page.tsx's separate usd() helper).
export function formatMoney(amountInRupees: number): string {
  return formatter.format(amountInRupees);
}
