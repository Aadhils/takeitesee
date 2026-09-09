import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { hasMarketplaceDisclosure } from './public-directory';

export type CanonicalPublicCategoryEntry = {
  code: string;
  name: string;
  slug: string;
  group_name: string;
  service_count: number | null;
};

const directoryPageSize = 1000;
const maxDirectoryRows = 15000;

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function relation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function categorySlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function loadPagedRows(loadPage: (start: number, end: number) => PromiseLike<any>) {
  const rows: any[] = [];

  for (let start = 0; start < maxDirectoryRows; start += directoryPageSize) {
    const end = Math.min(start + directoryPageSize - 1, maxDirectoryRows - 1);
    const { data, error } = await loadPage(start, end);
    if (error) return null;
    rows.push(...(data ?? []));
    if (!data || data.length < directoryPageSize) break;
  }

  return rows;
}

async function loadPublicServiceRows(supabase: any) {
  return loadPagedRows((start, end) => supabase
    .from('services')
    .select('id,category,provider_type,professional_profiles(verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone),businesses(verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone)')
    .eq('status', 'active')
    .eq('active', true)
    .order('id')
    .range(start, end));
}

export async function loadCanonicalPublicCategories(): Promise<CanonicalPublicCategoryEntry[] | null> {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const [{ data: taxonomyRows, error: taxonomyError }, serviceRows] = await Promise.all([
    supabase
      .from('marketplace_search_taxonomy_public')
      .select('category_code,category_name,group_name,group_sort_order,category_sort_order')
      .order('group_sort_order', { ascending: true })
      .order('group_name', { ascending: true })
      .order('category_sort_order', { ascending: true })
      .order('category_name', { ascending: true }),
    loadPublicServiceRows(supabase),
  ]);

  if (taxonomyError || !taxonomyRows) return null;

  const liveCounts = new Map<string, number>();
  if (serviceRows) {
    for (const row of serviceRows) {
      const typedRow = row as any;
      const provider = typedRow.provider_type === 'business'
        ? relation(typedRow.businesses)
        : relation(typedRow.professional_profiles);
      const name = String(typedRow.category || '').trim();
      if (!provider?.verified || !hasMarketplaceDisclosure(provider) || !name) continue;
      const slug = categorySlug(name);
      if (!slug) continue;
      liveCounts.set(slug, (liveCounts.get(slug) ?? 0) + 1);
    }
  }

  return taxonomyRows
    .map((row: any) => {
      const name = String(row.category_name || '').trim();
      const slug = categorySlug(name);
      return {
        code: String(row.category_code || '').trim(),
        name,
        slug,
        group_name: String(row.group_name || '').trim(),
        service_count: serviceRows ? (liveCounts.get(slug) ?? 0) : null,
      } satisfies CanonicalPublicCategoryEntry;
    })
    .filter((category) => category.code && category.name && category.slug && category.group_name);
}
