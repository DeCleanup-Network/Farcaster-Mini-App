import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Performance optimizations
  reactStrictMode: true,
  // SWC minification is enabled by default in Next.js 13+
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep errors and warnings
    } : false,
  },
  // Use webpack instead of Turbopack for better compatibility with RainbowKit/WalletConnect
  // Turbopack has issues with Node.js modules (pino/thread-stream) in client bundles
  // Note: Dev script uses --webpack flag to force webpack usage
  // Allow images from IPFS gateways (with fallbacks)
  // Note: We use unoptimized flag in Image components, so remotePatterns are less strict
  // Full URLs with ?filename= parameter will work with unoptimized flag
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        // Allow any path (for full URLs with ?filename= parameter)
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'dweb.link',
        pathname: '/ipfs/**',
      },
    ],
    // Allow unoptimized images from any domain (for full URLs)
    unoptimized: false, // Keep optimization enabled, but unoptimized flag in component overrides
  },
  webpack: (config, { isServer, webpack }) => {
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
      
      // Use IgnorePlugin to suppress warnings for optional React Native dependencies
      // MetaMask SDK includes React Native code that tries to import these, but they're not needed in web
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^@react-native-async-storage\/async-storage$/,
        })
      );
      
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
          // Note: X-Frame-Options is NOT set here because this is a Farcaster/Base Mini App
          // that MUST be embedded in an iframe. Instead, we use Content-Security-Policy
          // frame-ancestors to allow only specific Farcaster and Base app host domains.
          // Based on Base demos: https://github.com/base/demos/tree/master/mini-apps/templates
          // Security: We specify exact hosts instead of allowing embedding anywhere
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.neynar.com https://api.airstack.xyz https://gateway.pinata.cloud https://ipfs.io https://cloudflare-ipfs.com https://dweb.link https://*.dweb.link https://mainnet.base.org https://sepolia.base.org https://base-mainnet.g.alchemy.com https://base-sepolia.g.alchemy.com https://base-mainnet.infura.io https://base-sepolia.infura.io https://eth.merkle.io https://*.merkle.io https://*.walletconnect.com https://*.walletconnect.org https://*.metamask.io https://*.coinbase.com https://*.coinbasewallet.com https://*.rainbow.me https://*.uniswap.org https://static.cloudflareinsights.com https://euc.li https://*.euc.li https://eth.llamarpc.com wss: wss://*.walletconnect.com wss://*.walletconnect.org",
              "frame-src 'self'",
              "frame-ancestors https://warpcast.com https://client.warpcast.com https://farcaster.xyz https://client.farcaster.xyz https://app.farcaster.xyz https://www.farcaster.xyz https://www.warpcast.com https://app.warpcast.com https://base.org https://www.base.org https://base.dev https://www.base.dev https://app.base.org https://app.base.dev",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
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
      // Ensure OG images are served with proper content-type for Telegram and other platforms
      {
        source: '/og/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'image/png',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
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
