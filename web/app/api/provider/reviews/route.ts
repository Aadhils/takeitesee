import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

async function resolveProvider() {
  const session = await productionAuthProvider.requireProvider();
  const supabase = await createSupabaseServerClient();
  if (session.roles.includes('professional')) {
    const { data, error } = await supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Professional profile is required.');
    return { providerType: 'professional' as const, providerId: data.id as string, supabase };
  }
  const { data, error } = await supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Business profile is required.');
  return { providerType: 'business' as const, providerId: data.id as string, supabase };
}

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireProvider(request);
    const { providerType, providerId, supabase } = await resolveProvider();
    let query = supabase
      .from('reviews')
      .select('id,booking_id,service_id,rating,comment,status,provider_response,provider_responded_at,provider_response_updated_at,created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    query = providerType === 'professional' ? query.eq('professional_id', providerId) : query.eq('business_id', providerId);
    const { data: reviews, error: reviewError } = await query;
    if (reviewError) throw new Error(reviewError.message);

    const serviceIds = Array.from(new Set((reviews ?? []).map((review) => review.service_id as string).filter(Boolean)));
    const serviceNames = new Map<string, string>();
    if (serviceIds.length) {
      const { data: services, error: serviceError } = await supabase.from('services').select('id,name').in('id', serviceIds);
      if (serviceError) throw new Error(serviceError.message);
      for (const service of services ?? []) serviceNames.set(service.id as string, service.name as string);
    }

    const items = (reviews ?? []).map((review) => ({
      id: review.id as string,
      booking_id: review.booking_id as string,
      service_id: review.service_id as string,
      service_name: serviceNames.get(review.service_id as string) ?? 'Completed service',
      rating: Number(review.rating),
      comment: (review.comment as string | null) ?? '',
      provider_response: (review.provider_response as string | null) ?? '',
      provider_responded_at: (review.provider_responded_at as string | null) ?? null,
      provider_response_updated_at: (review.provider_response_updated_at as string | null) ?? null,
      created_at: review.created_at as string,
    }));

    const total = items.length;
    const average = total ? items.reduce((sum, item) => sum + item.rating, 0) / total : 0;
    const counts = [1, 2, 3, 4, 5].reduce<Record<number, number>>((acc, rating) => {
      acc[rating] = items.filter((item) => item.rating === rating).length;
      return acc;
    }, {});

    return NextResponse.json({
      reviews: items,
      summary: { total, average: Number(average.toFixed(1)), counts, five_star_share: total ? Math.round((counts[5] / total) * 100) : 0 },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider reviews.' }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireProvider(request);
    const input = await request.json() as { review_id?: string; response?: string };
    const reviewId = input.review_id?.trim() ?? '';
    const responseText = input.response?.trim() ?? '';
    if (!reviewId) return NextResponse.json({ error: 'Review is required.' }, { status: 400 });
    if (responseText.length < 3 || responseText.length > 1000) return NextResponse.json({ error: 'Response must be 3 to 1000 characters.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('respond_to_owned_review', { target_review_id: reviewId, response_text: responseText }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Review response could not be saved.');
    return NextResponse.json({ review: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save review response.' }, { status: 400 });
  }
}
