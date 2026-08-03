import { describe, it, expect } from 'vitest';
import { extractPdfText, looksLikeRealDocument } from './pdf-text';

// Hand-built minimal PDF (no external fixture/library) -- pdf.js tolerates a
// non-byte-exact xref table and recovers by scanning objects, so this is
// enough to exercise the real extraction path, not a mock.
function buildTestPdf(lines: string[]): Buffer {
  const streamLines = lines.map((l, i) => `BT /F1 12 Tf 10 ${200 - i * 16} Td (${l}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 300 300] /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${streamLines.length} >>\nstream\n${streamLines}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objs.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('extractPdfText', () => {
  // S-54: pdf-parse's internal pdfjs-dist engine references the browser-only
  // DOMMatrix global for text-position transforms. Without an explicit
  // CanvasFactory (pdf-parse/worker) this can throw ReferenceError: DOMMatrix
  // is not defined -- confirmed via production logs, specific to Vercel's
  // serverless bundling of the native @napi-rs/canvas dependency (could not
  // be reproduced locally across bare Node, next dev, or next build+start on
  // this machine -- see .claude/epic-17/ledger.md for the verification
  // trail). This test doesn't reproduce the platform-specific failure, but
  // it does lock in that extraction succeeds with the fix's exact call shape
  // (CanvasFactory passed to PDFParse) so a regression that drops the
  // argument would break a real extraction, not just a mock.
  it('extracts text from a native-text PDF without throwing', async () => {
    const pdf = buildTestPdf(['Big Bazaar', 'Milk 2pct Rs 89.00', 'Eggs Dozen Rs 78.00']);
    const text = await extractPdfText(toArrayBuffer(pdf));
    expect(text).not.toBeNull();
    expect(text).toContain('Big Bazaar');
    expect(text).toContain('89.00');
  });

  it('returns null, not a throw, for garbage bytes', async () => {
    const text = await extractPdfText(toArrayBuffer(Buffer.from('not a pdf')));
    expect(text).toBeNull();
  });
});

describe('looksLikeRealDocument', () => {
  it('is true for a real receipt-shaped native-text PDF (A22: the fast-path signal)', async () => {
    // Padded past the 200-char floor with realistic repeated line items,
    // same as a real multi-item receipt would produce.
    const pdf = buildTestPdf([
      'Big Bazaar Supermarket',
      '123 MG Road, Bengaluru',
      'Milk 2pct 1L  1 x 89.00  89.00',
      'Eggs Dozen  1 x 78.00  78.00',
      'Basmati Rice 5kg  1 x 450.00  450.00',
      'Bread Whole Wheat  1 x 45.00  45.00',
      'Total Rs 662.00',
    ]);
    const text = await extractPdfText(toArrayBuffer(pdf));
    expect(looksLikeRealDocument(text)).toBe(true);
  });

  it('is false for null (scanned/image-only PDF, extraction failed, or too short)', () => {
    expect(looksLikeRealDocument(null)).toBe(false);
  });

  it('is false for text with no currency markers', () => {
    expect(looksLikeRealDocument('a'.repeat(300))).toBe(false);
  });
});
