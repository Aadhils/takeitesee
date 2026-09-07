import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { hasMarketplaceDisclosure, loadPublicProfessionals } from '../server/marketplace/public-directory';

const siteUrl = 'https://www.takeitesee.com';
const pageSize = 1000;
const maxServiceRows = 15000;
const maxProviderHandleRows = 15000;

export const dynamic = 'force-dynamic';

const staticEntries: MetadataRoute.Sitemap = [
  { url: siteUrl, changeFrequency: 'daily', priority: 1 },
  { url: `${siteUrl}/explore`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${siteUrl}/jobs`, changeFrequency: 'daily', priority: 0.9 },
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

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadPublicServiceRows() {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const rows: any[] = [];

  for (let start = 0; start < maxServiceRows; start += pageSize) {
    const { data, error } = await supabase
      .from('services')
      .select('id,provider_type,professional_id,business_id,professional_profiles(verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone),businesses(verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone)')
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

async function loadCurrentProviderHandles() {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const rows: any[] = [];

  for (let start = 0; start < maxProviderHandleRows; start += pageSize) {
    const { data, error } = await supabase
      .from('identity_handles')
      .select('handle,identity_type,identity_id')
      .eq('is_current', true)
      .in('identity_type', ['professional', 'business'])
      .order('handle')
      .range(start, Math.min(start + pageSize - 1, maxProviderHandleRows - 1));

    if (error) return null;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [rows, publicProfessionals, providerHandles] = await Promise.all([
    loadPublicServiceRows(),
    loadPublicProfessionals(),
    loadCurrentProviderHandles(),
  ]);
  if (!rows) return staticEntries;

  const serviceEntries: MetadataRoute.Sitemap = [];
  const businessIds = new Set<string>();

  for (const row of rows) {
    const provider = row.provider_type === 'business' ? relation(row.businesses) : relation(row.professional_profiles);
    if (!provider?.verified || !hasMarketplaceDisclosure(provider)) continue;

    serviceEntries.push({
      url: `${siteUrl}/services/${encodeURIComponent(row.id)}`,
      changeFrequency: 'weekly',
      priority: 0.8,
    });

    if (row.provider_type === 'business' && row.business_id) businessIds.add(String(row.business_id));
  }

  const handleByIdentity = new Map<string, string>();
  for (const row of providerHandles ?? []) {
    if (!row?.handle || !row?.identity_type || !row?.identity_id) continue;
    handleByIdentity.set(`${row.identity_type}:${row.identity_id}`, String(row.handle));
  }

  const professionalEntries: MetadataRoute.Sitemap = (publicProfessionals ?? []).map((professional) => {
    const handle = handleByIdentity.get(`professional:${professional.id}`);
    return {
      url: handle
        ? `${siteUrl}/@${encodeURIComponent(handle)}`
        : `${siteUrl}/professionals/${encodeURIComponent(professional.id)}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    };
  });
  const businessEntries: MetadataRoute.Sitemap = Array.from(businessIds).map((id) => {
    const handle = handleByIdentity.get(`business:${id}`);
    return {
      url: handle
        ? `${siteUrl}/@${encodeURIComponent(handle)}`
        : `${siteUrl}/businesses/${encodeURIComponent(id)}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    };
  });

  return [...staticEntries, ...serviceEntries, ...professionalEntries, ...businessEntries];
}
