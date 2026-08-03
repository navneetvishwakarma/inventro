import 'server-only';
import { PDFParse } from 'pdf-parse';
import { CanvasFactory } from 'pdf-parse/worker';

const CURRENCY_MARKERS = /₹|Rs\.?\s|INR|\$/;
const DIGIT_HEAVY_LINE = /\d[.,]?\d{2}\b.*\d[.,]?\d{2}\b/; // at least two price-like numbers on one line

// S-54: pdfjs-dist (pdf-parse's internal engine) references the browser-only
// DOMMatrix global for text-position transforms. Without an explicit
// CanvasFactory it silently assumes one is available -- fine on most
// platforms, but fails ("DOMMatrix is not defined") specifically under
// Vercel's serverless function bundling, per pdf-parse's own documented
// Next.js/Vercel troubleshooting guidance. Passing @napi-rs/canvas's
// factory explicitly removes the dependency on that ambient global.
export async function extractPdfText(bytes: ArrayBuffer): Promise<string | null> {
  const parser = new PDFParse({ data: Buffer.from(bytes), CanvasFactory });
  try {
    const result = await parser.getText();
    return result.text;
  } catch (err) {
    console.error('[extractPdfText] failed:', err);
    return null;
  } finally {
    await parser.destroy();
  }
}

// Cost fast path (working spec Sec7): a native PDF whose extracted text
// looks like a real document is cheap to send text-only; a scanned/image-only
// PDF yields near-empty or garbage text and must be rasterized + sent
// multimodal instead.
export function looksLikeRealDocument(text: string | null): text is string {
  if (!text || text.length <= 200) return false;
  if (!CURRENCY_MARKERS.test(text)) return false;
  const digitHeavyLines = text.split('\n').filter((line) => DIGIT_HEAVY_LINE.test(line));
  return digitHeavyLines.length > 0;
}
