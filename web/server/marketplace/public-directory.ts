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
};

export type PublicCategoryEntry = {
  name: string;
  slug: string;
  service_count: number;
};

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

export async function loadPublicCategories(): Promise<PublicCategoryEntry[] | null> {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const { data: rows, error } = await supabase
    .from('services')
    .select('category,provider_type,professional_profiles(verified),businesses(verified)')
    .eq('status', 'active')
    .eq('active', true)
    .order('category');

  if (error) return null;

  const categories = new Map<string, PublicCategoryEntry>();
  for (const row of rows ?? []) {
    const typedRow = row as any;
    const provider = typedRow.provider_type === 'business'
      ? relation(typedRow.businesses)
      : relation(typedRow.professional_profiles);
    const name = String(typedRow.category || '').trim();
    if (!provider?.verified || !name) continue;

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

  const { data: rows, error } = await supabase
    .from('services')
    .select('id,base_price,currency,category,business_id,businesses(id,name,description,location,verified)')
    .eq('provider_type', 'business')
    .eq('status', 'active')
    .eq('active', true)
    .order('id');

  if (error) return null;

  const entries = new Map<string, PublicDirectoryEntry & { category_set: Set<string> }>();
  for (const row of rows ?? []) {
    const business: any = relation((row as any).businesses);
    if (!business?.verified || !business.id) continue;

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

  const { data: rows, error } = await supabase
    .from('services')
    .select('id,base_price,currency,category,professional_id,professional_profiles(id,headline,description,service_area,verified)')
    .eq('provider_type', 'professional')
    .eq('status', 'active')
    .eq('active', true)
    .order('id');

  if (error) return null;

  const entries = new Map<string, PublicDirectoryEntry & { category_set: Set<string> }>();
  for (const row of rows ?? []) {
    const professional: any = relation((row as any).professional_profiles);
    if (!professional?.verified || !professional.id) continue;

    const id = String(professional.id);
    const price = Number((row as any).base_price || 0);
    const existing = entries.get(id) ?? {
      id,
      name: professional.headline || 'Verified professional',
      description: professional.description || '',
      location: professional.service_area || '',
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
