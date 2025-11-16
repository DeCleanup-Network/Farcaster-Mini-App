import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Set workspace root to silence lockfile warning
  turbopack: {
    root: process.cwd(),
  },
  // Ensure .well-known directory is served
  async headers() {
    return [
      {
        source: '/.well-known/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
