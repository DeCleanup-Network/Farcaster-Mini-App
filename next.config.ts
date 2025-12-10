import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Use webpack instead of Turbopack for better compatibility with RainbowKit/WalletConnect
  // Turbopack has issues with Node.js modules (pino/thread-stream) in client bundles
  // Set workspace root to silence lockfile warning
  // Explicitly set to project root (current working directory)
  turbopack: {
    root: process.cwd(),
  },
  // Allow images from Pinata IPFS gateway
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        pathname: '/ipfs/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js-only modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
      
      // Ignore optional dependencies that aren't needed in browser
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
      };
      
      // Ignore test files and other non-code files from problematic packages
      config.module = config.module || {};
      config.module.rules = config.module.rules || [];
      config.module.rules.push({
        test: /node_modules[\\/](pino|thread-stream)[\\/]/,
        use: 'ignore-loader',
      });
    }
    return config;
  },
  // Redirect from old domain to new domain (if on old domain)
  // Since both domains use the same Vercel project, we use request headers to detect domain
  // The manifest is handled by app/.well-known/farcaster.json/route.ts which serves different manifests per domain
  async redirects() {
    // Note: Next.js redirects run at build time, so we can't use request headers here
    // Instead, we'll use middleware or handle redirects in the app
    // For now, we'll let the API route handle manifest serving
    // and implement redirects via middleware or client-side if needed
    return []
  },
  // Ensure .well-known directory is served
  async headers() {
    return [
      // Security headers for all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self)',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
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
