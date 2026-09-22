import { createSupabaseServerClient, getSupabaseRequestAccessToken } from '../../lib/supabase/server';

export async function requireCustomerSupabase(request?: Request) {
  const accessToken = await getSupabaseRequestAccessToken(request);
  const supabase = await createSupabaseServerClient(request, accessToken);
  const { data: { user }, error } = await supabase.auth.getUser(accessToken ?? undefined);
  if (error || !user) throw new Error('Authentication required.');
  return { supabase, user };
}
