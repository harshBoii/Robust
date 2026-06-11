import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/rival-analysis/run': [
      'node_modules/@sparticuz/chromium/**/*',
      'node_modules/playwright-core/**/*',
      'node_modules/playwright/**/*',
    ],
    '/api/brands/[brandId]/dna/visual/generate': [
      'node_modules/@sparticuz/chromium/**/*',
      'node_modules/playwright-core/**/*',
      'node_modules/playwright/**/*',
    ],
    '/api/brands/[brandId]/dna/communication/analyze-blogs': [
      'node_modules/@sparticuz/chromium/**/*',
      'node_modules/playwright-core/**/*',
      'node_modules/playwright/**/*',
    ],
  },
  images: {
    remotePatterns: [
      // Meta/Facebook CDN thumbnails (hostnames vary by region)
      { protocol: "https", hostname: "scontent.*.fna.fbcdn.net" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "*.fna.fbcdn.net" },
    ],
  },
};

export default nextConfig;
