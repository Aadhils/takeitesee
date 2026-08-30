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
        '/confirmation',
        '/messages',
        '/notifications',
        '/requirements',
        '/reviews',
        '/services/*/booking',
        '/services/*/review',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
