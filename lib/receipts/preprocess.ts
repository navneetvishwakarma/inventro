'use client';

import { extensionOf } from '@/lib/receipts/formats';

const MAX_LONG_EDGE = 2000;
const JPEG_QUALITY = 0.85;

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const HEIC_EXTENSIONS = new Set(['heic', 'heif']);

// PDF/HTML/MHTML pass through untouched — nothing to downscale, and no
// canvas/HEIC decoding applies to non-image formats.
export async function preprocessFile(file: File): Promise<File> {
  const ext = extensionOf(file.name);
  if (!ext) return file;

  if (HEIC_EXTENSIONS.has(ext)) {
    const heic2any = (await import('heic2any')).default;
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: JPEG_QUALITY });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return downscaleImage(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    return downscaleImage(file);
  }

  return file;
}

async function downscaleImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}
