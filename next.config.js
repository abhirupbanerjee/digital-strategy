// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,

  // Security & CORS headers
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      {
        key: 'Content-Security-Policy',
        // Kept pragmatic relaxations for Next/Vercel analytics compatibility.
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vitals.vercel-insights.com https://*.vercel-analytics.com",
          "connect-src 'self' https://api.openai.com https://*.supabase.co https://blob.vercel-storage.com https://vitals.vercel-insights.com https://*.vercel-analytics.com",
          'upgrade-insecure-requests',
        ].join('; '),
      },
    ];

    const dev = [
      // Helpful for local dev tools / API testing
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      ...common,
    ];

    const prod = [
      // Strong transport security in production
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ...common,
    ];

    return [
      {
        source: '/(.*)',
        headers: process.env.NODE_ENV === 'development' ? dev : prod,
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
