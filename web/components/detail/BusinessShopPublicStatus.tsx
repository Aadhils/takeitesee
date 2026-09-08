import { createSupabaseServiceClient } from '../../lib/supabase/service';
import BusinessShopPublicStatusPresentation from './BusinessShopPublicStatusPresentation';

type BusinessShopState = 'open' | 'closed';

export default async function BusinessShopPublicStatus({ businessId }: { businessId: string }) {
  let shopState: BusinessShopState = 'closed';
  try {
    const serviceRole = createSupabaseServiceClient();
    const { data, error } = await serviceRole
      .from('business_shop_status')
      .select('shop_state')
      .eq('business_id', businessId)
      .maybeSingle();
    if (!error && data?.shop_state === 'open') shopState = 'open';
  } catch {
    shopState = 'closed';
  }

  return <BusinessShopPublicStatusPresentation shopState={shopState} />;
}
