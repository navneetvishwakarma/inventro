import { describe, it, expect } from 'vitest';
import { checkExtractionQuality } from './extract';

// S-85: a blank/unreadable photo where the model returns lines: [] and
// order_total: null used to pass checkExtractionQuality cleanly (the
// total-deviation check is gated on orderTotal !== null, the mean-confidence
// check is gated on lines.length > 0 -- with both empty, `problems` stayed
// []), so runExtraction treated it as a fully successful, terminal
// status:'parsed' with zero receipt_lines rows and never escalated to Pro.
describe('checkExtractionQuality (S-85 zero-line classification)', () => {
  it('zero lines and null order_total is flagged as a quality-check failure', () => {
    const problems = checkExtractionQuality([], null);
    expect(problems.length).toBeGreaterThan(0);
  });

  it('zero lines still flags even when order_total is present but 0 (deviation check short-circuits)', () => {
    const problems = checkExtractionQuality([], 0);
    expect(problems.length).toBeGreaterThan(0);
  });

  // Existing checks must keep working unchanged -- this fix is additive.
  it('non-empty lines with good confidence and matching total: no problems', () => {
    const problems = checkExtractionQuality([{ line_total: 10, confidence: 0.9 }], 10);
    expect(problems).toEqual([]);
  });

  it('non-empty lines with low mean confidence: still flagged', () => {
    const problems = checkExtractionQuality([{ line_total: 10, confidence: 0.2 }], null);
    expect(problems.some((p) => p.includes('confidence'))).toBe(true);
  });

  it('order_total deviates >5% from line total sum: still flagged', () => {
    const problems = checkExtractionQuality([{ line_total: 10, confidence: 0.9 }], 100);
    expect(problems.some((p) => p.includes('deviates'))).toBe(true);
  });
});
