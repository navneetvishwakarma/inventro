import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) loads a worker script from disk at runtime —
  // Turbopack's default bundling doesn't resolve that asset correctly
  // ("Cannot find module '.next/server/chunks/ssr/pdf.worker.mjs'").
  // Found via full E2E testing (the fast-path silently fell back to
  // multimodal on every PDF, not just scanned ones), not by build success.
  // @napi-rs/canvas (S-54) is pdf-parse's native canvas dependency -- also
  // needs to stay external, not bundled, or its native binary fails to
  // load under Vercel's serverless packaging ("DOMMatrix is not defined"),
  // per pdf-parse's own Next.js/Vercel troubleshooting doc.
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
  // e2e/playwright.config.ts's baseURL is 127.0.0.1, not localhost -- Next's
  // dev-mode HMR websocket rejects that as a cross-origin request by
  // default, which was silently resetting client-side wizard state
  // (app/onboarding/wizard.tsx's step) mid-test on every HMR reconnect
  // attempt. Dev-only; has no effect on a production build.
  allowedDevOrigins: ['127.0.0.1'],
  experimental: {
    // Default ~1MB is too small for uncompressed PDFs/HTML captures
    // (images are already downscaled to <=1.5MB client-side by S-05).
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
