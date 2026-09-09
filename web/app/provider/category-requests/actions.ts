'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export async function submitProviderCategoryRequest(formData: FormData) {
  const session = await productionAuthProvider.requireProvider();
  const supabase = await createSupabaseServerClient();
  const providerType = session.roles.includes('professional') ? 'professional' : 'business';

  const applicationId = String(formData.get('application_id') ?? '').trim();
  const parentCategoryId = String(formData.get('parent_category_id') ?? '').trim() || null;
  const requestedName = String(formData.get('requested_name') ?? '').trim();
  const requestedDescription = String(formData.get('requested_description') ?? '').trim() || null;

  if (!applicationId || !requestedName) throw new Error('Application and category name are required.');

  const { error } = await supabase.rpc('submit_provider_category_request', {
    requested_provider_type: providerType,
    target_application_id: applicationId,
    target_parent_category_id: parentCategoryId,
    requested_name: requestedName,
    requested_description: requestedDescription,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/provider/category-requests');
  revalidatePath('/provider/services');
  revalidatePath('/provider/setup');
}
