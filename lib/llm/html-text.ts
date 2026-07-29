// Extends the PDF cost fast path's reasoning to HTML/MHTML captures (order
// confirmation pages): already textual, so send text-only rather than
// rasterizing + multimodal. A lightweight regex strip is enough here — the
// LLM extraction step is already tolerant of imperfect text, and a full
// HTML parser dependency isn't warranted just to strip tags.
export function extractHtmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
