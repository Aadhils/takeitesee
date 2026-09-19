import { LiveProviderShell } from '../../../components/provider/LiveProviderShell';
import ProviderCategoryRequestsManager, { type ProviderCategoryRequest } from '../../../components/provider/ProviderCategoryRequestsManager';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function ProviderCategoryRequestsPage() {
  const session = await productionAuthProvider.requireProvider();
  const supabase = await createSupabaseServerClient();

  const [{ data: applications, error: appError }, { data: categories, error: categoryError }, { data: requests, error: requestError }] = await Promise.all([
    supabase.from('platform_applications').select('id,code,name,status').eq('status', 'active').order('name'),
    supabase.from('platform_categories').select('id,application_id,parent_id,code,name,active').eq('active', true).order('sort_order').order('name'),
    supabase.from('provider_category_requests')
      .select('id,provider_type,application_id,suggested_parent_category_id,requested_name,requested_description,status,review_note,created_category_id,created_at,reviewed_at')
      .eq('requester_user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (appError || categoryError || requestError) throw new Error(appError?.message || categoryError?.message || requestError?.message);

  return <LiveProviderShell active="/provider/services">
    <ProviderCategoryRequestsManager
      applications={applications ?? []}
      categories={categories ?? []}
      requests={(requests ?? []) as ProviderCategoryRequest[]}
    />
  </LiveProviderShell>;
}
