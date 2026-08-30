import type { MetadataRoute } from 'next';

const siteUrl = 'https://www.takeitesee.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/explore`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/categories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/professionals`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/businesses`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/help`, changeFrequency: 'monthly', priority: 0.4 },
  ];
}
