/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.example.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
  output: process.env.NEXT_STATIC_EXPORT === '1' ? 'export' : 'standalone',
  trailingSlash: process.env.NEXT_STATIC_EXPORT === '1',
  async headers() {
    if (process.env.NEXT_STATIC_EXPORT === '1') {
      return [];
    }
    const isDev = process.env.NODE_ENV !== 'production';
    const corsOrigin = process.env.CORS_ORIGIN;
    if (!isDev && !corsOrigin) {
      throw new Error('CORS_ORIGIN is required in production. Configure it through environment variables.');
    }
    const csp = isDev
      ? "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' assets.example.com ui-avatars.com data:; connect-src 'self' ws:;"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' assets.example.com ui-avatars.com data:; connect-src 'self';";

    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: isDev ? '*' : corsOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization,X-CSRF-Token' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
