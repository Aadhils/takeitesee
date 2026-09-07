import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

type ProviderIdentityType = 'professional' | 'business';

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const loadCurrentPublicProviderHandle = cache(async (
  identityType: ProviderIdentityType,
  identityId: string,
): Promise<string | null> => {
  const supabase = publicSupabase();
  if (!supabase || !identityId) return null;

  const { data, error } = await supabase
    .from('identity_handles')
    .select('handle')
    .eq('identity_type', identityType)
    .eq('identity_id', identityId)
    .eq('is_current', true)
    .maybeSingle();

  if (error || !data?.handle) return null;
  return String(data.handle);
});
