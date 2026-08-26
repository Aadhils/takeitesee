'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function nullableValue(formData: FormData, key: string) {
  const current = value(formData, key);
  return current || null;
}

export async function saveScopedServiceSettings(formData: FormData) {
  await productionAuthProvider.requireAdmin();

  const serviceId = value(formData, 'service_id');
  const applicationId = value(formData, 'application_id');
  const locationId = nullableValue(formData, 'location_id');
  const categoryId = nullableValue(formData, 'category_id');
  const threshold = Number.parseInt(value(formData, 'low_rating_threshold') || '3', 10);
  const defaultReviewQueue = value(formData, 'default_review_queue') || 'provider_review';

  if (!serviceId || !applicationId || !Number.isInteger(threshold) || threshold < 1 || threshold > 5) {
    redirect('/admin/settings?error=invalid_input');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('update_scoped_service_settings', {
    p_service_id: serviceId,
    p_application_id: applicationId,
    p_location_id: locationId,
    p_category_id: categoryId,
    p_show_new_services_after_review: formData.get('show_new_services_after_review') === 'on',
    p_display_verification_badges: formData.get('display_verification_badges') === 'on',
    p_default_review_queue: defaultReviewQueue,
    p_require_provider_response: formData.get('require_provider_response') === 'on',
    p_flag_low_ratings: formData.get('flag_low_ratings') === 'on',
    p_low_rating_threshold: threshold,
  });

  if (error) {
    redirect(error.code === '42501' ? '/admin/settings?error=manage_required' : '/admin/settings?error=save_failed');
  }

  revalidatePath('/admin/settings');
  redirect('/admin/settings?saved=1');
}
