import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();

    let providerType: 'professional' | 'business';
    let providerId: string;

    if (session.roles.includes('professional')) {
      const { data, error } = await supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Professional profile is required.');
      providerType = 'professional';
      providerId = data.id as string;
    } else {
      const { data, error } = await supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Business profile is required.');
      providerType = 'business';
      providerId = data.id as string;
    }

    let query = supabase.from('reviews').select('id,booking_id,service_id,rating,comment,status,created_at').eq('status', 'published').order('created_at', { ascending: false });
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
      summary: {
        total,
        average: Number(average.toFixed(1)),
        counts,
        five_star_share: total ? Math.round((counts[5] / total) * 100) : 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider reviews.' }, { status: 401 });
  }
}
