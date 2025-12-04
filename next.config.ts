import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Set workspace root to silence lockfile warning
  // Explicitly set to project root (parent directory of next.config.ts)
  turbopack: {
    root: __dirname || process.cwd(),
  },
  // Force clean build (removed recyclables route)
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
      // Allow Next.js dev tools to access stack frames
      {
        source: '/nextjs_original-stack-frames',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
