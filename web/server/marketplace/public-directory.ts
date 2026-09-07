import 'server-only';
import { createClient } from '@supabase/supabase-js';

export type PublicDirectoryEntry = {
  id: string;
  name: string;
  description: string;
  location: string;
  service_count: number;
  categories: string[];
  starting_price: number | null;
  currency: string;
  role_count?: number;
  talents?: string[];
  career_published?: boolean;
};

export type PublicCategoryEntry = {
  name: string;
  slug: string;
  service_count: number;
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

function finalize(entries: Map<string, PublicDirectoryEntry & { category_set: Set<string> }>) {
  return Array.from(entries.values())
    .map(({ category_set, ...entry }) => ({ ...entry, categories: Array.from(category_set).sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function hasMarketplaceDisclosure(provider: any) {
  return Boolean(
    provider?.legal_name?.trim()
    && provider?.principal_address?.trim()
    && provider?.public_contact_email?.trim()
    && provider?.public_contact_phone?.trim()
    && provider?.grievance_officer_name?.trim()
    && provider?.grievance_officer_designation?.trim()
    && provider?.grievance_email?.trim()
    && provider?.grievance_phone?.trim(),
  );
}

function hasProfessionalBasics(provider: any) {
  return String(provider?.headline || '').trim().length >= 2
    && String(provider?.description || '').trim().length >= 20
    && String(provider?.service_area || '').trim().length >= 2;
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

async function loadPublicCategoryRows(supabase: any) {
  return loadPagedRows((start, end) => supabase
    .from('services')
    .select('id,category,provider_type,professional_profiles(verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone),businesses(verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone)')
    .eq('status', 'active')
    .eq('active', true)
    .order('id')
    .range(start, end));
}

async function loadPublicBusinessRows(supabase: any) {
  return loadPagedRows((start, end) => supabase
    .from('services')
    .select('id,base_price,currency,category,business_id,businesses(id,name,description,location,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone)')
    .eq('provider_type', 'business')
    .eq('status', 'active')
    .eq('active', true)
    .order('id')
    .range(start, end));
}

export async function loadPublicCategories(): Promise<PublicCategoryEntry[] | null> {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const rows = await loadPublicCategoryRows(supabase);
  if (!rows) return null;

  const categories = new Map<string, PublicCategoryEntry>();
  for (const row of rows) {
    const typedRow = row as any;
    const provider = typedRow.provider_type === 'business'
      ? relation(typedRow.businesses)
      : relation(typedRow.professional_profiles);
    const name = String(typedRow.category || '').trim();
    if (!provider?.verified || !hasMarketplaceDisclosure(provider) || !name) continue;

    const slug = categorySlug(name);
    if (!slug) continue;
    const current = categories.get(slug) ?? { name, slug, service_count: 0 };
    current.service_count += 1;
    categories.set(slug, current);
  }

  return Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadPublicBusinesses(): Promise<PublicDirectoryEntry[] | null> {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const rows = await loadPublicBusinessRows(supabase);
  if (!rows) return null;

  const entries = new Map<string, PublicDirectoryEntry & { category_set: Set<string> }>();
  for (const row of rows) {
    const business: any = relation((row as any).businesses);
    if (!business?.verified || !business.id || !hasMarketplaceDisclosure(business)) continue;

    const id = String(business.id);
    const price = Number((row as any).base_price || 0);
    const existing = entries.get(id) ?? {
      id,
      name: business.name || 'Verified business',
      description: business.description || '',
      location: business.location || '',
      service_count: 0,
      categories: [],
      category_set: new Set<string>(),
      starting_price: null,
      currency: (row as any).currency || 'INR',
    };

    existing.service_count += 1;
    if ((row as any).category) existing.category_set.add(String((row as any).category));
    if (price > 0 && (existing.starting_price === null || price < existing.starting_price)) {
      existing.starting_price = price;
      existing.currency = (row as any).currency || existing.currency;
    }
    entries.set(id, existing);
  }

  return finalize(entries);
}

export async function loadPublicProfessionals(): Promise<PublicDirectoryEntry[] | null> {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const [profiles, services, roles, careers] = await Promise.all([
    loadPagedRows((start, end) => supabase
      .from('professional_profiles')
      .select('id,headline,description,service_area,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone')
      .eq('verified', true)
      .order('id')
      .range(start, end)),
    loadPagedRows((start, end) => supabase
      .from('services')
      .select('id,base_price,currency,category,professional_id')
      .eq('provider_type', 'professional')
      .eq('status', 'active')
      .eq('active', true)
      .order('id')
      .range(start, end)),
    loadPagedRows((start, end) => supabase
      .from('professional_roles')
      .select('professional_id,title,display_order')
      .eq('active', true)
      .order('professional_id')
      .order('display_order', { ascending: true })
      .range(start, end)),
    loadPagedRows((start, end) => supabase
      .from('professional_career_profiles')
      .select('professional_id,career_headline,public_resume_enabled')
      .eq('public_resume_enabled', true)
      .order('professional_id')
      .range(start, end)),
  ]);

  if (!profiles || !services || !roles || !careers) return null;

  const serviceRows = new Map<string, any[]>();
  for (const row of services) {
    const id = String((row as any).professional_id || '');
    if (!id) continue;
    const values = serviceRows.get(id) ?? [];
    values.push(row);
    serviceRows.set(id, values);
  }

  const roleRows = new Map<string, any[]>();
  for (const row of roles) {
    const id = String((row as any).professional_id || '');
    if (!id) continue;
    const values = roleRows.get(id) ?? [];
    values.push(row);
    roleRows.set(id, values);
  }

  const careerRows = new Map<string, any>();
  for (const row of careers) {
    const id = String((row as any).professional_id || '');
    if (id) careerRows.set(id, row);
  }

  const entries: PublicDirectoryEntry[] = [];
  for (const provider of profiles) {
    const professional: any = provider;
    if (!professional?.id || !professional.verified || !hasMarketplaceDisclosure(professional) || !hasProfessionalBasics(professional)) continue;

    const id = String(professional.id);
    const professionalServices = serviceRows.get(id) ?? [];
    const professionalRoles = roleRows.get(id) ?? [];
    const career = careerRows.get(id);
    if (!professionalServices.length && !professionalRoles.length && !career) continue;

    const categories = new Set<string>();
    let startingPrice: number | null = null;
    let currency = 'INR';
    for (const service of professionalServices) {
      const price = Number(service.base_price || 0);
      if (service.category) categories.add(String(service.category));
      if (price > 0 && (startingPrice === null || price < startingPrice)) {
        startingPrice = price;
        currency = service.currency || currency;
      }
    }

    const talents = Array.from(new Set(
      professionalRoles.map((role) => String(role.title || '').trim()).filter(Boolean),
    ));

    entries.push({
      id,
      name: professional.headline || 'Verified professional',
      description: professional.description || '',
      location: professional.service_area || '',
      service_count: professionalServices.length,
      categories: Array.from(categories).sort(),
      starting_price: startingPrice,
      currency,
      role_count: professionalRoles.length,
      talents,
      career_published: Boolean(career),
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
