import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) loads a worker script from disk at runtime —
  // Turbopack's default bundling doesn't resolve that asset correctly
  // ("Cannot find module '.next/server/chunks/ssr/pdf.worker.mjs'").
  // Found via full E2E testing (the fast-path silently fell back to
  // multimodal on every PDF, not just scanned ones), not by build success.
  serverExternalPackages: ['pdf-parse'],
  experimental: {
    // Default ~1MB is too small for uncompressed PDFs/HTML captures
    // (images are already downscaled to <=1.5MB client-side by S-05).
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
