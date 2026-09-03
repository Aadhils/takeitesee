/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), payment=(self)' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
];

const apiHeaders = [
  { key: 'Cache-Control', value: 'no-store, max-age=0' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];

const privateWorkspaceHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];

const sensitiveAuthHeaders = [
  { key: 'Cache-Control', value: 'no-store, max-age=0' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];

const privateWorkspaceSources = [
  '/account/:path*',
  '/admin/:path*',
  '/super-admin/:path*',
  '/provider/:path*',
  '/bookings/:path*',
  '/confirmation/:path*',
  '/messages/:path*',
  '/notifications/:path*',
  '/requirements/:path*',
  '/reviews/:path*',
  '/login/:path*',
  '/signup/:path*',
  '/register/:path*',
  '/services/:serviceId/booking/:path*',
  '/services/:serviceId/review/:path*',
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: apiHeaders,
      },
      {
        source: '/forgot-password',
        headers: sensitiveAuthHeaders,
      },
      {
        source: '/reset-password',
        headers: sensitiveAuthHeaders,
      },
      ...privateWorkspaceSources.map((source) => ({
        source,
        headers: privateWorkspaceHeaders,
      })),
    ];
  },
};

module.exports = nextConfig;
