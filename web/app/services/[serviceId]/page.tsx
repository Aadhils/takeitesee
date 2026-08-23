import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ServiceDetail } from '../../../components/detail/DetailPresentation';
import { discoveryCategories } from '../../../data/discovery-fixtures';

const text = (value: string) => ({ default_locale: 'en' as const, values: { en: value } });

export default async function ServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) notFound();

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: row, error } = await supabase
    .from('services')
    .select('id,provider_type,professional_id,business_id,name,description,location,duration_minutes,base_price,currency,category,status,active,professional_profiles(headline,description,service_area,verified),businesses(name,description,location,verified)')
    .eq('id', serviceId)
    .eq('status', 'active')
    .eq('active', true)
    .maybeSingle();

  if (error || !row) notFound();

  const provider: any = row.provider_type === 'business' ? row.businesses : row.professional_profiles;
  if (!provider?.verified) notFound();

  const { data: reviewRows } = await supabase
    .from('reviews')
    .select('id,rating,comment,created_at,customer_id,users(name)')
    .eq('service_id', serviceId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  const reviews = (reviewRows ?? []).map((review: any) => ({
    id: review.id,
    reviewer_name: review.users?.name || 'Customer',
    rating: review.rating,
    comment: review.comment || '',
    date: new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    verified_booking: true,
  }));
  const rating = reviews.length ? reviews.reduce((sum: number, review: any) => sum + Number(review.rating), 0) / reviews.length : 0;

  const categorySlug = String(row.category || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const category = discoveryCategories.find((item) => item.slug === categorySlug);
  const providerName = row.provider_type === 'business' ? provider.name : provider.headline;
  const providerLocation = row.provider_type === 'business' ? provider.location : provider.service_area;

  const service: any = {
    id: row.id,
    category_id: category?.id ?? categorySlug,
    service_name: text(row.name),
    description: text(row.description || ''),
    pricing: { base_price: { amount: Math.round(Number(row.base_price || 0) * 100), currency: row.currency || 'INR' }, pricing_model: 'fixed' },
    provider_name: providerName || 'Provider',
    provider_type: row.provider_type,
    provider_id: row.business_id || row.professional_id || row.id,
    location: row.location || providerLocation || '',
    availability: 'Available today',
    rating,
    review_count: reviews.length,
    verified: true,
    duration_minutes: row.duration_minutes || 0,
    service_area: providerLocation || row.location || '',
    long_description: row.description || '',
    highlights: [],
    inclusions: [],
    policy: 'Cancellation and rescheduling terms are confirmed during booking.',
  };

  return <ServiceDetail service={service} reviews={reviews} />;
}
