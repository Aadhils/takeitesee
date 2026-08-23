import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import RealBookingReview from '../../../../components/booking/RealBookingReview';
import { discoveryCategories } from '../../../../data/discovery-fixtures';

const text = (value: string) => ({ default_locale: 'en' as const, values: { en: value } });

export default async function BookingReviewPage({ params, searchParams }: { params: Promise<{ serviceId: string }>; searchParams: Promise<{ date?: string; dateLabel?: string; time?: string }> }) {
  const [{ serviceId }, query] = await Promise.all([params, searchParams]);
  if (!query.date || !query.time) notFound();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) notFound();

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: row, error } = await supabase
    .from('services')
    .select('id,provider_type,professional_id,business_id,name,description,location,duration_minutes,base_price,currency,category,status,active,professional_profiles(headline,service_area,verified),businesses(name,location,verified)')
    .eq('id', serviceId)
    .eq('status', 'active')
    .eq('active', true)
    .maybeSingle();

  if (error || !row) notFound();

  const provider: any = row.provider_type === 'business' ? row.businesses : row.professional_profiles;
  if (!provider?.verified) notFound();

  const categorySlug = String(row.category || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const category = discoveryCategories.find((item) => item.slug === categorySlug);
  const providerName = row.provider_type === 'business' ? provider.name : provider.headline;
  const providerLocation = row.provider_type === 'business' ? provider.location : provider.service_area;

  const service: any = {
    id: row.id,
    category_id: category?.id ?? categorySlug,
    service_name: text(row.name),
    description: text(row.description || ''),
    pricing: {
      base_price: { amount: Math.round(Number(row.base_price || 0) * 100), currency: row.currency || 'INR' },
      pricing_model: 'fixed',
    },
    provider_name: providerName || 'Provider',
    provider_type: row.provider_type,
    provider_id: row.business_id || row.professional_id || row.id,
    location: row.location || providerLocation || '',
    availability: 'Check availability',
    rating: 0,
    review_count: 0,
    verified: true,
    duration_minutes: row.duration_minutes || 0,
    service_area: providerLocation || row.location || '',
    long_description: row.description || '',
    highlights: [],
    inclusions: [],
    policy: 'Cancellation and rescheduling terms will be confirmed during booking before final confirmation.',
  };

  return <RealBookingReview service={service} date={query.date} dateLabel={query.dateLabel} time={query.time} />;
}
