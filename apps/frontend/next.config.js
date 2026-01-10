const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@polymarket-bot/shared'],

  // Enable standalone output for Docker deployment (disabled on Windows due to symlink issues)
  // Uncomment for production Docker builds on Linux:
  // output: 'standalone',

  // Disable ESLint during build (run separately)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // External packages for server components (moved from experimental in 14.1+)
  serverExternalPackages: ['@polymarket-bot/shared'],

  // Environment variables that should be available at runtime
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Enable gzip compression
  compress: true,

  // Configure asset prefix for CDN if needed
  // assetPrefix: process.env.ASSET_PREFIX || '',

  // Image optimization configuration
  images: {
    // Disable image optimization in standalone mode if not using Next.js image optimization
    unoptimized: process.env.NODE_ENV === 'production',
    // Add allowed domains for external images if needed
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.polymarket.com',
      },
    ],
  },
};

module.exports = withNextIntl(nextConfig);
