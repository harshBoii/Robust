import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
