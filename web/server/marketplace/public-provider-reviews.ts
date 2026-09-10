import { createClient } from '@supabase/supabase-js';

export type PublicProviderReview = {
  id: string;
  service_id: string;
  service_name: string;
  rating: number;
  comment: string;
  provider_response: string;
  provider_responded_at: string | null;
  created_at: string;
};

export type PublicProviderReviewTrust = {
  total: number;
  reviews: PublicProviderReview[];
};

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function loadPublicProviderReviewTrust(
  providerType: 'professional' | 'business',
  providerId: string,
): Promise<PublicProviderReviewTrust> {
  const supabase = publicSupabase();
  if (!supabase) return { total: 0, reviews: [] };

  let query = supabase
    .from('reviews')
    .select('id,service_id,rating,comment,provider_response,provider_responded_at,created_at', { count: 'exact' })
    .eq('status', 'published')
    .eq('provider_type', providerType)
    .order('created_at', { ascending: false })
    .limit(6);

  query = providerType === 'professional'
    ? query.eq('professional_id', providerId)
    : query.eq('business_id', providerId);

  const { data, error, count } = await query;
  if (error) return { total: 0, reviews: [] };

  const rows = data ?? [];
  const serviceIds = Array.from(new Set(rows.map((row) => String(row.service_id || '')).filter(Boolean)));
  const serviceNames = new Map<string, string>();

  if (serviceIds.length) {
    const { data: services } = await supabase
      .from('services')
      .select('id,name')
      .in('id', serviceIds)
      .eq('status', 'active')
      .eq('active', true);
    for (const service of services ?? []) serviceNames.set(String(service.id), String(service.name || ''));
  }

  return {
    total: count ?? rows.length,
    reviews: rows.map((row) => ({
      id: String(row.id),
      service_id: String(row.service_id || ''),
      service_name: serviceNames.get(String(row.service_id || '')) || 'Completed service',
      rating: Number(row.rating),
      comment: String(row.comment || ''),
      provider_response: String(row.provider_response || ''),
      provider_responded_at: row.provider_responded_at ? String(row.provider_responded_at) : null,
      created_at: String(row.created_at),
    })),
  };
}
