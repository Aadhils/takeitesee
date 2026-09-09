import type { MetadataRoute } from 'next';

const siteUrl = 'https://www.takeitesee.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/account',
        '/admin',
        '/super-admin',
        '/provider',
        '/bookings',
        '/orders',
        '/confirmation',
        '/messages',
        '/notifications',
        '/requirements',
        '/reviews',
        '/saved-products',
        '/saved-services',
        '/login',
        '/signup',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/auth/',
        '/services/*/booking',
        '/services/*/review',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
