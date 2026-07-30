// Shared between client (validation before preprocessing) and server
// (defense-in-depth re-validation — never trust the client's extension
// claim alone). MIME reporting for HEIC/MHTML is inconsistent across
// browsers/OS, so extension is the primary signal, MIME secondary.

export const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'html', 'mhtml'] as const;

export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number];

export function extensionOf(filename: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match ? match[1].toLowerCase() : null;
}

export function isAcceptedExtension(ext: string | null): ext is AcceptedExtension {
  return ext !== null && (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);
}

// S-25: grouping (multi-image-as-one-order) is restricted to actual image
// extensions -- PDF/HTML/MHTML don't need grouping, and mixing formats into
// one multimodal call has no sane semantics.
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

export function isImageExtension(ext: string | null): boolean {
  return ext !== null && IMAGE_EXTENSIONS.has(ext);
}

const CONTENT_TYPES: Record<AcceptedExtension, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  html: 'text/html',
  mhtml: 'multipart/related',
};

export function contentTypeFor(ext: AcceptedExtension): string {
  return CONTENT_TYPES[ext];
}
