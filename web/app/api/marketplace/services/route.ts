import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hasMarketplaceDisclosure } from '../../../../server/marketplace/public-directory';

export const dynamic = 'force-dynamic';

const pageSize = 1000;
const maxServiceRows = 15000;
const reviewServiceChunkSize = 200;
const maxReviewRowsPerChunk = 15000;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Marketplace database is not configured' }, { status: 500 });

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows: any[] = [];

  for (let start = 0; start < maxServiceRows; start += pageSize) {
    const { data, error } = await supabase
      .from('services')
      .select('id,provider_type,professional_id,business_id,name,description,location,duration_minutes,base_price,currency,category,status,active,updated_at,professional_profiles(headline,service_area,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone),businesses(name,location,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone)')
      .eq('active', true)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(start, Math.min(start + pageSize - 1, maxServiceRows - 1));

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const ids = rows.map((row: any) => row.id);
  const reviewRows: any[] = [];

  for (let chunkStart = 0; chunkStart < ids.length; chunkStart += reviewServiceChunkSize) {
    const serviceIds = ids.slice(chunkStart, chunkStart + reviewServiceChunkSize);
    for (let start = 0; start < maxReviewRowsPerChunk; start += pageSize) {
      const { data, error } = await supabase
        .from('reviews')
        .select('id,service_id,rating,status')
        .in('service_id', serviceIds)
        .eq('status', 'published')
        .order('id', { ascending: true })
        .range(start, Math.min(start + pageSize - 1, maxReviewRowsPerChunk - 1));

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      reviewRows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
  }

  const reviews = new Map<string, number[]>();
  for (const review of reviewRows) reviews.set(review.service_id, [...(reviews.get(review.service_id) ?? []), Number(review.rating)]);

  const services = rows.filter((row: any) => {
    const provider = row.provider_type === 'business' ? row.businesses : row.professional_profiles;
    const providerId = row.provider_type === 'business' ? row.business_id : row.professional_id;
    return provider?.verified === true && hasMarketplaceDisclosure(provider) && Boolean(providerId);
  }).map((row: any) => {
    const provider = row.provider_type === 'business' ? row.businesses : row.professional_profiles;
    const providerId = row.provider_type === 'business' ? row.business_id : row.professional_id;
    const ratings = reviews.get(row.id) ?? [];
    const rating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const category = row.category || 'Other';
    return {
      id: row.id,
      service_name: { en: row.name },
      description: { en: row.description || '' },
      provider_name: row.provider_type === 'business' ? (provider?.name || 'Business provider') : (provider?.headline || 'Professional provider'),
      provider_type: row.provider_type,
      provider_id: providerId,
      location: row.location || provider?.location || provider?.service_area || '',
      service_area: provider?.service_area || provider?.location || row.location || '',
      category_id: category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category_slug: category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      pricing: { base_price: { amount: Math.round(Number(row.base_price || 0) * 100), currency: row.currency || 'INR' } },
      duration_minutes: row.duration_minutes,
      rating,
      review_count: ratings.length,
      availability: 'Check availability',
      verified: true
    };
  });

  return NextResponse.json({ services }, { headers: { 'Cache-Control': 'no-store' } });
}
