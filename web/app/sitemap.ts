import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const siteUrl = 'https://www.takeitesee.com';
const pageSize = 1000;
const maxServiceRows = 15000;

export const dynamic = 'force-dynamic';

const staticEntries: MetadataRoute.Sitemap = [
  { url: siteUrl, changeFrequency: 'daily', priority: 1 },
  { url: `${siteUrl}/explore`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${siteUrl}/categories`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${siteUrl}/professionals`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${siteUrl}/businesses`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${siteUrl}/help`, changeFrequency: 'monthly', priority: 0.4 },
  { url: `${siteUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  { url: `${siteUrl}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  { url: `${siteUrl}/cookies`, changeFrequency: 'yearly', priority: 0.3 },
];

function relation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

async function loadPublicServiceRows() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows: any[] = [];

  for (let start = 0; start < maxServiceRows; start += pageSize) {
    const { data, error } = await supabase
      .from('services')
      .select('id,provider_type,professional_id,business_id,professional_profiles(verified),businesses(verified)')
      .eq('status', 'active')
      .eq('active', true)
      .order('id')
      .range(start, Math.min(start + pageSize - 1, maxServiceRows - 1));

    if (error) return null;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await loadPublicServiceRows();
  if (!rows) return staticEntries;

  const serviceEntries: MetadataRoute.Sitemap = [];
  const professionalIds = new Set<string>();
  const businessIds = new Set<string>();

  for (const row of rows) {
    const provider = row.provider_type === 'business' ? relation(row.businesses) : relation(row.professional_profiles);
    if (!provider?.verified) continue;

    serviceEntries.push({
      url: `${siteUrl}/services/${encodeURIComponent(row.id)}`,
      changeFrequency: 'weekly',
      priority: 0.8,
    });

    if (row.provider_type === 'business' && row.business_id) businessIds.add(String(row.business_id));
    if (row.provider_type === 'professional' && row.professional_id) professionalIds.add(String(row.professional_id));
  }

  const professionalEntries: MetadataRoute.Sitemap = Array.from(professionalIds).map((id) => ({
    url: `${siteUrl}/professionals/${encodeURIComponent(id)}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));
  const businessEntries: MetadataRoute.Sitemap = Array.from(businessIds).map((id) => ({
    url: `${siteUrl}/businesses/${encodeURIComponent(id)}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticEntries, ...serviceEntries, ...professionalEntries, ...businessEntries];
}
