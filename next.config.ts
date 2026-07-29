import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default ~1MB is too small for uncompressed PDFs/HTML captures
    // (images are already downscaled to <=1.5MB client-side by S-05).
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
